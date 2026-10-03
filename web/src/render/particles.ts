import * as THREE from 'three';

/** Shared projection scale for world-sized point sprites (pixels per unit at distance 1). Updated on resize. */
export const pointScale = { value: 800 };

export function setParticleViewport(heightPx: number, fovDeg: number) {
  pointScale.value = heightPx / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2));
}

/**
 * Pool of world-sized soft sprites with per-particle size / alpha / colour, simple physics and an optional
 * per-particle behaviour hook. Dead particles are swap-removed; buffers are allocated once.
 */
export class SpriteParticles {
  public points: THREE.Points;
  public readonly cap: number;
  public live = 0;
  // state
  public pos: Float32Array;
  public vel: Float32Array;
  public col: Float32Array;
  public life: Float32Array;
  public maxLife: Float32Array;
  public size0: Float32Array;
  public size1: Float32Array;
  public alpha: Float32Array;
  public gravity: Float32Array;
  public drag: Float32Array;
  public kind: Uint8Array;
  public seed: Float32Array;
  // render attributes
  private aSize: Float32Array;
  private aAlpha: Float32Array;
  private geo: THREE.BufferGeometry;
  private material: THREE.ShaderMaterial;
  /** fade-in fraction of life */
  public fadeIn = 0.15;
  /** Called for each live particle before integration; return false to kill it. */
  public behaviour?: (i: number, dt: number) => boolean;

  /** `minPx`: smallest on-screen sprite diameter (device px); keeps tiny world-sized grains from vanishing at bench distance. */
  constructor(cap: number, map: THREE.Texture, opts: { additive?: boolean; renderOrder?: number; minPx?: number } = {}) {
    this.cap = cap;
    this.pos = new Float32Array(cap * 3);
    this.vel = new Float32Array(cap * 3);
    this.col = new Float32Array(cap * 3);
    this.life = new Float32Array(cap);
    this.maxLife = new Float32Array(cap);
    this.size0 = new Float32Array(cap);
    this.size1 = new Float32Array(cap);
    this.alpha = new Float32Array(cap);
    this.gravity = new Float32Array(cap);
    this.drag = new Float32Array(cap);
    this.kind = new Uint8Array(cap);
    this.seed = new Float32Array(cap);
    this.aSize = new Float32Array(cap);
    this.aAlpha = new Float32Array(cap);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.aSize, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.aAlpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setDrawRange(0, 0);
    this.geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.material = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: map }, uScale: pointScale, uMinPx: { value: opts.minPx ?? 0 } },
      vertexShader: /* glsl */ `
        attribute float aSize;
        attribute float aAlpha;
        attribute vec3 aColor;
        uniform float uScale;
        uniform float uMinPx;
        varying float vA;
        varying vec3 vC;
        void main() {
          vec4 mv = modelViewMatrix * vec4( position, 1.0 );
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp( max( aSize * uScale / max( -mv.z, 0.1 ), uMinPx ), 0.0, 512.0 );
          vA = aAlpha;
          vC = aColor;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        varying float vA;
        varying vec3 vC;
        void main() {
          vec4 t = texture2D( uMap, gl_PointCoord );
          float a = t.a * vA;
          if ( a < 0.003 ) discard;
          gl_FragColor = vec4( vC * t.rgb, a );
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = opts.renderOrder ?? 4;
    this.points.raycast = () => {};
    this.points.visible = false;
  }

  /** Spawn one particle; returns its index or -1 if full. */
  public spawn(
    x: number, y: number, z: number,
    vx: number, vy: number, vz: number,
    life: number, s0: number, s1: number, alpha: number,
    r: number, g: number, b: number,
    gravity = 0, drag = 0, kind = 0
  ): number {
    if (this.live >= this.cap) return -1;
    const i = this.live++;
    const i3 = i * 3;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.col[i3] = r; this.col[i3 + 1] = g; this.col[i3 + 2] = b;
    this.life[i] = 0;
    this.maxLife[i] = life;
    this.size0[i] = s0;
    this.size1[i] = s1;
    this.alpha[i] = alpha;
    this.gravity[i] = gravity;
    this.drag[i] = drag;
    this.kind[i] = kind;
    this.seed[i] = Math.random() * 100;
    return i;
  }

  private kill(i: number) {
    const j = --this.live;
    if (i === j) return;
    const i3 = i * 3;
    const j3 = j * 3;
    for (let k = 0; k < 3; k++) {
      this.pos[i3 + k] = this.pos[j3 + k];
      this.vel[i3 + k] = this.vel[j3 + k];
      this.col[i3 + k] = this.col[j3 + k];
    }
    this.life[i] = this.life[j];
    this.maxLife[i] = this.maxLife[j];
    this.size0[i] = this.size0[j];
    this.size1[i] = this.size1[j];
    this.alpha[i] = this.alpha[j];
    this.gravity[i] = this.gravity[j];
    this.drag[i] = this.drag[j];
    this.kind[i] = this.kind[j];
    this.seed[i] = this.seed[j];
  }

  public clear() {
    this.live = 0;
  }

  public update(dt: number) {
    let i = 0;
    while (i < this.live) {
      this.life[i] += dt;
      if (this.life[i] >= this.maxLife[i] || (this.behaviour && !this.behaviour(i, dt))) {
        this.kill(i);
        continue;
      }
      const i3 = i * 3;
      this.vel[i3 + 1] -= this.gravity[i] * dt;
      const dr = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i3] *= dr;
      this.vel[i3 + 1] *= dr;
      this.vel[i3 + 2] *= dr;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      const t = this.life[i] / this.maxLife[i];
      this.aSize[i] = this.size0[i] + (this.size1[i] - this.size0[i]) * t;
      const fin = this.fadeIn > 0 ? Math.min(1, t / this.fadeIn) : 1;
      const fout = Math.min(1, (1 - t) / 0.35);
      this.aAlpha[i] = this.alpha[i] * fin * fout;
      i++;
    }
    this.geo.setDrawRange(0, this.live);
    this.points.visible = this.live > 0;
    if (this.live > 0) {
      (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (this.geo.attributes.aColor as THREE.BufferAttribute).needsUpdate = true;
      (this.geo.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
      (this.geo.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  public setRenderOrder(n: number) {
    this.points.renderOrder = n;
  }

  public dispose() {
    this.geo.dispose();
    this.material.dispose();
  }
}

// ------------------------------------------------------------------ bubbles
let bubbleGeo: THREE.BufferGeometry | null = null;
function sharedBubbleGeo(): THREE.BufferGeometry {
  if (!bubbleGeo) bubbleGeo = new THREE.IcosahedronGeometry(1, 2);
  return bubbleGeo;
}

/** Fresnel bubble material (bright rim, clear centre, specular glint). `uTint` lets bubbles pick up liquid colour. */
export function makeBubbleMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTint: { value: new THREE.Color(1, 1, 1) }, uOpacity: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec4 p = vec4( position, 1.0 );
        vec3 n = normal;
        #ifdef USE_INSTANCING
          p = instanceMatrix * p;
          n = mat3( instanceMatrix ) * n;
        #endif
        vec4 mv = modelViewMatrix * p;
        vN = normalize( normalMatrix * n );
        vV = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTint;
      uniform float uOpacity;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec3 n = normalize( vN );
        vec3 v = normalize( vV );
        float nv = abs( dot( n, v ) );
        float rim = pow( 1.0 - nv, 2.2 );
        vec3 l = normalize( vec3( 0.35, 0.85, 0.4 ) );
        float spec = pow( max( dot( reflect( -v, n ), l ), 0.0 ), 60.0 );
        float a = clamp( 0.04 + rim * 0.85 + spec * 0.9, 0.0, 1.0 ) * uOpacity;
        vec3 c = mix( uTint * 0.9, vec3( 1.0 ), 0.55 + spec * 0.45 );
        gl_FragColor = vec4( c, a );
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
  });
}

/**
 * Instanced bubble swarm. Positions in the owner's local frame; each bubble has its own rise speed, wobble and
 * growth. The owner decides where to spawn (bulk / wall / solid) and the surface height where they pop.
 */
export class BubbleSystem {
  public mesh: THREE.InstancedMesh;
  public material: THREE.ShaderMaterial;
  public readonly cap: number;
  public live = 0;
  private p: Float32Array;
  private v: Float32Array;
  private r: Float32Array;
  private wob: Float32Array;
  private age: Float32Array;
  private squash: Float32Array;
  /** Per-bubble relative radius growth per second (vapour bubbles of a boiling liquid grow as they rise). */
  private grow: Float32Array;
  private rMax: Float32Array;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private t = new THREE.Vector3();

  constructor(cap: number) {
    this.cap = cap;
    this.material = makeBubbleMaterial();
    this.mesh = new THREE.InstancedMesh(sharedBubbleGeo(), this.material, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    this.mesh.raycast = () => {};
    this.mesh.visible = false;
    this.p = new Float32Array(cap * 3);
    this.v = new Float32Array(cap);
    this.r = new Float32Array(cap);
    this.wob = new Float32Array(cap);
    this.age = new Float32Array(cap);
    this.squash = new Float32Array(cap);
    this.grow = new Float32Array(cap);
    this.rMax = new Float32Array(cap);
  }

  /**
   * radius in cm, rise speed in cm/s, squash>0 for big irregular vapour bubbles, `growth` the relative radius growth
   * per second up to `maxRadius` (0 = only the slight hydrostatic expansion).
   */
  public spawn(x: number, y: number, z: number, radius: number, speed: number, squash = 0, growth = 0, maxRadius = 0) {
    if (this.live >= this.cap) return;
    const i = this.live++;
    this.p[i * 3] = x;
    this.p[i * 3 + 1] = y;
    this.p[i * 3 + 2] = z;
    this.r[i] = radius;
    this.v[i] = speed;
    this.wob[i] = Math.random() * 6.28;
    this.age[i] = 0;
    this.squash[i] = squash;
    this.grow[i] = growth;
    this.rMax[i] = maxRadius > radius ? maxRadius : radius * 2;
  }

  private kill(i: number) {
    const j = --this.live;
    if (i === j) return;
    this.p[i * 3] = this.p[j * 3];
    this.p[i * 3 + 1] = this.p[j * 3 + 1];
    this.p[i * 3 + 2] = this.p[j * 3 + 2];
    this.r[i] = this.r[j];
    this.v[i] = this.v[j];
    this.wob[i] = this.wob[j];
    this.age[i] = this.age[j];
    this.squash[i] = this.squash[j];
    this.grow[i] = this.grow[j];
    this.rMax[i] = this.rMax[j];
  }

  public clear() {
    this.live = 0;
    this.mesh.count = 0;
    this.mesh.visible = false;
  }

  /**
   * Advance; `surfaceY(x,z)` is the local free surface height and `radiusAt(y)` the inner wall radius.
   * `onPop(x,y,z,r)` is called when a bubble reaches the surface.
   */
  public update(
    dt: number,
    surfaceY: number,
    radiusAt: (y: number) => number,
    swirl: number,
    onPop: (x: number, y: number, z: number, r: number) => void
  ) {
    let i = 0;
    while (i < this.live) {
      const i3 = i * 3;
      this.age[i] += dt;
      const accel = Math.min(1, this.age[i] / 0.12);
      const vy = this.v[i] * accel;
      let x = this.p[i3];
      let y = this.p[i3 + 1] + vy * dt;
      let z = this.p[i3 + 2];
      const w = this.wob[i] + this.age[i] * (9 + this.r[i] * 20);
      const amp = 0.25 * this.r[i] + 0.02;
      x += Math.cos(w) * amp * dt * 6;
      z += Math.sin(w * 1.3) * amp * dt * 6;
      if (swirl !== 0) {
        const c = Math.cos(swirl * dt);
        const s = Math.sin(swirl * dt);
        const nx = x * c - z * s;
        z = x * s + z * c;
        x = nx;
      }
      // grow slightly as hydrostatic pressure drops
      this.r[i] = Math.min(this.rMax[i], this.r[i] * (1 + dt * (0.04 + this.grow[i])));
      const wallR = Math.max(0.05, radiusAt(y) - this.r[i]);
      const rr = Math.hypot(x, z);
      if (rr > wallR) {
        x *= wallR / rr;
        z *= wallR / rr;
      }
      if (y + this.r[i] * 0.3 >= surfaceY) {
        onPop(x, surfaceY, z, this.r[i]);
        this.kill(i);
        continue;
      }
      this.p[i3] = x;
      this.p[i3 + 1] = y;
      this.p[i3 + 2] = z;
      const r = this.r[i];
      const sq = this.squash[i];
      if (sq > 0) {
        const f = Math.sin(this.age[i] * 14 + this.wob[i]) * 0.18 * sq;
        this.s.set(r * (1.15 + f), r * (0.8 - f), r * (1.1 - f * 0.5));
      } else {
        this.s.set(r, r * 0.92, r);
      }
      this.t.set(x, y, z);
      this.m.compose(this.t, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
      i++;
    }
    this.mesh.count = this.live;
    this.mesh.visible = this.live > 0;
    if (this.live > 0) this.mesh.instanceMatrix.needsUpdate = true;
  }

  public setRenderOrder(n: number) {
    this.mesh.renderOrder = n;
  }

  public dispose() {
    this.material.dispose();
    this.mesh.dispose();
  }
}
