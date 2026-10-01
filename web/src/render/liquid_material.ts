import * as THREE from 'three';
import { LiquidLayer, OpticsTables } from '../types/sim';
import { computeSpectralColor } from './liquid_shader';
import { VesselProfile, heightForVolume, innerRadiusAt } from './glass_profiles';

/**
 * Volumetric-looking liquid for a lathe vessel.
 *
 * Two passes share one uniform block:
 *   1. "absorb" pass (multiplicative blend): the frame buffer behind the liquid is multiplied by the per-channel
 *      Beer–Lambert transmittance exp(-k·L) along the actual view-ray chord through the liquid (analytic ray/cone
 *      intersection per pixel), layer by layer (immiscible layers have their own k).
 *   2. "surface" pass (additive, MeshPhysicalMaterial): environment reflections of the surface (meniscus,
 *      ripples, vortex), plus light in-scattered by suspended solids (turbidity -> milky/cloudy look).
 * Geometry is static per vessel type; the fill line is a uniform (side wall fragments above the surface are
 * discarded, the surface disc is displaced in the vertex shader). Nothing is allocated per tick.
 */

export const MAX_LAYERS = 4;

const GLSL_COMMON = /* glsl */ `
uniform float uFill;
uniform float uYb;
uniform float uR;
uniform float uConeA;
uniform float uConeB;
uniform float uTime;
uniform float uRipple;
uniform float uVortex;
uniform float uMeniscus;
uniform float uTopClamp;
uniform vec2 uSlosh;
uniform vec3 uUpObj;
uniform vec4 uImpact;
uniform int uLayerCount;
uniform float uLayerTop[${MAX_LAYERS}];
uniform vec3 uKOld[${MAX_LAYERS}];
uniform vec3 uKNew[${MAX_LAYERS}];
uniform vec4 uScat[${MAX_LAYERS}];
uniform float uMix;

float lqSurf( vec2 xz ) {
  float rr = length( xz );
  float r = rr / max( uR, 1e-3 );
  float h = 0.0;
  // free-surface tilt so the surface stays level in world space while the vessel tilts
  vec3 up = uUpObj;
  h += -( up.x * xz.x + up.z * xz.y ) / max( up.y, 0.3 );
  h += dot( uSlosh, xz );
  // meniscus (water wets glass): rises ~1 mm within ~1.5 mm of the wall
  h += uMeniscus * exp( -max( uR - rr, 0.0 ) / 0.13 );
  // stirring vortex (Rankine-like), roughly volume-neutral
  h += uVortex * ( 0.3 - 1.0 / ( 1.0 + 9.0 * r * r ) );
  // ripples
  float t = uTime;
  h += uRipple * (
      0.45 * sin( xz.x * 3.1 + t * 2.3 ) * sin( xz.y * 2.7 - t * 1.9 )
    + 0.30 * sin( rr * 5.0 - t * 4.2 )
    + 0.25 * sin( ( xz.x - xz.y ) * 7.3 + t * 5.7 ) );
  // impact ring from pours / drops
  float age = t - uImpact.z;
  if ( age > 0.0 && age < 2.5 ) {
    float d = distance( xz, uImpact.xy );
    float ring = d - age * 9.0;
    h += uImpact.w * sin( ring * 5.0 ) * exp( -ring * ring * 1.5 ) * exp( -age * 1.8 ) * 0.12;
  }
  return h;
}

float lqSurfY( vec2 xz ) {
  return min( uFill + lqSurf( xz ), uTopClamp );
}
`;

const GLSL_VERTEX_DISPLACE = /* glsl */ `
attribute float aTop;
varying vec3 vObj;
varying vec3 vRay;
varying float vTop;
vec3 lqDisplace( vec3 p, out vec3 n ) {
  if ( aTop > 0.5 ) {
    vec2 xz = p.xz * uR;
    float h0 = lqSurf( xz );
    float e = 0.05 * uR + 0.02;
    float hx = lqSurf( xz + vec2( e, 0.0 ) );
    float hz = lqSurf( xz + vec2( 0.0, e ) );
    n = normalize( vec3( -( hx - h0 ) / e, 1.0, -( hz - h0 ) / e ) );
    return vec3( xz.x, min( uFill + h0, uTopClamp ), xz.y );
  }
  n = normal;
  return p;
}
`;

const GLSL_FRAGMENT_OPTICS = /* glsl */ `
varying vec3 vObj;
varying vec3 vRay;
varying float vTop;

float lqExit( vec3 p, vec3 d ) {
  float A = uConeA;
  float B = uConeB;
  float ry = A + B * p.y;
  float a = d.x * d.x + d.z * d.z - B * B * d.y * d.y;
  float b = 2.0 * ( p.x * d.x + p.z * d.z - B * d.y * ry );
  float c = p.x * p.x + p.z * p.z - ry * ry;
  float t = 1e4;
  if ( abs( a ) > 1e-6 ) {
    float disc = b * b - 4.0 * a * c;
    if ( disc > 0.0 ) {
      float s = sqrt( disc );
      float t1 = ( -b - s ) / ( 2.0 * a );
      float t2 = ( -b + s ) / ( 2.0 * a );
      float tn = min( t1, t2 );
      float tf = max( t1, t2 );
      // The wall fragment sits ON the real wall, which the fitted cone only approximates (round tube bottoms, shoulders),
      // so p can be a hair outside the cone and the near root is a spurious re-entry: always leave through the far root.
      // (Taking the nearest positive root made most of a test tube's liquid optically clear.)
      if ( a > 0.0 ) {
        if ( tf > 0.02 ) t = tf;
      } else {
        if ( tn > 0.02 ) t = tn;
        else if ( tf > 0.02 ) t = tf;
      }
    }
  }
  if ( d.y < -1e-4 ) t = min( t, ( uYb - p.y ) / d.y );
  if ( d.y > 1e-4 ) t = min( t, ( uFill - p.y ) / d.y );
  return clamp( t, 0.0, 4.0 * uR + ( uFill - uYb ) + 1.0 );
}

float lqSeg( vec3 p, vec3 d, float tExit, float lo, float hi ) {
  if ( abs( d.y ) < 1e-4 ) return ( p.y >= lo && p.y <= hi ) ? tExit : 0.0;
  float t0 = ( lo - p.y ) / d.y;
  float t1 = ( hi - p.y ) / d.y;
  float tmin = max( min( t0, t1 ), 0.0 );
  float tmax = min( max( t0, t1 ), tExit );
  return max( tmax - tmin, 0.0 );
}

// returns extinction optical depth (rgb) and writes in-scatter colour weight
vec3 lqOptics( out vec3 scatterCol, out float scatterAmt ) {
  vec3 p = vObj;
  vec3 d = normalize( vRay );
  float tExit = lqExit( p, d );
  float swirl = 0.5 + 0.5 * sin( p.x * 1.7 + sin( p.y * 2.1 + uTime * 1.3 ) * 1.6 + p.z * 1.3 - uTime * 0.7 );
  float depthN = ( uFill - p.y ) / max( uFill - uYb, 0.5 );
  float m = uMix >= 0.999 ? 1.0 : clamp( ( uMix * 1.45 - depthN * 0.6 - 0.2 + ( swirl - 0.5 ) * 0.55 ) * 3.0, 0.0, 1.0 );
  vec3 od = vec3( 0.0 );
  float sod = 0.0;
  scatterCol = vec3( 0.0 );
  scatterAmt = 0.0;
  float lo = -1e3;
  for ( int i = 0; i < ${MAX_LAYERS}; i++ ) {
    if ( i >= uLayerCount ) break;
    float hi = ( i == uLayerCount - 1 ) ? 1e3 : uLayerTop[ i ];
    float len = lqSeg( p, d, tExit, lo, hi );
    vec3 k = mix( uKOld[ i ], uKNew[ i ], m );
    float s = uScat[ i ].w;
    float before = exp( -sod );
    float added = before * ( 1.0 - exp( -s * len ) );
    // scattered light is itself tinted by the dissolved absorber over ~1 cm
    scatterCol += uScat[ i ].rgb * exp( -k * 0.6 ) * added;
    scatterAmt += added;
    od += k * len;
    sod += s * len;
    lo = hi;
  }
  // Even "clear" water is not invisible: a blue-green absorption over the chord (plus ~1 cm of "free" path so thin
  // films still read) gives the liquid body a readable tint at bench distance, without any per-reagent data.
  od += vec3( 0.09, 0.05, 0.026 ) * ( 1.0 + min( tExit, 6.0 ) );
  return od + vec3( sod );
}
`;

// ------------------------------------------------------------------ geometry
const sideGeoCache = new Map<string, THREE.BufferGeometry>();
let discGeo: THREE.BufferGeometry | null = null;

function sideGeometry(p: VesselProfile): THREE.BufferGeometry {
  let g = sideGeoCache.get(p.type);
  if (g) return g;
  // inner cavity shrunk by a hair so it never z-fights the glass
  const pts = p.inner.map((q) => new THREE.Vector2(Math.max(0, q.x - 0.02), q.y + 0.005));
  g = new THREE.LatheGeometry(pts, 64);
  const n = g.attributes.position.count;
  g.setAttribute('aTop', new THREE.BufferAttribute(new Float32Array(n), 1));
  sideGeoCache.set(p.type, g);
  return g;
}

function surfaceDisc(): THREE.BufferGeometry {
  if (discGeo) return discGeo;
  const rings = 22;
  const segs = 72;
  const pos: number[] = [];
  const nor: number[] = [];
  const top: number[] = [];
  const idx: number[] = [];
  pos.push(0, 0, 0);
  nor.push(0, 1, 0);
  top.push(1);
  for (let j = 1; j <= rings; j++) {
    const u = j / rings;
    const r = Math.min(0.995, 1 - Math.pow(1 - u, 1.7));
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      pos.push(Math.cos(a) * r, 0, Math.sin(a) * r);
      nor.push(0, 1, 0);
      top.push(1);
    }
  }
  for (let i = 0; i < segs; i++) idx.push(0, 1 + ((i + 1) % segs), 1 + i);
  for (let j = 1; j < rings; j++) {
    const a0 = 1 + (j - 1) * segs;
    const a1 = 1 + j * segs;
    for (let i = 0; i < segs; i++) {
      const i1 = (i + 1) % segs;
      idx.push(a0 + i, a0 + i1, a1 + i);
      idx.push(a0 + i1, a1 + i1, a1 + i);
    }
  }
  discGeo = new THREE.BufferGeometry();
  discGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  discGeo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  discGeo.setAttribute('aTop', new THREE.Float32BufferAttribute(top, 1));
  discGeo.setIndex(idx);
  discGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
  return discGeo;
}

// ------------------------------------------------------------------ uniforms
type U<T> = { value: T };
export interface LiquidUniforms {
  [k: string]: U<unknown>;
  uFill: U<number>;
  uYb: U<number>;
  uR: U<number>;
  uConeA: U<number>;
  uConeB: U<number>;
  uTime: U<number>;
  uRipple: U<number>;
  uVortex: U<number>;
  uMeniscus: U<number>;
  uTopClamp: U<number>;
  uSlosh: U<THREE.Vector2>;
  uUpObj: U<THREE.Vector3>;
  uImpact: U<THREE.Vector4>;
  uLayerCount: U<number>;
  uLayerTop: U<number[]>;
  uKOld: U<THREE.Vector3[]>;
  uKNew: U<THREE.Vector3[]>;
  uScat: U<THREE.Vector4[]>;
  uMix: U<number>;
}

function makeUniforms(): LiquidUniforms {
  const v3 = () => Array.from({ length: MAX_LAYERS }, () => new THREE.Vector3());
  return {
    uFill: { value: 0 },
    uYb: { value: 0 },
    uR: { value: 1 },
    uConeA: { value: 1 },
    uConeB: { value: 0 },
    uTime: { value: 0 },
    uRipple: { value: 0.004 },
    uVortex: { value: 0 },
    uMeniscus: { value: 0.09 },
    uTopClamp: { value: 100 },
    uSlosh: { value: new THREE.Vector2() },
    uUpObj: { value: new THREE.Vector3(0, 1, 0) },
    uImpact: { value: new THREE.Vector4(0, 0, -100, 0) },
    uLayerCount: { value: 1 },
    uLayerTop: { value: new Array(MAX_LAYERS).fill(0) },
    uKOld: { value: v3() },
    uKNew: { value: v3() },
    uScat: { value: Array.from({ length: MAX_LAYERS }, () => new THREE.Vector4(1, 1, 1, 0)) },
    uMix: { value: 1 },
  };
}

function makeAbsorbMaterial(u: LiquidUniforms): THREE.ShaderMaterial {
  const m = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: `
      ${GLSL_COMMON}
      ${GLSL_VERTEX_DISPLACE}
      void main() {
        vec3 n;
        vec3 p = lqDisplace( position, n );
        vObj = p;
        vTop = aTop;
        vec3 camObj = ( inverse( modelMatrix ) * vec4( cameraPosition, 1.0 ) ).xyz;
        vRay = p - camObj;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( p, 1.0 );
      }`,
    fragmentShader: `
      ${GLSL_COMMON}
      ${GLSL_FRAGMENT_OPTICS}
      void main() {
        if ( vTop < 0.5 && vObj.y > lqSurfY( vObj.xz ) ) discard;
        vec3 sc; float sa;
        vec3 od = lqOptics( sc, sa );
        vec3 T = exp( -od );
        if ( vTop < 0.5 ) {
          // refraction hint: a liquid column bends light away at its silhouette, so edges read darker
          vec3 nrm = normalize( vec3( vObj.x, 0.0, vObj.z ) + vec3( 1e-4 ) );
          float edge = 1.0 - abs( dot( nrm, normalize( vRay ) ) );
          T *= mix( 1.0, 0.45, pow( edge, 2.2 ) );
        }
        gl_FragColor = vec4( pow( T, vec3( 1.0 / 2.2 ) ), 1.0 );
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
  });
  m.blending = THREE.CustomBlending;
  m.blendEquation = THREE.AddEquation;
  m.blendSrc = THREE.ZeroFactor;
  m.blendDst = THREE.SrcColorFactor;
  m.blendSrcAlpha = THREE.ZeroFactor;
  m.blendDstAlpha = THREE.OneFactor;
  m.toneMapped = false;
  return m;
}

function makeSurfaceMaterial(u: LiquidUniforms): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.035,
    metalness: 0,
    ior: 1.333,
    specularIntensity: 0.65,
    envMapIntensity: 0.55,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
  });
  m.blending = THREE.CustomBlending;
  m.blendEquation = THREE.AddEquation;
  m.blendSrc = THREE.OneFactor;
  m.blendDst = THREE.OneFactor;
  m.blendSrcAlpha = THREE.ZeroFactor;
  m.blendDstAlpha = THREE.OneFactor;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${GLSL_COMMON}\n${GLSL_VERTEX_DISPLACE}`)
      .replace(
        '#include <beginnormal_vertex>',
        `vec3 lqN;
        vec3 lqP = lqDisplace( position, lqN );
        vec3 objectNormal = lqN;
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3( tangent.xyz );
        #endif`
      )
      .replace(
        '#include <begin_vertex>',
        `vec3 transformed = lqP;
        vObj = lqP;
        vTop = aTop;
        vRay = lqP - ( inverse( modelMatrix ) * vec4( cameraPosition, 1.0 ) ).xyz;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL_COMMON}\n${GLSL_FRAGMENT_OPTICS}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float lqSY = lqSurfY( vObj.xz );
        if ( vTop < 0.5 && vObj.y > lqSY ) discard;
        vec3 lqSc; float lqSa;
        vec3 lqOd = lqOptics( lqSc, lqSa );
        diffuseColor.rgb = lqSa > 1e-4 ? lqSc / lqSa : vec3( 1.0 );`
      )
      .replace(
        '#include <opaque_fragment>',
        `{
          vec3 lqSpec = max( outgoingLight - totalDiffuse, vec3( 0.0 ) );
          float specScale = vTop > 0.5 ? 1.0 : 0.35;
          float iface = 0.0;
          if ( vTop < 0.5 ) {
            for ( int i = 0; i < ${MAX_LAYERS - 1}; i++ ) {
              if ( i >= uLayerCount - 1 ) break;
              iface = max( iface, 1.0 - smoothstep( 0.0, 0.08, abs( vObj.y - uLayerTop[ i ] ) ) );
            }
          }
          // bright meniscus line just under the free surface + a faint sheen on the surface disc itself
          float lqLine = vTop < 0.5 ? 1.0 - smoothstep( 0.0, 0.16, lqSY - vObj.y ) : 0.0;
          // free surface: faint sheen + a bright meniscus ring where it meets the wall (outlines the level from any angle)
          float lqRing = vTop > 0.5 ? smoothstep( 0.86, 0.995, length( vObj.xz ) / max( uR, 1e-3 ) ) : 0.0;
          vec3 lqBase = vTop > 0.5 ? vec3( 0.03, 0.034, 0.038 ) + vec3( 0.07, 0.075, 0.08 ) * lqRing : vec3( 0.0 );
          gl_FragColor = vec4( totalDiffuse * lqSa * 1.1 + lqSpec * specScale + vec3( 0.16 ) * iface + vec3( 0.34, 0.36, 0.38 ) * lqLine + lqBase, 1.0 );
        }`
      );
  };
  m.customProgramCacheKey = () => 'liquid_surface_v3';
  return m;
}

// ------------------------------------------------------------------ helpers
const tmpV = new THREE.Vector3();
const tmpM = new THREE.Matrix4();

function linearToHex(r: number, g: number, b: number): string {
  const c = new THREE.Color().setRGB(
    Math.min(1, Math.max(0, r)),
    Math.min(1, Math.max(0, g)),
    Math.min(1, Math.max(0, b)),
    THREE.LinearSRGBColorSpace
  );
  return '#' + c.getHexString(THREE.SRGBColorSpace);
}

interface LayerTarget {
  topMl: number; // cumulative volume at the layer's top
  k: THREE.Vector3;
  scat: THREE.Vector4;
}

/**
 * Liquid body for one vessel. `root` holds four meshes (absorb/surface × side/top). All in the glass-local frame.
 */
export class LiquidBody {
  public root = new THREE.Group();
  public sideAbsorb: THREE.Mesh;
  private sideSurface: THREE.Mesh;
  private topAbsorb: THREE.Mesh;
  private topSurface: THREE.Mesh;
  public uniforms: LiquidUniforms;
  private absorbMat: THREE.ShaderMaterial;
  private surfaceMat: THREE.MeshPhysicalMaterial;

  /** Reference chord length (cm) at which spectral colour is evaluated to derive k. */
  private Lref: number;
  private targetCount = 1;
  private targets: LayerTarget[] = Array.from({ length: MAX_LAYERS }, () => ({
    topMl: 0,
    k: new THREE.Vector3(),
    scat: new THREE.Vector4(1, 1, 1, 0),
  }));
  private curTopMl: number[] = new Array(MAX_LAYERS).fill(0);
  private totalMlTarget = 0;
  private totalMl = 0;
  private mixing = false;
  private rippleBase = 0.004;
  private boil = 0;
  private gasAgitation = 0;
  private stirRpm = 0;
  private vortexCur = 0;
  private sloshAmp = 0;
  private sloshPhase = 0;
  private sloshDir = new THREE.Vector2(1, 0);
  private _fillY: number;
  private apparent = '#f4f8fb';

  constructor(public profile: VesselProfile) {
    this.uniforms = makeUniforms();
    this.uniforms.uYb.value = profile.innerBottomY;
    this.uniforms.uTopClamp.value = profile.innerTopY - 0.05;
    this._fillY = profile.innerBottomY;
    this.Lref = Math.max(1.0, 2 * innerRadiusAt(profile, profile.innerBottomY + 1.0) * 0.8);
    this.absorbMat = makeAbsorbMaterial(this.uniforms);
    this.surfaceMat = makeSurfaceMaterial(this.uniforms);
    const side = sideGeometry(profile);
    const disc = surfaceDisc();
    this.sideAbsorb = new THREE.Mesh(side, this.absorbMat);
    this.sideSurface = new THREE.Mesh(side, this.surfaceMat);
    this.topAbsorb = new THREE.Mesh(disc, this.absorbMat);
    this.topSurface = new THREE.Mesh(disc, this.surfaceMat);
    for (const m of [this.sideAbsorb, this.sideSurface, this.topAbsorb, this.topSurface]) {
      m.frustumCulled = false;
      m.raycast = () => {};
    }
    // sideAbsorb is the public "liquidMesh"; the other three ride along as children.
    this.sideAbsorb.add(this.sideSurface, this.topAbsorb, this.topSurface);
    this.root.add(this.sideAbsorb);
    this.setRenderOrderBase(0);
    this.sideAbsorb.visible = false;
  }

  public setRenderOrderBase(base: number) {
    this.sideAbsorb.renderOrder = base + 2;
    this.topAbsorb.renderOrder = base + 2;
    this.sideSurface.renderOrder = base + 3;
    this.topSurface.renderOrder = base + 3;
  }

  get fillY(): number {
    return this._fillY;
  }
  get volumeMl(): number {
    return this.totalMl;
  }
  get surfaceRadius(): number {
    return this.uniforms.uR.value;
  }

  /** Engine-driven update (20 Hz). */
  public setLayers(layers: LiquidLayer[], totalMl: number, optics: OpticsTables | null) {
    if (!(totalMl >= 0) || !isFinite(totalMl)) totalMl = 0; // NaN / negative volume must never reach the shader
    const n = Math.min(MAX_LAYERS, layers.length);
    const sumLayers = layers.reduce((s, l) => s + Math.max(0, l.volume_ml || 0), 0);
    const scale = sumLayers > 0 ? totalMl / sumLayers : 1;
    let acc = 0;
    let bigChange = n !== this.targetCount;
    for (let i = 0; i < n; i++) {
      const L = layers[i];
      acc += Math.max(0, L.volume_ml || 0) * scale;
      const t = this.targets[i];
      t.topMl = acc;
      const T = computeSpectralColor(optics, L.absorbance_per_cm ?? [], this.Lref);
      const kx = -Math.log(Math.max(T[0], 1e-3)) / this.Lref;
      const ky = -Math.log(Math.max(T[1], 1e-3)) / this.Lref;
      const kz = -Math.log(Math.max(T[2], 1e-3)) / this.Lref;
      if (this.kChange(t.k, kx, ky, kz)) bigChange = true;
      t.k.set(kx, ky, kz);
      const sc = L.scatter_rgb ?? [1, 1, 1];
      t.scat.set(sc[0], sc[1], sc[2], Math.max(0, L.scatter_per_cm || 0));
    }
    if (n === 0) {
      this.targets[0].topMl = totalMl; // volume with no layer data: render it as clear liquid
      this.targets[0].k.set(0, 0, 0);
      this.targets[0].scat.set(1, 1, 1, 0);
    }
    this.commitTargets(Math.max(1, n), totalMl, bigChange);
  }

  /** Fallback (non-engine) update: colour is the apparent colour at the reference path, opacity = strength. */
  public setSimple(volMl: number, colorHex: string, opacity = 0.85) {
    const c = new THREE.Color(colorHex);
    const strength = Math.max(0, Math.min(1, opacity));
    const kx = (-Math.log(Math.max(c.r, 0.02)) / this.Lref) * strength;
    const ky = (-Math.log(Math.max(c.g, 0.02)) / this.Lref) * strength;
    const kz = (-Math.log(Math.max(c.b, 0.02)) / this.Lref) * strength;
    const t = this.targets[0];
    const big = this.kChange(t.k, kx, ky, kz);
    t.k.set(kx, ky, kz);
    t.scat.set(1, 1, 1, 0);
    t.topMl = volMl;
    this.commitTargets(1, volMl, big);
  }

  private kChange(old: THREE.Vector3, x: number, y: number, z: number): boolean {
    const d = Math.max(Math.abs(old.x - x), Math.abs(old.y - y), Math.abs(old.z - z));
    const ref = Math.max(old.x, old.y, old.z, x, y, z, 0.05);
    return d > 0.04 && d / ref > 0.18;
  }

  private commitTargets(count: number, totalMl: number, bigChange: boolean) {
    const u = this.uniforms;
    const first = this.totalMl <= 1e-6 && totalMl > 0;
    this.targetCount = count;
    this.totalMlTarget = Math.max(0, totalMl);
    if (first) {
      // first fill: no swirl, start from the poured colour
      for (let i = 0; i < MAX_LAYERS; i++) {
        u.uKOld.value[i].copy(this.targets[i].k);
        u.uKNew.value[i].copy(this.targets[i].k);
        u.uScat.value[i].copy(this.targets[i].scat);
        this.curTopMl[i] = this.targets[i].topMl * 0.0;
      }
      u.uMix.value = 1;
      this.mixing = false;
    } else if (bigChange) {
      // freeze current blend as the "old" colour and swirl in the new one from the top
      const m = u.uMix.value;
      for (let i = 0; i < MAX_LAYERS; i++) {
        u.uKOld.value[i].lerp(u.uKNew.value[i], m);
        u.uKNew.value[i].copy(this.targets[i].k);
      }
      u.uMix.value = 0;
      this.mixing = true;
    } else {
      for (let i = 0; i < MAX_LAYERS; i++) {
        u.uKNew.value[i].copy(this.targets[i].k);
        if (!this.mixing) u.uKOld.value[i].copy(this.targets[i].k);
      }
    }
    u.uLayerCount.value = count;
    this.updateApparent();
  }

  private updateApparent() {
    // dominant (largest) layer, evaluated at Lref
    let best = 0;
    let bestV = -1;
    let prev = 0;
    for (let i = 0; i < this.targetCount; i++) {
      const v = this.targets[i].topMl - prev;
      prev = this.targets[i].topMl;
      if (v > bestV) {
        bestV = v;
        best = i;
      }
    }
    const t = this.targets[best];
    const L = this.Lref;
    const a = 1 - Math.exp(-t.scat.w * L);
    const r = Math.exp(-t.k.x * L) * (1 - a) + t.scat.x * a;
    const g = Math.exp(-t.k.y * L) * (1 - a) + t.scat.y * a;
    const b = Math.exp(-t.k.z * L) * (1 - a) + t.scat.z * a;
    this.apparent = linearToHex(r, g, b);
  }

  /** '#rrggbb' sRGB apparent colour of the bulk liquid (near-white for clear water). */
  public getApparentHex(): string {
    return this.apparent;
  }

  public setStirring(rpm: number) {
    this.stirRpm = Math.max(0, rpm);
  }
  public setBoil(intensity: number) {
    this.boil = Math.max(0, Math.min(1, intensity));
  }
  public setGasAgitation(v: number) {
    this.gasAgitation = Math.max(0, Math.min(1, v));
  }
  /** Trigger an expanding ripple ring at local (x,z). */
  public impact(x: number, z: number, strength: number, time: number) {
    const im = this.uniforms.uImpact.value;
    if (time - im.z < 0.25 && im.w > strength) return;
    im.set(x, z, time, Math.min(1.5, strength));
  }
  /** Give the surface a damped slosh (after pours / additions / placement). */
  public slosh(amount: number, dirX = Math.random() - 0.5, dirZ = Math.random() - 0.5) {
    this.sloshAmp = Math.min(0.12, this.sloshAmp + amount);
    this.sloshDir.set(dirX, dirZ).normalize();
    this.sloshPhase = 0;
  }

  /** Per-frame animation. `worldMatrix` = glass-local frame world matrix (for the level free surface). */
  public tick(dt: number, time: number, worldMatrix: THREE.Matrix4) {
    const u = this.uniforms;
    const p = this.profile;
    u.uTime.value = time;

    // volume (exponential approach so level changes flow)
    if (!isFinite(this.totalMl)) this.totalMl = 0;
    if (!isFinite(this.totalMlTarget)) this.totalMlTarget = 0;
    const dv = this.totalMlTarget - this.totalMl;
    this.totalMl += dv * Math.min(1, dt * 4.0);
    if (Math.abs(dv) < 0.002) this.totalMl = this.totalMlTarget;
    const fill = heightForVolume(p, this.totalMl);
    this._fillY = fill;
    u.uFill.value = fill;
    const visible = this.totalMl > 0.02;
    this.sideAbsorb.visible = visible;

    // layer interfaces
    const frac = this.totalMlTarget > 1e-6 ? this.totalMl / this.totalMlTarget : 0;
    for (let i = 0; i < MAX_LAYERS; i++) {
      const tgt = this.targets[i].topMl * frac;
      this.curTopMl[i] += (tgt - this.curTopMl[i]) * Math.min(1, dt * 5);
      u.uLayerTop.value[i] = heightForVolume(p, this.curTopMl[i]);
      // scatter lerp
      u.uScat.value[i].lerp(this.targets[i].scat, Math.min(1, dt * 2.5));
    }

    // surface radius and cone fit for the chord estimate
    const rTop = Math.max(0.05, innerRadiusAt(p, Math.min(fill, p.innerTopY)));
    const yLo = p.innerBottomY + Math.min(0.6, (fill - p.innerBottomY) * 0.3);
    const rLo = innerRadiusAt(p, yLo);
    u.uR.value = rTop;
    const dy = fill - yLo;
    if (dy > 0.3) {
      u.uConeB.value = (rTop - rLo) / dy;
      u.uConeA.value = rTop - u.uConeB.value * fill;
    } else {
      u.uConeB.value = 0;
      u.uConeA.value = rTop;
    }

    // colour swirl progress
    if (this.mixing) {
      u.uMix.value = Math.min(1, u.uMix.value + dt / 0.9);
      if (u.uMix.value >= 1) {
        this.mixing = false;
        for (let i = 0; i < MAX_LAYERS; i++) u.uKOld.value[i].copy(u.uKNew.value[i]);
      }
    }

    // level free surface: world up in object space
    tmpM.copy(worldMatrix).invert();
    tmpV.set(0, 1, 0).transformDirection(tmpM);
    u.uUpObj.value.lerp(tmpV, Math.min(1, dt * 10)).normalize();

    // agitation
    const ripple = this.rippleBase + this.boil * 0.11 + this.gasAgitation * 0.05 + Math.min(0.03, this.stirRpm / 30000);
    u.uRipple.value += (ripple - u.uRipple.value) * Math.min(1, dt * 3);
    const vortexTarget = Math.min(rTop * 0.45, (this.stirRpm / 1000) * 1.6 * Math.min(1, rTop / 2.5)) * (fill - p.innerBottomY > 1 ? 1 : 0);
    this.vortexCur += (vortexTarget - this.vortexCur) * Math.min(1, dt * 1.5);
    u.uVortex.value = this.vortexCur;

    // slosh: damped oscillation (period ~0.5 s)
    if (this.sloshAmp > 1e-4) {
      this.sloshPhase += dt;
      const a = this.sloshAmp * Math.exp(-this.sloshPhase * 2.2) * Math.cos(this.sloshPhase * 12.5);
      u.uSlosh.value.set(this.sloshDir.x * a, this.sloshDir.y * a);
      if (this.sloshPhase > 3) {
        this.sloshAmp = 0;
        u.uSlosh.value.set(0, 0);
      }
    }
  }

  /**
   * Dev-time self check: returns a description when there is liquid to show but something would stop it from being
   * drawn (hidden in the hierarchy, non-finite uniforms, degenerate geometry), else null.
   */
  public diagnose(): string | null {
    if (this.totalMlTarget <= 0.05) return null;
    if (!this.sideAbsorb.visible && this.totalMl > 0.02) return 'liquid mesh hidden although volume > 0';
    if (this.sideAbsorb.visible) {
      let o: THREE.Object3D | null = this.sideAbsorb;
      while (o) {
        if (!o.visible) return `liquid ancestor "${o.name || o.type}" is hidden`;
        o = o.parent;
      }
    }
    const u = this.uniforms;
    for (const k of ['uFill', 'uYb', 'uR', 'uConeA', 'uConeB', 'uTopClamp'] as const) {
      if (!isFinite(u[k].value)) return `uniform ${k} is not finite`;
    }
    if (!(u.uR.value > 0.05)) return 'liquid surface radius is ~0';
    if (!(u.uFill.value > u.uYb.value)) return 'fill height is not above the vessel floor';
    return null;
  }

  public dispose() {
    this.absorbMat.dispose();
    this.surfaceMat.dispose();
  }
}
