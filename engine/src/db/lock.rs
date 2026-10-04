//! The lock around the species store.
//!
//! `std::sync::RwLock` lets a waiting writer block *new* readers. The engine reads the store from deep inside its own call
//! chains (thermo lookups inside Henry-species resolution, UNIFAC groups inside the equilibrium solver, ...), so a thread
//! that holds a read guard and asks for a second one deadlocks as soon as another thread (a parallel test, a worker) waits
//! for the write lock: the writer waits for the first guard, the nested read waits for the writer. This lock admits readers
//! whenever no writer is *active*, so nested and recursive reads never block; a writer waits for the readers to drain
//! (writes are rare, short registrations, so starvation is not a practical concern).
//!
//! What can still deadlock is a thread taking the write lock while it holds a read (or write) guard of the same lock; that
//! is a programming error, and it panics with a message instead of hanging.

use std::cell::{RefCell, UnsafeCell};
use std::ops::{Deref, DerefMut};
use std::sync::{Condvar, LockResult, Mutex, MutexGuard};

struct State {
    readers: usize,
    writer: bool,
}

pub struct StoreLock<T> {
    state: Mutex<State>,
    cv: Condvar,
    data: UnsafeCell<T>,
}

// SAFETY: access to `data` is serialised by `state`: any number of shared references while `writer` is false, exactly one
// exclusive reference while it is true.
unsafe impl<T: Send> Send for StoreLock<T> {}
unsafe impl<T: Send + Sync> Sync for StoreLock<T> {}

thread_local! {
    /// Addresses of the locks this thread currently holds (one entry per read guard, one per write guard).
    static HELD: RefCell<Vec<usize>> = const { RefCell::new(Vec::new()) };
    /// Addresses of the locks this thread currently holds for *writing* (a subset of `HELD`).
    static WRITING: RefCell<Vec<usize>> = const { RefCell::new(Vec::new()) };
}

/// The store is being written.
#[derive(Debug, Clone, Copy)]
pub struct WouldBlock;

pub struct ReadGuard<'a, T> {
    lock: &'a StoreLock<T>,
}

pub struct WriteGuard<'a, T> {
    lock: &'a StoreLock<T>,
}

impl<T> StoreLock<T> {
    pub fn new(value: T) -> Self {
        Self { state: Mutex::new(State { readers: 0, writer: false }), cv: Condvar::new(), data: UnsafeCell::new(value) }
    }

    fn addr(&self) -> usize {
        self as *const Self as usize
    }

    fn state(&self) -> MutexGuard<'_, State> {
        // the state is two plain fields updated under the mutex, so a poisoned mutex still holds consistent state
        self.state.lock().unwrap_or_else(|e| e.into_inner())
    }

    /// Shared access. Never blocks on a *waiting* writer, so it may be called while this thread already holds a read guard.
    pub fn read(&self) -> LockResult<ReadGuard<'_, T>> {
        let mut st = self.state();
        // a writer is active and this thread holds the lock: the writer is this thread's own guard
        assert!(
            !(st.writer && HELD.with(|h| h.borrow().contains(&self.addr()))),
            "species store: read lock requested while this thread holds the write lock"
        );
        while st.writer {
            st = self.cv.wait(st).unwrap_or_else(|e| e.into_inner());
        }
        st.readers += 1;
        drop(st);
        HELD.with(|h| h.borrow_mut().push(self.addr()));
        Ok(ReadGuard { lock: self })
    }

    /// Shared access, waiting for a writer on *another* thread (registrations are short); `Err` only when this thread itself
    /// holds the write lock, where waiting would never end: a caller that may run inside a registration reports "unknown"
    /// instead of waiting for itself. (Reporting "unknown" for a foreign writer too made a lookup that raced with a
    /// registration on another thread look like "no such species": a parallel test lost its network that way.)
    pub fn try_read(&self) -> Result<ReadGuard<'_, T>, WouldBlock> {
        if WRITING.with(|w| w.borrow().contains(&self.addr())) {
            return Err(WouldBlock);
        }
        let mut st = self.state();
        while st.writer {
            st = self.cv.wait(st).unwrap_or_else(|e| e.into_inner());
        }
        st.readers += 1;
        drop(st);
        HELD.with(|h| h.borrow_mut().push(self.addr()));
        Ok(ReadGuard { lock: self })
    }

    /// Exclusive access. Panics if this thread already holds a guard of this lock (it would wait for itself forever).
    pub fn write(&self) -> LockResult<WriteGuard<'_, T>> {
        let held_here = HELD.with(|h| h.borrow().contains(&self.addr()));
        assert!(
            !held_here,
            "species store: write lock requested while this thread holds a guard of the same lock (read guards must be dropped before registering a record)"
        );
        let mut st = self.state();
        while st.writer || st.readers > 0 {
            st = self.cv.wait(st).unwrap_or_else(|e| e.into_inner());
        }
        st.writer = true;
        drop(st);
        HELD.with(|h| h.borrow_mut().push(self.addr()));
        WRITING.with(|w| w.borrow_mut().push(self.addr()));
        Ok(WriteGuard { lock: self })
    }
}

fn release_held(addr: usize) {
    // thread-local storage may already be gone when a guard is dropped during thread teardown
    let _ = HELD.try_with(|h| {
        let mut h = h.borrow_mut();
        if let Some(pos) = h.iter().rposition(|a| *a == addr) {
            h.swap_remove(pos);
        }
    });
}

impl<T> Deref for ReadGuard<'_, T> {
    type Target = T;
    fn deref(&self) -> &T {
        // SAFETY: a read guard exists only while `writer` is false and counts itself in `readers`
        unsafe { &*self.lock.data.get() }
    }
}

impl<T> Drop for ReadGuard<'_, T> {
    fn drop(&mut self) {
        release_held(self.lock.addr());
        let mut st = self.lock.state();
        st.readers -= 1;
        if st.readers == 0 {
            self.lock.cv.notify_all();
        }
    }
}

impl<T> Deref for WriteGuard<'_, T> {
    type Target = T;
    fn deref(&self) -> &T {
        // SAFETY: the write guard is the only access while `writer` is true
        unsafe { &*self.lock.data.get() }
    }
}

impl<T> DerefMut for WriteGuard<'_, T> {
    fn deref_mut(&mut self) -> &mut T {
        // SAFETY: as above, and `&mut self` makes this the only reference derived from the guard
        unsafe { &mut *self.lock.data.get() }
    }
}

impl<T> Drop for WriteGuard<'_, T> {
    fn drop(&mut self) {
        let _ = WRITING.try_with(|w| {
            let mut w = w.borrow_mut();
            if let Some(pos) = w.iter().rposition(|a| *a == self.lock.addr()) {
                w.swap_remove(pos);
            }
        });
        release_held(self.lock.addr());
        let mut st = self.lock.state();
        st.writer = false;
        self.lock.cv.notify_all();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use std::time::Duration;

    #[test]
    fn nested_reads_do_not_deadlock_against_a_waiting_writer() {
        let lock = Arc::new(StoreLock::new(5_i32));
        let outer = lock.read().unwrap();
        let l2 = lock.clone();
        let writer = std::thread::spawn(move || {
            *l2.write().unwrap() += 1;
        });
        // give the writer time to start waiting, then read again while still holding the outer guard
        std::thread::sleep(Duration::from_millis(100));
        let inner = lock.read().unwrap();
        assert_eq!(*inner, 5);
        drop(inner);
        drop(outer);
        writer.join().unwrap();
        assert_eq!(*lock.read().unwrap(), 6);
    }

    #[test]
    #[should_panic(expected = "write lock requested")]
    fn write_while_reading_panics_instead_of_hanging() {
        let lock = StoreLock::new(0_i32);
        let _r = lock.read().unwrap();
        let _w = lock.write().unwrap();
    }

    #[test]
    fn writes_are_exclusive() {
        let lock = Arc::new(StoreLock::new(0_u64));
        let handles: Vec<_> = (0..4)
            .map(|_| {
                let l = lock.clone();
                std::thread::spawn(move || {
                    for _ in 0..1000 {
                        *l.write().unwrap() += 1;
                        let _ = *l.read().unwrap();
                    }
                })
            })
            .collect();
        for h in handles {
            h.join().unwrap();
        }
        assert_eq!(*lock.read().unwrap(), 4000);
    }

    /// `try_read` waits for a writer on another thread (so a lookup racing with a registration sees the registered store, not
    /// "unknown") but refuses at once when this thread is the writer.
    #[test]
    fn try_read_waits_for_a_foreign_writer_and_refuses_a_self_writer() {
        let lock = Arc::new(StoreLock::new(1_i32));
        let l2 = lock.clone();
        let (tx, rx) = std::sync::mpsc::channel();
        let writer = std::thread::spawn(move || {
            let mut w = l2.write().unwrap();
            tx.send(()).unwrap();
            std::thread::sleep(Duration::from_millis(150));
            *w = 2;
        });
        rx.recv().unwrap();
        // the writer is active: the read waits for it and then sees its value
        assert_eq!(*lock.try_read().expect("foreign writer finishes"), 2);
        writer.join().unwrap();
        {
            let _w = lock.write().unwrap();
            assert!(lock.try_read().is_err(), "this thread holds the write lock: unknown, not a self-deadlock");
        }
        assert!(lock.try_read().is_ok());
    }
}
