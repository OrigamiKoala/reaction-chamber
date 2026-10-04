import * as THREE from 'three';
import { VesselBundle } from './glassware';
import { SpriteParticles } from '../render/particles';
import { softSpriteTexture, smokePuffTexture } from '../render/textures';
import { getRibbonGeo } from '../render/effects';
import { makePipette, makeSpatula } from '../equipment/bottle';

/** Per-frame task; return true when finished. `cancel` must leave the scene consistent and fire callbacks. */
export interface AnimTask {
  update(dt: number, time: number): boolean;
  /** Objects whose motion should block other moves (e.g. relocation of a vessel being poured). */
  owns?: THREE.Object3D[];
}

export class Animator {
  private tasks: AnimTask[] = [];
  private finish = new Map<AnimTask, () => void>();
  /** `onFinish` runs when the task ends normally OR throws (use it for must-fire callbacks). */
  public add(t: AnimTask, onFinish?: () => void) {
    this.tasks.push(t);
    if (onFinish) this.finish.set(t, onFinish);
  }
  public tick(dt: number, time: number) {
    for (let i = 0; i < this.tasks.length; ) {
      const task = this.tasks[i];
      let done = true;
      try {
        done = task.update(dt, time);
      } catch (e) {
        console.error('[bench] animation task failed', e);
        done = true;
      }
      if (done) {
        this.tasks.splice(i, 1);
        const f = this.finish.get(task);
        if (f) {
          this.finish.delete(task);
          f();
        }
      } else i++;
    }
  }
  public get active(): boolean {
    return this.tasks.length > 0;
  }
  public isBusy(obj: THREE.Object3D): boolean {
    return this.tasks.some((t) => t.owns?.includes(obj));
  }
}

export const ease = {
  inOut: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  out: (t: number) => 1 - (1 - t) * (1 - t),
  in: (t: number) => t * t,
  smooth: (t: number) => t * t * (3 - 2 * t),
};

/** Wrap a callback so it fires at most once. */
export function once(fn?: () => void): () => void {
  let done = false;
  return () => {
    if (done) return;
    done = true;
    try {
      fn?.();
    } catch (e) {
      console.error('[bench] onComplete threw', e);
    }
  };
}

const G = 981; // cm/s²
const UP = new THREE.Vector3(0, 1, 0);

// ------------------------------------------------------------------ stream geometry + material
function streamGeometry(p0: THREE.Vector3, dirH: THREE.Vector3, D: number, H: number, r0: number): THREE.BufferGeometry {
  const rings = 40;
  const segs = 10;
  const pos: number[] = [];
  const nor: number[] = [];
  const sAttr: number[] = [];
  const idx: number[] = [];
  const side = new THREE.Vector3().crossVectors(dirH, UP).normalize();
  const c = new THREE.Vector3();
  const t = new THREE.Vector3();
  const n1 = new THREE.Vector3();
  const n2 = new THREE.Vector3();
  for (let j = 0; j <= rings; j++) {
    const s = j / rings;
    c.copy(p0).addScaledVector(dirH, D * s);
    c.y -= H * s * s;
    t.copy(dirH).multiplyScalar(D).addScaledVector(UP, -2 * H * s).normalize();
    n1.copy(side);
    n2.crossVectors(t, n1).normalize();
    const r = r0 * (1 - 0.45 * Math.sqrt(s));
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const nx = n1.x * Math.cos(a) + n2.x * Math.sin(a);
      const ny = n1.y * Math.cos(a) + n2.y * Math.sin(a);
      const nz = n1.z * Math.cos(a) + n2.z * Math.sin(a);
      pos.push(c.x + nx * r, c.y + ny * r, c.z + nz * r);
      nor.push(nx, ny, nz);
      sAttr.push(s);
    }
  }
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < segs; i++) {
      const a = j * (segs + 1) + i;
      const b = a + segs + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('aS', new THREE.Float32BufferAttribute(sAttr, 1));
  g.setIndex(idx);
  return g;
}

function streamMaterial(colorHex: string, ior = 1.333): { mat: THREE.MeshPhysicalMaterial; head: { value: number }; tail: { value: number }; time: { value: number } } {
  const c = new THREE.Color(colorHex);
  const lum = c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
  const head = { value: 0 };
  const tail = { value: 0 };
  const time = { value: 0 };
  const mat = new THREE.MeshPhysicalMaterial({
    color: lum > 0.82 ? new THREE.Color(0xeef6fb) : c,
    roughness: 0.04,
    metalness: 0,
    ior: Math.min(2.333, Math.max(1.0, ior)),
    transparent: true,
    opacity: lum > 0.82 ? 0.32 : 0.82,
    envMapIntensity: 1.6,
    depthWrite: false,
    clearcoat: 0.5,
  });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uHead = head;
    sh.uniforms.uTail = tail;
    sh.uniforms.uTimeS = time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aS;\nvarying float vS;\nuniform float uTimeS;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvS = aS;\ntransformed += normal * 0.03 * sin( aS * 40.0 - uTimeS * 30.0 );');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vS;\nuniform float uHead;\nuniform float uTail;')
      .replace('void main() {', 'void main() {\nif ( vS > uHead || vS < uTail ) discard;');
  };
  mat.customProgramCacheKey = () => 'pour_stream';
  return { mat, head, tail, time };
}

// ------------------------------------------------------------------ pour
export interface PourSource {
  object: THREE.Object3D;
  /** Lip / spout position in the object's frame (no rotation). */
  lipLocal: THREE.Vector3;
  /** Lip height above the object's base and body radius (clearance math). */
  lipHeight: number;
  bodyRadius: number;
  isBottle: boolean;
  /** Liquid fill height above the object's base (vessels; drives the onset tilt). */
  fillHeight: number;
  groundY: number;
  onStart?: () => void;
  onEnd?: () => void;
  /** Temporary prop: scale in/out and dispose at the end. */
  temporary?: boolean;
}

export function pourTask(
  scene: THREE.Scene,
  src: PourSource,
  target: VesselBundle,
  colorHex: string,
  onLand: () => void
): AnimTask {
  const obj = src.object;
  const startPos = obj.position.clone();
  const startQuat = obj.quaternion.clone();
  const tPos = target.group.position.clone();
  const rimTop = tPos.y + target.profile.rimY + target.profile.baseOffsetY;
  const rimOuter = target.profile.rimOuterRadius;
  const dir = new THREE.Vector3(startPos.x - tPos.x, 0, startPos.z - tPos.z);
  if (dir.lengthSq() < 1e-4) dir.set(-1, 0, 0);
  dir.normalize();
  const toTarget = dir.clone().negate();
  const yaw = Math.atan2(dir.z, -dir.x);
  const qYaw = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
  const lipXZ = tPos.clone().addScaledVector(dir, rimOuter + 0.45);
  const Rl = src.lipLocal.x;
  const Hl = src.lipHeight;
  const Rs = src.bodyRadius;
  const drop = (th: number) =>
    Math.max(0, Hl * Math.cos(th) + (Rs - Rl) * Math.sin(th), Hl * Math.cos(th) - (Rs + Rl) * Math.sin(th));
  const theta0 = src.isBottle ? 1.15 : Math.max(0.35, Math.min(1.45, Math.atan2(Math.max(0.2, Hl - src.fillHeight), Math.max(0.5, Rl))));
  const thetaEnd = src.isBottle ? 1.85 : Math.min(1.95, theta0 + 0.4);
  const ground = Math.max(src.groundY, 0);
  const lipYFixed = Math.max(rimTop + 1.0, ground + 0.8 + drop(theta0 - 0.2));
  const lipY = (th: number) => Math.max(lipYFixed, ground + 0.8 + drop(th));

  const q = new THREE.Quaternion();
  const qt = new THREE.Quaternion();
  const tmp = new THREE.Vector3();
  const poseAt = (th: number, outPos: THREE.Vector3, outQ: THREE.Quaternion) => {
    qt.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -th);
    outQ.copy(qYaw).multiply(qt);
    tmp.copy(src.lipLocal).applyQuaternion(outQ);
    outPos.set(lipXZ.x, lipY(th), lipXZ.z).sub(tmp);
  };

  const hoverPos = new THREE.Vector3();
  const hoverQ = new THREE.Quaternion();
  poseAt(0, hoverPos, hoverQ);
  hoverPos.y += 1.5;
  const endPos = new THREE.Vector3();
  const endQ = new THREE.Quaternion();
  poseAt(Math.max(0, theta0 - 0.25), endPos, endQ);

  // stream
  const lipW = new THREE.Vector3(lipXZ.x, lipYFixed, lipXZ.z).addScaledVector(toTarget, 0.1);
  const surfY = tPos.y + target.surfaceLocalY();
  const fallH = Math.max(0.5, lipW.y - surfY);
  const D = rimOuter + 0.45 - target.profile.rimInnerRadius * 0.25;
  const geo = streamGeometry(lipW, toTarget, D, fallH, src.isBottle ? 0.27 : 0.34);
  const sm = streamMaterial(colorHex);
  const stream = new THREE.Mesh(geo, sm.mat);
  stream.frustumCulled = false;
  stream.raycast = () => {};
  stream.visible = false;
  scene.add(stream);
  const landWorld = new THREE.Vector3(lipW.x, surfY, lipW.z).addScaledVector(toTarget, D);
  const landColor = new THREE.Color(colorHex);
  const fallT = Math.sqrt((2 * fallH) / G);

  const T1 = 0.5, T2 = 0.35, T3 = 0.85, T4 = 0.25, T5 = 0.55;
  const tPourStart = T1 + T2;
  const tPourEnd = tPourStart + T3;
  const total = tPourEnd + T4 + T5;
  let t = 0;
  let landed = false;
  let lastSplash = 0;
  const land = once(onLand);
  src.onStart?.();
  if (src.temporary) obj.scale.setScalar(0.01);

  const cur = new THREE.Vector3();
  const curQ = new THREE.Quaternion();
  return {
    owns: [obj, target.group],
    update: (dt: number, time: number) => {
      t += dt;
      sm.time.value = time;
      stream.renderOrder = target.glassMesh.renderOrder - 1;
      if (t < T1) {
        const k = ease.inOut(t / T1);
        cur.lerpVectors(startPos, hoverPos, k);
        cur.y += Math.sin(k * Math.PI) * 6;
        curQ.slerpQuaternions(startQuat, hoverQ, k);
        obj.position.copy(cur);
        obj.quaternion.copy(curQ);
        if (src.temporary) obj.scale.setScalar(Math.max(0.01, Math.min(1, t / 0.25)));
      } else if (t < tPourEnd + T4) {
        let th: number;
        if (t < tPourStart) th = theta0 * ease.inOut((t - T1) / T2);
        else if (t < tPourEnd) th = theta0 + (thetaEnd - theta0) * ease.smooth((t - tPourStart) / T3);
        else th = thetaEnd + (Math.max(0, theta0 - 0.25) - thetaEnd) * ease.inOut((t - tPourEnd) / T4);
        poseAt(th, cur, curQ);
        if (t < T1 + 0.08) cur.lerp(hoverPos, 1 - (t - T1) / 0.08);
        obj.position.copy(cur);
        obj.quaternion.copy(curQ);
        // stream head/tail follow free fall
        if (t >= tPourStart) {
          stream.visible = true;
          const tf = t - tPourStart;
          sm.head.value = Math.min(1, Math.sqrt(Math.min(1, (0.5 * G * tf * tf) / fallH + tf * 1.5)));
          if (t > tPourEnd) {
            const tt = t - tPourEnd;
            sm.tail.value = Math.min(1.01, Math.sqrt(Math.min(1, (0.5 * G * tt * tt) / fallH + tt * 2)));
          }
          if (!landed && tf >= fallT * 0.9) {
            landed = true;
            const lp = target.glassRoot.worldToLocal(landWorld.clone());
            target.effects.splashAt(lp.x, lp.z, landColor, 10, 1.0);
            target.liquid.slosh(0.03, toTarget.x, toTarget.z);
            land();
          }
          if (landed && t < tPourEnd + 0.1 && time - lastSplash > 0.12) {
            lastSplash = time;
            const lp = target.glassRoot.worldToLocal(landWorld.clone());
            target.effects.splashAt(lp.x, lp.z, landColor, 2, 0.6);
          }
        }
      } else if (t < total) {
        stream.visible = sm.tail.value < 1;
        const tt = t - tPourEnd;
        sm.tail.value = Math.min(1.01, Math.sqrt(Math.min(1, (0.5 * G * tt * tt) / fallH + tt * 2)));
        const k = ease.inOut((t - tPourEnd - T4) / T5);
        cur.lerpVectors(endPos, startPos, k);
        cur.y += Math.sin(k * Math.PI) * 5;
        curQ.slerpQuaternions(endQ, startQuat, k);
        obj.position.copy(cur);
        obj.quaternion.copy(curQ);
        if (src.temporary) obj.scale.setScalar(Math.max(0.01, Math.min(1, (total - t) / 0.25)));
      } else {
        obj.position.copy(startPos);
        obj.quaternion.copy(startQuat);
        scene.remove(stream);
        geo.dispose();
        sm.mat.dispose();
        land(); // safety: always fire
        src.onEnd?.();
        return true;
      }
      return false;
    },
  };
}

// ------------------------------------------------------------------ drops
let dropGeo: THREE.SphereGeometry | null = null;

export function dropsTask(
  scene: THREE.Scene,
  start: THREE.Vector3,
  target: VesselBundle,
  drops: number,
  colorHex: string,
  onLand: () => void,
  hooks: { onStart?: () => void; onEnd?: () => void; fromAbove?: boolean }
): AnimTask {
  dropGeo ??= new THREE.SphereGeometry(0.23, 14, 10);
  const pip = makePipette();
  scene.add(pip);
  const c = new THREE.Color(colorHex);
  const lum = c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
  const dropMat = new THREE.MeshPhysicalMaterial({
    color: lum > 0.82 ? 0xeef6fb : c,
    roughness: 0.03,
    transparent: true,
    opacity: lum > 0.82 ? 0.45 : 0.85,
    envMapIntensity: 2,
    depthWrite: false,
  });
  const tPos = target.group.position.clone();
  const rimTop = tPos.y + target.profile.rimY + target.profile.baseOffsetY;
  const dir = new THREE.Vector3(start.x - tPos.x, 0, start.z - tPos.z);
  if (dir.lengthSq() < 1e-4) dir.set(-1, 0, 0);
  dir.normalize();
  const tipPos = tPos.clone().addScaledVector(dir, target.profile.rimInnerRadius * 0.25);
  tipPos.y = rimTop + 3.0;
  const startPos = hooks.fromAbove ? tipPos.clone().add(new THREE.Vector3(0, 14, 0)) : start.clone();
  pip.position.copy(startPos);
  const bulb = pip.getObjectByName('bulb')!;
  const n = Math.max(1, Math.min(8, Math.round(drops)));
  const interval = n > 4 ? 0.2 : 0.3;
  const T1 = 0.6;
  const tDrops = T1 + 0.15;
  const tLast = tDrops + (n - 1) * interval;
  const surfY = () => target.group.position.y + target.surfaceLocalY();
  const live: { m: THREE.Mesh; v: number; done: boolean }[] = [];
  let spawned = 0;
  let t = 0;
  let returning = -1;
  const land = once(onLand);
  hooks.onStart?.();
  return {
    owns: [target.group],
    update: (dt: number) => {
      t += dt;
      if (t < T1) {
        const k = ease.inOut(t / T1);
        pip.position.lerpVectors(startPos, tipPos, k);
        pip.position.y += Math.sin(k * Math.PI) * 8;
      } else if (returning < 0) {
        pip.position.copy(tipPos);
      }
      // squeeze + release drops
      if (spawned < n && t >= tDrops + spawned * interval) {
        const m = new THREE.Mesh(dropGeo!, dropMat);
        m.position.copy(tipPos).add(new THREE.Vector3(0, -0.15, 0));
        m.raycast = () => {};
        m.renderOrder = target.glassMesh.renderOrder - 1;
        scene.add(m);
        live.push({ m, v: 0, done: false });
        spawned++;
      }
      const ph = spawned < n && t > tDrops - 0.1 ? Math.max(0, 1 - Math.abs(((t - tDrops) % interval) / interval - 0.5) * 2) : 0;
      bulb.scale.set(1 + ph * 0.12, 1 - ph * 0.22, 1 + ph * 0.12);
      for (const d of live) {
        if (d.done) continue;
        d.v += G * dt;
        d.m.position.y -= d.v * dt;
        d.m.scale.set(1, 1 + Math.min(0.5, d.v / 400), 1);
        if (d.m.position.y <= surfY()) {
          d.done = true;
          scene.remove(d.m);
          const lp = target.glassRoot.worldToLocal(d.m.position.clone());
          target.effects.splashAt(lp.x, lp.z, c, 4, 0.5);
          land();
        }
      }
      const allDone = spawned >= n && live.every((d) => d.done);
      if (allDone && returning < 0 && t > tLast + 0.25) returning = t;
      if (returning >= 0) {
        const k = Math.min(1, (t - returning) / 0.6);
        pip.position.lerpVectors(tipPos, startPos, ease.inOut(k));
        pip.position.y += Math.sin(k * Math.PI) * 8;
        if (k >= 1) {
          scene.remove(pip);
          for (const d of live) scene.remove(d.m);
          dropMat.dispose();
          land();
          hooks.onEnd?.();
          return true;
        }
      }
      if (t > 8) {
        // hard safety stop
        scene.remove(pip);
        for (const d of live) scene.remove(d.m);
        dropMat.dispose();
        land();
        hooks.onEnd?.();
        return true;
      }
      return false;
    },
  };
}

// ------------------------------------------------------------------ solids
export function solidTask(
  scene: THREE.Scene,
  start: THREE.Vector3,
  target: VesselBundle,
  colorHex: string,
  metal: boolean,
  onLand: () => void,
  hooks: { onStart?: () => void; onEnd?: () => void }
): AnimTask {
  const tPos = target.group.position.clone();
  const rimTop = tPos.y + target.profile.rimY + target.profile.baseOffsetY;
  const surfY = () => target.group.position.y + target.surfaceLocalY();
  const land = once(onLand);
  const c = new THREE.Color(colorHex);
  hooks.onStart?.();

  if (metal) {
    const ribbon = new THREE.Mesh(getRibbonGeo(), new THREE.MeshStandardMaterial({ color: c.getHex() === 0xffffff ? 0xc0c2c6 : c, metalness: 1, roughness: 0.3, side: THREE.DoubleSide }));
    const s = Math.min(1, (target.profile.rimInnerRadius * 2 - 0.4) / 5);
    ribbon.scale.setScalar(Math.max(0.35, s));
    ribbon.castShadow = true;
    ribbon.position.set(tPos.x, rimTop + 9, tPos.z);
    scene.add(ribbon);
    let v = 0;
    let t = 0;
    let landed = false;
    return {
      owns: [target.group],
      update: (dt: number) => {
        t += dt;
        if (t < 0.35) {
          ribbon.position.y = rimTop + 9 - ease.out(t / 0.35) * 3;
          return false;
        }
        if (!landed) {
          v += G * 0.6 * dt;
          ribbon.position.y -= v * dt;
          ribbon.rotation.x += dt * 4;
          ribbon.rotation.y += dt * 2;
          if (ribbon.position.y <= surfY() + 0.1 || t > 3) {
            landed = true;
            const lp = target.glassRoot.worldToLocal(ribbon.position.clone());
            target.effects.splashAt(lp.x, lp.z, new THREE.Color(target.getLiquidColorHex()), 8, 0.8);
            land();
            scene.remove(ribbon);
            (ribbon.material as THREE.Material).dispose();
            hooks.onEnd?.();
            return true;
          }
        }
        return false;
      },
    };
  }

  const spat = makeSpatula();
  const dir = new THREE.Vector3(start.x - tPos.x, 0, start.z - tPos.z);
  if (dir.lengthSq() < 1e-4) dir.set(-1, 0, 0);
  dir.normalize();
  const yaw = Math.atan2(dir.z, -dir.x);
  const heapMat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 });
  const heap = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 8), heapMat);
  heap.scale.set(1, 0.45, 0.8);
  heap.position.set(0.3, 0.15, 0);
  spat.add(heap);
  const scoopTarget = tPos.clone().addScaledVector(dir, target.profile.rimInnerRadius * 0.3);
  scoopTarget.y = rimTop + 2.5;
  // the spatula's +X handle points away from the target (toward the user side)
  const holdQ = new THREE.Quaternion().setFromAxisAngle(UP, yaw + Math.PI);
  const startPos = start.clone();
  spat.position.copy(startPos);
  spat.quaternion.copy(holdQ);
  scene.add(spat);
  const powder = new SpriteParticles(320, softSpriteTexture(), { minPx: 1.0 });
  powder.fadeIn = 0;
  powder.points.renderOrder = target.glassMesh.renderOrder - 1;
  scene.add(powder.points);
  const T1 = 0.6;
  const T2 = 0.3;
  const T3 = 0.6;
  const T4 = 0.55;
  let t = 0;
  let emitAcc = 0;
  const rollAxis = new THREE.Vector3(1, 0, 0);
  const qRoll = new THREE.Quaternion();
  const tmp = new THREE.Vector3();
  return {
    owns: [target.group],
    update: (dt: number, time: number) => {
      t += dt;
      if (t < T1) {
        const k = ease.inOut(t / T1);
        spat.position.lerpVectors(startPos, scoopTarget, k);
        spat.position.y += Math.sin(k * Math.PI) * 8;
      } else if (t < T1 + T2 + T3) {
        spat.position.copy(scoopTarget);
        const k = Math.min(1, (t - T1) / T2);
        qRoll.setFromAxisAngle(rollAxis, ease.inOut(k) * 1.25);
        spat.quaternion.copy(holdQ).multiply(qRoll);
        if (t > T1 + T2 * 0.5) {
          heap.scale.multiplyScalar(Math.max(0, 1 - dt * 3));
          emitAcc += 420 * dt;
          while (emitAcc >= 1) {
            emitAcc -= 1;
            tmp.set(0.3 + Math.random() * 0.6, 0, (Math.random() - 0.5) * 0.8).applyQuaternion(spat.quaternion).add(spat.position);
            const sh = 0.85 + Math.random() * 0.3;
            powder.spawn(tmp.x, tmp.y, tmp.z, (Math.random() - 0.5) * 2.2, -Math.random() * 5 - 2, (Math.random() - 0.5) * 2.2, 2.0, 0.055, 0.04, 0.95, c.r * sh, c.g * sh, c.b * sh, G * 0.5, 1.5, 0);
          }
        }
      } else if (t < T1 + T2 + T3 + T4) {
        const k = ease.inOut((t - T1 - T2 - T3) / T4);
        spat.position.lerpVectors(scoopTarget, startPos, k);
        spat.position.y += Math.sin(k * Math.PI) * 8;
        spat.quaternion.copy(holdQ);
      }
      // powder hits the surface
      const sy = surfY();
      for (let i = 0; i < powder.live; i++) {
        if (powder.pos[i * 3 + 1] <= sy) {
          if (powder.life[i] < powder.maxLife[i] - 0.01) {
            const lp = target.glassRoot.worldToLocal(tmp.set(powder.pos[i * 3], sy, powder.pos[i * 3 + 2]));
            if (Math.random() < 0.08) target.liquid.impact(lp.x, lp.z, 0.3, time);
            land();
          }
          powder.maxLife[i] = powder.life[i];
        }
      }
      powder.update(dt);
      if (t >= T1 + T2 + T3 + T4 && powder.live === 0) {
        scene.remove(spat);
        scene.remove(powder.points);
        powder.dispose();
        heap.geometry.dispose();
        heapMat.dispose();
        land();
        hooks.onEnd?.();
        return true;
      }
      if (t > 8) {
        scene.remove(spat);
        scene.remove(powder.points);
        powder.dispose();
        land();
        hooks.onEnd?.();
        return true;
      }
      return false;
    },
  };
}

// ------------------------------------------------------------------ relocation (lift – slide – lower)
export function moveTask(obj: THREE.Object3D, to: THREE.Vector3, onArrive?: () => void, clearY = 0): AnimTask {
  const from = obj.position.clone();
  const lift = Math.max(from.y, to.y, clearY) + 5;
  const T1 = 0.35, T2 = Math.min(1.0, 0.4 + from.distanceTo(to) / 120), T3 = 0.35;
  let t = 0;
  const arrive = once(onArrive);
  return {
    owns: [obj],
    update: (dt: number) => {
      t += dt;
      if (t < T1) {
        const k = ease.inOut(t / T1);
        obj.position.set(from.x, from.y + (lift - from.y) * k, from.z);
      } else if (t < T1 + T2) {
        const k = ease.inOut((t - T1) / T2);
        obj.position.set(from.x + (to.x - from.x) * k, lift, from.z + (to.z - from.z) * k);
      } else if (t < T1 + T2 + T3) {
        const k = ease.out((t - T1 - T2) / T3);
        obj.position.set(to.x, lift + (to.y - lift) * k, to.z);
      } else {
        obj.position.copy(to);
        arrive();
        return true;
      }
      return false;
    },
  };
}

// ------------------------------------------------------------------ pose task (arc back to the shelf / set down)
/** Glide an object to a pose (position + rotation) along an arc; `arc` is the extra lift (cm) at mid-flight. */
export function poseTask(
  obj: THREE.Object3D,
  toPos: THREE.Vector3,
  toQuat: THREE.Quaternion,
  opts: { arc?: number; duration?: number; rotFrac?: number; onArrive?: () => void; owns?: THREE.Object3D[] } = {}
): AnimTask {
  const from = obj.position.clone();
  const fromQ = obj.quaternion.clone();
  const dist = from.distanceTo(toPos);
  const dur = opts.duration ?? Math.min(0.9, 0.28 + dist / 140);
  const arc = opts.arc ?? 0;
  // rotation finishes earlier than the translation (a tipped container straightens up straight away)
  const rotDur = Math.max(0.05, dur * (opts.rotFrac ?? 1));
  let t = 0;
  const arrive = once(opts.onArrive);
  return {
    owns: opts.owns ?? [obj],
    update: (dt: number) => {
      t += dt;
      const k = ease.inOut(Math.min(1, t / dur));
      obj.position.lerpVectors(from, toPos, k);
      obj.position.y += Math.sin(k * Math.PI) * arc;
      obj.quaternion.slerpQuaternions(fromQ, toQuat, ease.out(Math.min(1, t / rotDur)));
      if (t >= dur) {
        obj.position.copy(toPos);
        obj.quaternion.copy(toQuat);
        arrive();
        return true;
      }
      return false;
    },
  };
}

// ------------------------------------------------------------------ continuous liquid stream (manual pouring)
export interface StreamFrame {
  /** Volumetric flow (mL/s). <= 0 lets the stream run out (tail catches up with the head). */
  flowMlS: number;
  /** World position of the pour lip (stream origin). */
  lip: THREE.Vector3;
  /** World landing point (on the target liquid surface, or the bottom / rim when empty). */
  land: THREE.Vector3;
  /** Receiving vessel (splash / ripples at the landing point), if any. */
  target: VesselBundle | null;
  /** Mouth radius of the source (cap on the stream thickness, cm). */
  mouthR?: number;
}

/** Stream radius (cm) for a flow in mL/s: thin filament for a trickle, fat jet at full tilt. */
export function streamRadius(flowMlS: number, mouthR = 1.3): number {
  const q = Math.max(0, flowMlS);
  return Math.min(Math.max(0.04, mouthR * 0.85), 0.045 + 0.075 * Math.sqrt(q));
}

/**
 * Reusable continuous pour stream: a ballistic tube from the lip to the landing point whose thickness follows the
 * flow rate. The mesh is rebuilt in place every frame (451 vertices), so the lip can move freely while pouring.
 */
export class PourStream {
  public readonly mesh: THREE.Mesh;
  private geo: THREE.BufferGeometry;
  private sm: ReturnType<typeof streamMaterial>;
  private posArr: Float32Array;
  private norArr: Float32Array;
  private head = 0;
  private tail = 1.01;
  private tf = 0;
  private tt = 0;
  private wasFlowing = false;
  private splashT = 0;
  private lastFlow = 0;
  private lastLip = new THREE.Vector3();
  private lastLand = new THREE.Vector3();
  private lastTarget: VesselBundle | null = null;
  private lastMouth = 1.3;
  private color: THREE.Color;
  private disposed = false;
  private static readonly RINGS = 28;
  private static readonly SEGS = 8;

  constructor(private scene: THREE.Scene, colorHex: string, ior = 1.333) {
    this.color = new THREE.Color(colorHex);
    const R = PourStream.RINGS;
    const S = PourStream.SEGS;
    const n = (R + 1) * (S + 1);
    this.posArr = new Float32Array(n * 3);
    this.norArr = new Float32Array(n * 3);
    const sAttr = new Float32Array(n);
    const idx: number[] = [];
    for (let j = 0; j <= R; j++) for (let i = 0; i <= S; i++) sAttr[j * (S + 1) + i] = j / R;
    for (let j = 0; j < R; j++) {
      for (let i = 0; i < S; i++) {
        const a = j * (S + 1) + i;
        const b = a + S + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.posArr, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('normal', new THREE.BufferAttribute(this.norArr, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aS', new THREE.BufferAttribute(sAttr, 1));
    this.geo.setIndex(idx);
    this.geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.sm = streamMaterial(colorHex, ior);
    this.mesh = new THREE.Mesh(this.geo, this.sm.mat);
    this.mesh.frustumCulled = false;
    this.mesh.raycast = () => {};
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  /** True while any part of the stream is still visible (keep calling `update`). */
  public get alive(): boolean {
    return !this.disposed && (this.wasFlowing || this.tail < 1);
  }

  public setColor(hex: string) {
    this.color.set(hex);
  }

  private build(lip: THREE.Vector3, land: THREE.Vector3, r0: number) {
    const R = PourStream.RINGS;
    const S = PourStream.SEGS;
    const dirH = new THREE.Vector3(land.x - lip.x, 0, land.z - lip.z);
    let D = dirH.length();
    if (D < 0.04) {
      dirH.set(1, 0, 0);
      D = 0.04;
    } else dirH.divideScalar(D);
    const H = Math.max(0.4, lip.y - land.y);
    const side = new THREE.Vector3().crossVectors(dirH, UP).normalize();
    const c = new THREE.Vector3();
    const t = new THREE.Vector3();
    const n2 = new THREE.Vector3();
    let k = 0;
    for (let j = 0; j <= R; j++) {
      const s = j / R;
      c.copy(lip).addScaledVector(dirH, D * s);
      c.y -= H * s * s;
      t.copy(dirH).multiplyScalar(D).addScaledVector(UP, -2 * H * s).normalize();
      n2.crossVectors(t, side).normalize();
      const r = r0 * (1 - 0.45 * Math.sqrt(s));
      for (let i = 0; i <= S; i++) {
        const a = (i / S) * Math.PI * 2;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const nx = side.x * ca + n2.x * sa;
        const ny = side.y * ca + n2.y * sa;
        const nz = side.z * ca + n2.z * sa;
        this.posArr[k] = c.x + nx * r;
        this.posArr[k + 1] = c.y + ny * r;
        this.posArr[k + 2] = c.z + nz * r;
        this.norArr[k] = nx;
        this.norArr[k + 1] = ny;
        this.norArr[k + 2] = nz;
        k += 3;
      }
    }
    (this.geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute('normal') as THREE.BufferAttribute).needsUpdate = true;
    return H;
  }

  public update(dt: number, time: number, f: StreamFrame) {
    if (this.disposed) return;
    const flowing = f.flowMlS > 0.005;
    if (flowing) {
      this.lastFlow = f.flowMlS;
      this.lastLip.copy(f.lip);
      this.lastLand.copy(f.land);
      this.lastTarget = f.target;
      this.lastMouth = f.mouthR ?? this.lastMouth;
    }
    if (flowing && !this.wasFlowing) {
      // (re)start: a fully retracted stream grows from the lip, a lingering one just resumes
      if (this.tail >= 1) {
        this.tf = 0;
        this.head = 0;
      } else this.tf = 1e3;
      this.tail = 0;
      this.tt = 0;
    } else if (!flowing && this.wasFlowing) {
      this.tt = 0;
    }
    this.wasFlowing = flowing;
    if (!flowing && this.tail >= 1) {
      this.mesh.visible = false;
      return;
    }
    const lip = flowing ? f.lip : this.lastLip;
    const land = flowing ? f.land : this.lastLand;
    const flow = flowing ? f.flowMlS : this.lastFlow;
    const target = flowing ? f.target : this.lastTarget;
    const H = this.build(lip, land, streamRadius(flow, flowing ? f.mouthR ?? this.lastMouth : this.lastMouth));
    this.sm.time.value = time;
    if (flowing) {
      this.tf += dt;
      this.head = Math.min(1, Math.sqrt(Math.min(1, (0.5 * G * this.tf * this.tf) / H + this.tf * 1.5)));
      this.tail = 0;
    } else {
      this.tt += dt;
      this.tail = Math.min(1.01, Math.sqrt(Math.min(1, (0.5 * G * this.tt * this.tt) / H + this.tt * 2)));
    }
    this.sm.head.value = this.head;
    this.sm.tail.value = this.tail;
    this.mesh.visible = this.tail < 1 && this.head > 0.02;
    if (target) this.mesh.renderOrder = target.glassMesh.renderOrder - 1;
    // landing: ripples + droplets, gentle for a trickle
    if (flowing && target && this.head >= 0.95) {
      this.splashT += dt;
      const interval = Math.max(0.06, 0.3 - flow * 0.012);
      if (this.splashT >= interval) {
        this.splashT = 0;
        try {
          const lp = target.glassRoot.worldToLocal(land.clone());
          const strength = Math.min(1.0, 0.18 + flow * 0.035);
          const count = flow < 1.5 ? 0 : Math.min(8, Math.round(flow * 0.4));
          target.effects.splashAt(lp.x, lp.z, this.color, count, strength);
          if (flow > 6 && Math.random() < 0.15) target.liquid.slosh(0.012, land.x - lip.x, land.z - lip.z);
        } catch (e) {
          warnStream('splash', e);
        }
      }
    }
  }

  public dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.remove(this.mesh);
    this.geo.dispose();
    this.sm.mat.dispose();
  }
}

const streamWarned = new Set<string>();
function warnStream(key: string, e: unknown) {
  if (streamWarned.has(key)) return;
  streamWarned.add(key);
  console.warn(`[stream] ${key}`, e);
}

// ------------------------------------------------------------------ falling powder (solid jar tilted over a vessel)
/** World Y a falling thing hits inside `target` (liquid surface / powder bed / bench). */
function landingY(target: VesselBundle | null, x: number, z: number): number {
  if (!target) return 0;
  const p = target.group.position;
  const inside = Math.hypot(x - p.x, z - p.z) < Math.max(0.3, target.profile.rimInnerRadius - 0.15);
  return inside ? p.y + target.surfaceLocalY() : p.y;
}

export class PowderStream {
  private powder: SpriteParticles;
  private acc = 0;
  private col: THREE.Color;
  private disposed = false;
  private impactT = 0;

  constructor(private scene: THREE.Scene, colorHex: string) {
    this.col = new THREE.Color(colorHex);
    this.powder = new SpriteParticles(700, softSpriteTexture(), { minPx: 1.0 });
    this.powder.fadeIn = 0;
    scene.add(this.powder.points);
  }

  public get alive(): boolean {
    return !this.disposed && this.powder.live > 0;
  }

  /** `gPerS` <= 0 stops emitting; falling grains finish their fall. */
  public update(dt: number, time: number, gPerS: number, lip: THREE.Vector3, target: VesselBundle | null) {
    if (this.disposed) return;
    const c = this.col;
    if (target) this.powder.points.renderOrder = target.glassMesh.renderOrder - 1;
    if (gPerS > 0) {
      // grains per second grow slowly with mass flow (each grain stands for more powder at a high rate)
      this.acc += Math.min(480, 14 + 70 * Math.sqrt(gPerS) + gPerS * 30) * dt;
      while (this.acc >= 1) {
        this.acc -= 1;
        const sh = 0.85 + Math.random() * 0.3;
        this.powder.spawn(
          lip.x + (Math.random() - 0.5) * 0.5,
          lip.y - Math.random() * 0.3,
          lip.z + (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.5) * 1.6,
          -Math.random() * 4 - 1,
          (Math.random() - 0.5) * 1.6,
          2.0, 0.055, 0.04, 0.95, c.r * sh, c.g * sh, c.b * sh, G * 0.5, 1.5, 0
        );
      }
    } else this.acc = 0;
    this.impactT += dt;
    const pw = this.powder;
    for (let i = 0; i < pw.live; i++) {
      const x = pw.pos[i * 3];
      const z = pw.pos[i * 3 + 2];
      const y = landingY(target, x, z);
      if (pw.pos[i * 3 + 1] <= y && pw.life[i] < pw.maxLife[i] - 0.01) {
        if (target && this.impactT > 0.12 && y > target.group.position.y + 0.01) {
          this.impactT = 0;
          const lp = target.glassRoot.worldToLocal(new THREE.Vector3(x, y, z));
          target.liquid.impact(lp.x, lp.z, Math.min(0.5, 0.12 + gPerS * 0.05), time);
        }
        pw.maxLife[i] = pw.life[i];
      }
    }
    pw.update(dt);
  }

  public dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.remove(this.powder.points);
    this.powder.dispose();
  }
}


/**
 * Gas released from a bottle held over a vessel: a soft plume leaving the neck. A gas denser than the room air (the
 * default for the usual reagent gases) rolls down into the vessel; a light one drifts up past the lip. Colourless gases
 * show only as a faint haze (the colour is the reagent's own, near white for most).
 */
export class GasPlume {
  private puffs: SpriteParticles;
  private acc = 0;
  private col: THREE.Color;
  private disposed = false;

  constructor(private scene: THREE.Scene, colorHex: string) {
    this.col = new THREE.Color(colorHex);
    // lighten towards white: a clear gas is drawn as a faint, slightly cool haze
    const lum = this.col.r * 0.3 + this.col.g * 0.59 + this.col.b * 0.11;
    if (lum > 0.8) this.col.set(0xeef4f8);
    this.puffs = new SpriteParticles(220, smokePuffTexture());
    this.puffs.fadeIn = 0.2;
    scene.add(this.puffs.points);
  }

  public get alive(): boolean {
    return !this.disposed && this.puffs.live > 0;
  }

  /** `mlPerS` <= 0 stops emitting; puffs in the air finish their drift. */
  public update(dt: number, _time: number, mlPerS: number, lip: THREE.Vector3, target: VesselBundle | null, heavy = true) {
    if (this.disposed) return;
    if (target) this.puffs.points.renderOrder = target.glassMesh.renderOrder + 2;
    if (mlPerS > 0) {
      this.acc += Math.min(60, 6 + mlPerS * 0.8) * dt;
      while (this.acc >= 1) {
        this.acc -= 1;
        const sh = 0.9 + Math.random() * 0.15;
        const alpha = Math.min(0.24, 0.07 + mlPerS * 0.004);
        this.puffs.spawn(
          lip.x + (Math.random() - 0.5) * 0.4,
          lip.y - 0.1,
          lip.z + (Math.random() - 0.5) * 0.4,
          (Math.random() - 0.5) * 1.6,
          heavy ? -1.5 - Math.random() * 2 : 2 + Math.random() * 3,
          (Math.random() - 0.5) * 1.6,
          1.6 + Math.random() * 0.8,
          0.5,
          2.4 + Math.random() * 1.2,
          alpha,
          this.col.r * sh,
          this.col.g * sh,
          this.col.b * sh,
          heavy ? -6 : 3,
          0.8,
          0
        );
      }
    } else this.acc = 0;
    // a heavy gas that reaches the vessel's opening is kept by it: it stops at the rim line instead of falling through
    const pu = this.puffs;
    if (heavy && target) {
      const rimTop = target.group.position.y + target.profile.rimY + target.profile.baseOffsetY;
      for (let i = 0; i < pu.live; i++) {
        const dx = pu.pos[i * 3] - target.group.position.x;
        const dz = pu.pos[i * 3 + 2] - target.group.position.z;
        const inside = Math.hypot(dx, dz) < target.profile.rimInnerRadius;
        const floorY = inside ? target.group.position.y + target.profile.innerBottomY + target.profile.baseOffsetY + 0.5 : this.groundFor(target);
        if (pu.pos[i * 3 + 1] < floorY) {
          pu.pos[i * 3 + 1] = floorY;
          pu.vel[i * 3 + 1] = 0;
        }
        void rimTop;
      }
    }
    pu.update(dt);
  }

  private groundFor(target: VesselBundle): number {
    return target.group.position.y + 0.3;
  }

  public dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.remove(this.puffs.points);
    this.puffs.dispose();
  }
}

// ------------------------------------------------------------------ falling metal pieces and liquid drops
interface Faller {
  m: THREE.Mesh;
  v: number;
  spin: THREE.Vector3;
}

abstract class FallerSet {
  protected live: Faller[] = [];
  constructor(protected scene: THREE.Scene) {}
  public get alive(): boolean {
    return this.live.length > 0;
  }
  protected abstract onLand(f: Faller, target: VesselBundle | null, time: number): void;
  protected abstract release(f: Faller): void;
  public update(dt: number, time: number, target: VesselBundle | null) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const f = this.live[i];
      f.v += G * dt;
      f.m.position.y -= f.v * dt;
      f.m.rotation.x += f.spin.x * dt;
      f.m.rotation.y += f.spin.y * dt;
      if (target) f.m.renderOrder = target.glassMesh.renderOrder - 1;
      const y = landingY(target, f.m.position.x, f.m.position.z);
      if (f.m.position.y <= y + 0.05 || f.m.position.y < -5) {
        this.onLand(f, target, time);
        this.scene.remove(f.m);
        this.release(f);
        this.live.splice(i, 1);
      }
    }
  }
  public dispose() {
    for (const f of this.live) {
      this.scene.remove(f.m);
      this.release(f);
    }
    this.live = [];
  }
}

/** Discrete pieces of bare metal (ribbon) dropped one at a time. */
export class MetalPieces extends FallerSet {
  private mat: THREE.MeshStandardMaterial;
  constructor(scene: THREE.Scene, colorHex: string) {
    super(scene);
    const c = new THREE.Color(colorHex);
    this.mat = new THREE.MeshStandardMaterial({ color: c.getHex() === 0xffffff ? 0xc0c2c6 : c, metalness: 1, roughness: 0.3, side: THREE.DoubleSide });
  }
  public drop(lip: THREE.Vector3, target: VesselBundle | null) {
    const m = new THREE.Mesh(getRibbonGeo(), this.mat);
    const s = target ? Math.min(1, (target.profile.rimInnerRadius * 2 - 0.4) / 5) : 0.6;
    m.scale.setScalar(Math.max(0.35, s));
    m.position.copy(lip);
    m.castShadow = true;
    m.raycast = () => {};
    m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    this.scene.add(m);
    this.live.push({ m, v: 0, spin: new THREE.Vector3(2 + Math.random() * 3, 1 + Math.random() * 2, 0) });
  }
  protected onLand(f: Faller, target: VesselBundle | null) {
    if (!target) return;
    const lp = target.glassRoot.worldToLocal(f.m.position.clone());
    target.effects.splashAt(lp.x, lp.z, new THREE.Color(target.getLiquidColorHex()), 8, 0.8);
  }
  protected release() {
    /* geometry + material are shared / disposed with the set */
  }
  public dispose() {
    super.dispose();
    this.mat.dispose();
  }
}

/** Single falling drops from a pipette tip. */
export class DropFall extends FallerSet {
  private mat: THREE.MeshPhysicalMaterial;
  private col: THREE.Color;
  constructor(scene: THREE.Scene, colorHex: string) {
    super(scene);
    dropGeo ??= new THREE.SphereGeometry(0.23, 14, 10);
    this.col = new THREE.Color(colorHex);
    const lum = this.col.r * 0.3 + this.col.g * 0.59 + this.col.b * 0.11;
    this.mat = new THREE.MeshPhysicalMaterial({
      color: lum > 0.82 ? 0xeef6fb : this.col,
      roughness: 0.03,
      transparent: true,
      opacity: lum > 0.82 ? 0.45 : 0.85,
      envMapIntensity: 2,
      depthWrite: false,
    });
  }
  public drop(tip: THREE.Vector3) {
    const m = new THREE.Mesh(dropGeo!, this.mat);
    m.position.copy(tip);
    m.raycast = () => {};
    this.scene.add(m);
    this.live.push({ m, v: 0, spin: new THREE.Vector3() });
  }
  protected onLand(f: Faller, target: VesselBundle | null) {
    if (!target) return;
    const lp = target.glassRoot.worldToLocal(f.m.position.clone());
    target.effects.splashAt(lp.x, lp.z, this.col, 3, 0.4);
  }
  protected release() {
    /* shared geometry */
  }
  public update(dt: number, time: number, target: VesselBundle | null) {
    super.update(dt, time, target);
    for (const f of this.live) f.m.scale.set(1, 1 + Math.min(0.5, f.v / 400), 1);
  }
  public dispose() {
    super.dispose();
    this.mat.dispose();
  }
}
