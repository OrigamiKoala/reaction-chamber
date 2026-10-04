import * as THREE from 'three';
import { VesselSnapshot, SolidVisual, FumeVisual, GasFlux } from '../types/sim';
import { VesselProfile, heightForVolume, innerRadiusAt, outerRadiusAt } from './glass_profiles';
import { LiquidBody } from './liquid_material';
import { SpriteParticles, BubbleSystem } from './particles';
import { FlameCluster } from './flame';
import { softSpriteTexture, smokePuffTexture, dropletsTexture } from './textures';
import { SolidPieces, getRibbonGeo, BED_PACKING, METAL_PIECE_MIN_UM, PieceSolid } from './solid_pieces';
import { ELECTRODE_X, ELECTRODE_RADIUS, electrodeBottomY } from './electrode_geometry';
import { blackbodyHue, glowBrightness } from './blackbody';

export { getRibbonGeo };

/**
 * All per-vessel reaction effects. Lives in the vessel's glass-local frame (y = 0 at the bottom of the glass).
 * `applySnapshot` (20 Hz) only stores targets; `tick` (every frame) animates everything. Meshes are created once
 * and updated in place (the settled bed geometry is regenerated only when its height changes noticeably).
 */

// ------------------------------------------------------------------ shared resources
let crystalGeo: THREE.BufferGeometry | null = null;
let lumpGeo: THREE.BufferGeometry | null = null;
let foamGeo: THREE.BufferGeometry | null = null;
let shardGeo: THREE.BufferGeometry | null = null;
let stirBarGeo: THREE.BufferGeometry | null = null;
let stopperGeo: THREE.BufferGeometry | null = null;
const condGeoCache = new Map<string, THREE.BufferGeometry>();

function getCrystalGeo() {
  return (crystalGeo ??= new THREE.OctahedronGeometry(1, 0));
}
function getLumpGeo() {
  return (lumpGeo ??= new THREE.IcosahedronGeometry(1, 1));
}
function getFoamGeo() {
  return (foamGeo ??= new THREE.IcosahedronGeometry(1, 1));
}
function getShardGeo() {
  if (shardGeo) return shardGeo;
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(1, 0.15);
  s.lineTo(0.35, 1);
  s.lineTo(0, 0);
  shardGeo = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: false });
  shardGeo.center();
  return shardGeo;
}

function getStirBarGeo() {
  if (stirBarGeo) return stirBarGeo;
  stirBarGeo = new THREE.CapsuleGeometry(0.3, 1.6, 6, 16);
  stirBarGeo.rotateZ(Math.PI / 2);
  return stirBarGeo;
}

function getStopperGeo() {
  if (stopperGeo) return stopperGeo;
  // unit stopper: top radius 1, bottom 0.82, height 1 (scaled per vessel), slightly domed top
  const pts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.8, 0),
    new THREE.Vector2(0.82, 0.02),
    new THREE.Vector2(1.0, 0.94),
    new THREE.Vector2(0.98, 1.0),
    new THREE.Vector2(0, 1.0),
  ];
  stopperGeo = new THREE.LatheGeometry(pts, 32);
  return stopperGeo;
}

function getCondensationGeo(p: VesselProfile): THREE.BufferGeometry {
  let g = condGeoCache.get(p.type);
  if (g) return g;
  const pts = p.inner.filter((q) => q.x > 0.01).map((q) => new THREE.Vector2(Math.max(0.01, q.x - 0.03), q.y));
  g = new THREE.LatheGeometry(pts, 48);
  condGeoCache.set(p.type, g);
  return g;
}

const crystalMat = () =>
  new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.08,
    metalness: 0,
    clearcoat: 0.2,
    clearcoatRoughness: 0.05,
    envMapIntensity: 0.7,
    transparent: true,
    opacity: 0.9,
    flatShading: true,
  });

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();
const tmpC = new THREE.Color();

/**
 * World size (cm) of a suspended-particle sprite from the engine's mass-weighted mean diameter of the suspended part.
 * Real particles of a few micrometres are far below a pixel at bench distance, so a floor keeps the cloud visible; coarse
 * crystals (a millimetre and up) are drawn at their true size, so a settling precipitate visibly goes from a coarse
 * glitter to a fine haze as the big grains fall out first.
 */
export function suspendedSpriteCm(diameterUm: number): number {
  const d = Number.isFinite(diameterUm) && diameterUm > 0 ? diameterUm : 10;
  return Math.min(0.25, 0.022 + 0.7 * d * 1e-4);
}

/**
 * Radius scale (cm) of a bed crystal's octahedron from the engine's mean crystal diameter: millimetre crystals are drawn
 * about their real size, a fine crystalline sand is kept just visible.
 */
export function crystalSpriteScale(diameterUm: number): number {
  const d = Number.isFinite(diameterUm) && diameterUm > 0 ? diameterUm : 500;
  return Math.max(0.035, Math.min(0.22, 0.5 * d * 1e-4 * 1.8));
}

/**
 * Visible flame height (cm) of a diffusion flame of heat-release `powerW` over a pool of diameter `poolDiameterCm`
 * (Heskestad: L = 0.235 Q^(2/5) - 1.02 D, Q in kW, lengths in m). A 10 W candle is ~3 cm, 1.4 kW over a beaker ~20 cm.
 */
export function flameHeightCm(powerW: number, poolDiameterCm: number): number {
  const q = Math.max(0, powerW) / 1000;
  const l = 0.235 * Math.pow(q, 0.4) - 1.02 * (poolDiameterCm / 100);
  return Math.max(1.2, Math.min(60, l * 100));
}

function rnd(a: number, b: number) {
  return a + Math.random() * (b - a);
}

/** Deterministic pseudo-random in [0,1) for instance i, channel k (stable layouts as counts change). */
function prand(i: number, k: number): number {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

interface Shard {
  p: THREE.Vector3;
  v: THREE.Vector3;
  r: THREE.Euler;
  w: THREE.Vector3;
  s: number;
  rest: boolean;
}

/** The engine's boil intensity is the vapour flow over 50 mL/s and does not saturate (a 600 W plate gives ~9); the picture of a
 *  boil saturates: bubbling vigour rises quickly from the first bubbles and levels off. */
const boilVigour = (intensity: number): number => (intensity > 0 ? 1 - Math.exp(-intensity / 1.5) : 0);

export class VesselEffects {
  public group = new THREE.Group();
  /** Called when the glass shatters (owner hides glass + liquid). */
  public onBurst?: () => void;

  private snap: VesselSnapshot | null = null;
  private bubbles: BubbleSystem;
  private smoke: SpriteParticles;
  private splash: SpriteParticles;
  private precip: SpriteParticles;
  private flame: FlameCluster;

  private foam: THREE.InstancedMesh;
  private foamMat: THREE.MeshStandardMaterial;
  private foamCells: { u: number; v: number; layer: number; r: number; ph: number }[] = [];
  private foamLevel = 0;
  private foamTarget = 0;

  private cond: THREE.Mesh;
  private condMat: THREE.ShaderMaterial;
  private condLevel = 0;

  private bedSide: THREE.Mesh | null = null;
  private bedTop: THREE.Mesh | null = null;
  private bedMat: THREE.MeshStandardMaterial;
  /** Last built bed: flat-layer level, heap footprint radius / height, surface radius (all glass-local cm). */
  private bed = { yb: 0, rp: 0, H: 0, rS: 0, wet: false, vol: -1, sig: '' };
  private bedTargetVol = 0;
  private bedVol = 0;
  private bedColor = new THREE.Color(1, 1, 1);
  private bedColorTarget = new THREE.Color(1, 1, 1);
  private bedSeed = Math.random() * 10;

  private crystals: THREE.InstancedMesh;
  private crystalCount = 0;
  private crystalSize = 0.12;
  private crystalPolar: { a: number; f: number; s: number; rot: number }[] = [];
  private lumps: THREE.InstancedMesh;
  private lumpCount = 0;
  private lumpState: { x: number; y: number; z: number; s: number; floatY: number; susp: boolean; ph: number }[] = [];

  /** Floating / frozen / film solids and metal pieces. */
  private pieces: SolidPieces;
  /** Settled solids, bottom first: each one's colour and bed volume (mixed beds are mottled, not averaged). */
  private bedLayers: { rgb: [number, number, number]; vol: number }[] = [];

  /** Incandescence of a vessel and its contents above ~780 K (additive shell on the inner wall). */
  private glow: THREE.Mesh;
  private glowMat: THREE.MeshBasicMaterial;
  private glowLevel = 0;
  private glowTarget = 0;

  private stirBar: THREE.Mesh;
  private stirRpm = 0;
  private stirAngle = 0;

  private stopper: THREE.Mesh;
  private stopperFlying = false;
  private stopperV = new THREE.Vector3();
  private stopperW = new THREE.Vector3();
  private stopperT = 0;
  private sealed = false;

  private shards: THREE.InstancedMesh | null = null;
  private shardState: Shard[] = [];
  private puddle: THREE.Mesh | null = null;
  private puddleMat: THREE.MeshPhysicalMaterial | null = null;
  private puddleR = 0;
  private puddleTarget = 0;
  public burst = false;

  private failed = new Set<string>();
  private seenEvents = new Set<string>();
  private spawnAcc = { bubbles: 0, boil: 0, steam: 0, fume: 0, precip: 0, spill: 0 };
  private spillTime = 0;
  private suspendedColor = new THREE.Color(1, 1, 1);
  private suspendedTargetCount = 0;
  private suspendedDiameterUm = 10;
  /** Stokes settling velocity of the suspended solids (mm/s) from the engine's own liquid density and viscosity. */
  private suspendedSettleMmS = 0.2;
  private settleFrac = 0;
  private time = 0;
  private appHex = '';
  private appColor = new THREE.Color(1, 1, 1);
  private renderBase = 0;
  private floorY: number;

  constructor(private profile: VesselProfile, private liquid: LiquidBody) {
    const p = profile;
    this.floorY = -p.baseOffsetY;
    this.bubbles = new BubbleSystem(700);
    this.smoke = new SpriteParticles(170, smokePuffTexture());
    this.smoke.fadeIn = 0.2;
    this.splash = new SpriteParticles(140, softSpriteTexture());
    this.splash.fadeIn = 0;
    this.precip = new SpriteParticles(450, softSpriteTexture(), { minPx: 1.0 });
    this.precip.fadeIn = 0.3;
    this.flame = new FlameCluster(p.rimInnerRadius > 2 ? 4 : 2);
    this.group.add(this.bubbles.mesh, this.smoke.points, this.splash.points, this.precip.points, this.flame.group);

    this.smoke.behaviour = (i, dt) => this.smokeBehaviour(i, dt);
    this.splash.behaviour = (i, dt) => this.splashBehaviour(i, dt);
    this.precip.behaviour = (i, dt) => this.precipBehaviour(i, dt);

    // foam head
    this.foamMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0, envMapIntensity: 1.2 });
    this.foam = new THREE.InstancedMesh(getFoamGeo(), this.foamMat, 260);
    this.foam.count = 0;
    this.foam.visible = false;
    this.foam.frustumCulled = false;
    this.foam.raycast = () => {};
    this.foam.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < 260; i++) {
      const layer = Math.floor(i / 52);
      this.foamCells.push({ u: Math.sqrt(Math.random()), v: Math.random() * Math.PI * 2, layer, r: rnd(0.6, 1.25), ph: Math.random() * 6.28 });
      this.foam.setColorAt(i, tmpC.setScalar(rnd(0.9, 1.0)));
    }
    this.group.add(this.foam);

    // condensation
    this.condMat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: dropletsTexture() },
        uAmount: { value: 0 },
        uFill: liquid.uniforms.uFill,
        uTop: { value: p.innerTopY },
      },
      vertexShader: /* glsl */ `
        varying vec3 vObj;
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          vObj = position;
          vec4 mv = modelViewMatrix * vec4( position, 1.0 );
          vN = normalize( normalMatrix * normal );
          vV = -mv.xyz;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        uniform float uAmount;
        uniform float uFill;
        uniform float uTop;
        varying vec3 vObj;
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          float y = vObj.y;
          if ( y < uFill + 0.12 ) discard;
          float a0 = atan( vObj.z, vObj.x );
          float circ = length( vObj.xz ) * 6.2832;
          vec2 uv = vec2( a0 / 6.2832 * circ / 4.0, y / 4.0 );
          vec4 t = texture2D( uMap, uv );
          float band = smoothstep( uFill + 0.12, uFill + 0.9, y ) * ( 1.0 - smoothstep( uTop - 0.6, uTop, y ) * 0.6 );
          float nv = abs( dot( normalize( vN ), normalize( vV ) ) );
          float a = t.a * uAmount * band * ( 0.7 + 0.3 * ( 1.0 - nv ) );
          if ( a < 0.004 ) discard;
          gl_FragColor = vec4( vec3( 0.92, 0.95, 0.97 ) * ( 0.75 + 0.35 * t.r ), a );
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.cond = new THREE.Mesh(getCondensationGeo(p), this.condMat);
    this.cond.visible = false;
    this.cond.raycast = () => {};
    this.group.add(this.cond);

    // settled bed material
    this.bedMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0, vertexColors: true });

    // crystals + lumps
    this.crystals = new THREE.InstancedMesh(getCrystalGeo(), crystalMat(), 48);
    this.crystals.count = 0;
    this.crystals.visible = false;
    this.crystals.raycast = () => {};
    this.lumps = new THREE.InstancedMesh(
      getLumpGeo(),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, transparent: true, opacity: 0.92 }),
      40
    );
    this.lumps.count = 0;
    this.lumps.visible = false;
    this.lumps.raycast = () => {};
    this.lumps.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.crystals, this.lumps);

    // floating pieces, frozen mass, powder film, metal ribbons / granules
    this.pieces = new SolidPieces(p);
    this.group.add(this.pieces.group);

    // incandescence
    {
      const pts: THREE.Vector2[] = [];
      for (const q of p.inner) if (q.y <= p.innerTopY) pts.push(new THREE.Vector2(Math.max(0, q.x - 0.015), q.y + 0.01));
      this.glowMat = new THREE.MeshBasicMaterial({
        color: 0xff4000,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.BackSide,
        toneMapped: false,
      });
      this.glow = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), this.glowMat);
      this.glow.visible = false;
      this.glow.raycast = () => {};
      this.glow.frustumCulled = false;
      this.group.add(this.glow);
    }

    // stir bar
    this.stirBar = new THREE.Mesh(
      getStirBarGeo(),
      new THREE.MeshStandardMaterial({ color: 0xf6f6f2, roughness: 0.45, metalness: 0 })
    );
    const barLen = Math.min(1.25, (innerRadiusAt(p, p.innerBottomY + 0.3) * 2 * 0.8) / 2.2);
    this.stirBar.scale.setScalar(Math.max(0.35, barLen));
    this.stirBar.position.y = p.innerBottomY + 0.3 * this.stirBar.scale.y;
    this.stirBar.visible = false;
    this.stirBar.raycast = () => {};
    this.group.add(this.stirBar);

    // stopper (rubber)
    this.stopper = new THREE.Mesh(
      getStopperGeo(),
      new THREE.MeshStandardMaterial({ color: 0x5b2a1c, roughness: 0.75, metalness: 0 })
    );
    const sr = p.rimInnerRadius + 0.25;
    this.stopper.scale.set(sr, Math.min(3, Math.max(1.6, sr * 1.1)), sr);
    this.stopper.userData.homeY = p.rimY - this.stopper.scale.y * 0.65;
    this.stopper.position.y = this.stopper.userData.homeY;
    this.stopper.castShadow = true;
    this.stopper.visible = false;
    this.stopper.raycast = () => {};
    this.group.add(this.stopper);

    this.setRenderOrderBase(0);
  }

  public setRenderOrderBase(base: number) {
    this.renderBase = base;
    this.bubbles.setRenderOrder(base + 4);
    this.precip.setRenderOrder(base + 4);
    this.splash.setRenderOrder(base + 4);
    this.smoke.setRenderOrder(base + 6);
    this.cond.renderOrder = base + 4;
    this.glow.renderOrder = base + 4;
    this.crystals.renderOrder = base + 4;
    this.lumps.renderOrder = base + 4;
    this.flame.group.children.forEach((c) => (c.renderOrder = base + 4));
    this.pieces.setRenderOrder(base);
    if (this.shards) this.shards.renderOrder = base + 6;
    if (this.puddle) this.puddle.renderOrder = base;
  }

  /** Top of the rubber stopper in glass-local coordinates (for the pressure gauge). */
  public stopperTopY(): number {
    return this.stopper.userData.homeY + this.stopper.scale.y;
  }

  public setSealed(on: boolean) {
    if (this.burst) on = false;
    if (on && !this.sealed) {
      this.stopperFlying = false;
      this.stopper.position.set(0, this.stopper.userData.homeY, 0);
      this.stopper.rotation.set(0, 0, 0);
    }
    this.sealed = on;
    if (!this.stopperFlying) this.stopper.visible = on;
  }

  public getStirRpm(): number {
    return this.stirRpm;
  }

  public setStirring(rpm: number) {
    this.stirRpm = Math.max(0, rpm);
    this.liquid.setStirring(this.stirRpm);
  }

  // ---------------------------------------------------------------- snapshot
  public applySnapshot(snap: VesselSnapshot) {
    this.snap = snap;
    // Solids first: they are the part users look for, and an unrelated failure (events, foam) must not skip them.
    this.safe('solids', () => this.processSolids(snap.solids || [], snap.total_liquid_ml));
    this.safe('events', () => {
      if (snap.sealed !== this.sealed && !snap.burst) this.setSealed(snap.sealed);
      for (const ev of snap.events || []) {
        const key = `${ev.kind}@${ev.t_sim_s.toFixed(3)}`;
        if (this.seenEvents.has(key)) continue;
        this.seenEvents.add(key);
        if (this.seenEvents.size > 300) this.seenEvents.clear();
        if (ev.kind === 'stopper_pop') this.popStopper();
        else if (ev.kind === 'burst') this.triggerBurst();
        else if (ev.kind === 'boil_over') this.spillTime = 1.6;
        else if (ev.kind === 'splatter') this.spatter(10);
      }
      if (snap.burst && !this.burst) this.triggerBurst();
    });
    this.safe('gas/foam', () => {
      this.foamTarget = Math.max(0, Math.min(1, snap.foam || 0));
      this.condLevel = Math.max(0, Math.min(1, snap.condensation || 0));
      this.liquid.setBoil(boilVigour(snap.boil_intensity || 0));
      this.liquid.setSupercritical(!!snap.gas_phase?.supercritical);
      this.glowTarget = snap.burst ? 0 : glowBrightness(snap.temperature_k);
      if (this.glowTarget > 0) {
        const hue = blackbodyHue(snap.temperature_k);
        this.glowMat.color.setRGB(hue[0], hue[1], hue[2]);
      }
      let gas = 0;
      // gas released by a reaction clouds the liquid with micro-bubbles; the vapour of a boiling liquid is the boil path's
      // (large bubbles born on the hot floor, surface agitation), not a haze
      for (const g of snap.gas_fluxes || []) if (g.origin !== 'boil') gas += g.rate_ml_s;
      this.liquid.setGasAgitation(Math.min(1, gas / 4));
    });
  }

  private processSolids(solids: SolidVisual[], totalMl: number) {
    let bedVol = 0;
    let wsum = 0;
    let r = 0, g = 0, b = 0;
    let suspMass = 0;
    let sr = 0, sg = 0, sb = 0;
    let crystalMass = 0;
    let crystalDiam = 0;
    let lumpMass = 0;
    let lumpSusp = 0;
    let rough = 0.92;
    let diam = 0;
    let vel = 0;
    const lumpCol = new THREE.Color(1, 1, 1);
    let metalPowderVol = 0;
    const floaters: Array<PieceSolid & { floating: boolean }> = [];
    const metals: Array<PieceSolid & { floating: boolean }> = [];
    const layers: { rgb: [number, number, number]; vol: number }[] = [];
    for (const s of solids) {
      if (s.mass_g <= 1e-6) continue;
      const piece = (): PieceSolid & { floating: boolean } => ({
        rgb: s.rgb,
        // the solid's own volume as the engine reports it; older snapshots only have the bed's bulk volume (a single piece
        // or a frozen mass has no packing voids, so that is divided by the packing factor)
        volumeMl: s.volume_ml !== undefined && s.volume_ml >= 0 ? s.volume_ml : Math.max(0, s.settled_volume_ml) / BED_PACKING,
        remaining: s.remaining_fraction ?? 1,
        kind: s.kind,
        diameterUm: s.particle_diameter_um,
        floating: !!s.floating,
        morphology: s.morphology,
        layer: s.layer_index ?? null,
      });
      // A metal is a ribbon / granules / a rod only when the engine says it is a piece; a cemented or precipitated metal
      // (copper on magnesium, silver mirror dust) is a powder and settles like any other solid, just with a metallic sheen.
      const metalPowder =
        s.kind === 'metal' && (s.morphology === 'bed' || s.morphology === 'film' || (s.morphology === undefined && s.particle_diameter_um < METAL_PIECE_MIN_UM));
      if (s.kind === 'metal' && !metalPowder) {
        metals.push(piece());
        continue;
      }
      if (s.floating) {
        // lighter than the liquid (ice, wax, flakes): rides the surface, never part of the bed or the cloud
        floaters.push(piece());
        continue;
      }
      // nothing can be suspended without a liquid: a dry powder lies entirely in the bed whatever the fraction says
      const suspFrac = totalMl > 0.05 ? Math.max(0, Math.min(1, s.suspended_fraction)) : 0;
      const settled = 1 - suspFrac;
      const v = Math.max(0, s.settled_volume_ml) * settled;
      bedVol += v;
      if (v > 1e-5) layers.push({ rgb: s.rgb, vol: v });
      if (metalPowder) metalPowderVol += v;
      // colour weights: the share of the bed's *volume* (surface area) each solid covers, not its mass
      const w = v + 1e-9;
      r += s.rgb[0] * w;
      g += s.rgb[1] * w;
      b += s.rgb[2] * w;
      wsum += w;
      const susp = s.mass_g * suspFrac;
      if (totalMl > 0.05) {
        suspMass += susp;
        sr += s.rgb[0] * susp;
        sg += s.rgb[1] * susp;
        sb += s.rgb[2] * susp;
        // the size the cloud is seen at: what is suspended, grown into flocs where the electrolyte makes them (a gel's primary
        // particles are nanometres; the flocs the engine's settling law uses are what the eye sees)
        const primary = s.suspended_diameter_um && s.suspended_diameter_um > 0 ? s.suspended_diameter_um : s.particle_diameter_um;
        diam += Math.max(primary, s.floc_diameter_um ?? 0) * susp;
        vel += (s.settling_velocity_mm_s ?? 0) * susp;
      }
      if (s.kind === 'crystal') {
        crystalMass += s.mass_g * settled;
        crystalDiam += s.particle_diameter_um * s.mass_g * settled;
        rough = Math.min(rough, 0.35);
      }
      if (s.kind === 'gel' || s.kind === 'curds') {
        lumpMass += s.mass_g;
        lumpSusp += susp;
        lumpCol.setRGB(s.rgb[0], s.rgb[1], s.rgb[2]);
        rough = Math.min(rough, s.kind === 'gel' ? 0.4 : 0.8);
      }
    }
    this.bedTargetVol = bedVol;
    this.bedLayers = layers;
    if (wsum > 0) this.bedColorTarget.setRGB(r / wsum, g / wsum, b / wsum);
    // a bed of metal powder (cemented copper, silver) has a sheen: metalness follows its share of the bed
    const metalShare = bedVol > 1e-9 ? Math.min(1, metalPowderVol / bedVol) : 0;
    this.bedMat.metalness = 0.6 * metalShare;
    this.bedMat.roughness = metalShare > 0.5 ? Math.min(rough, 0.5) : rough;
    // suspended cloud
    if (suspMass > 1e-5) {
      this.suspendedColor.setRGB(sr / suspMass, sg / suspMass, sb / suspMass);
      this.suspendedDiameterUm = diam / suspMass;
      this.suspendedSettleMmS = vel / suspMass;
      this.suspendedTargetCount = Math.min(this.precip.cap, Math.floor(30 + Math.sqrt(suspMass) * 520));
    } else {
      this.suspendedTargetCount = 0;
    }
    // crystals sparkle on the bed
    const nCr = crystalMass > 1e-4 ? Math.min(48, Math.floor(6 + Math.sqrt(crystalMass) * 40)) : 0;
    // the sparkle follows the engine's crystal size (a sand of 0.1 mm glints less than 2 mm crystals)
    const crUm = crystalMass > 1e-9 ? crystalDiam / crystalMass : 0;
    const crSize = crystalSpriteScale(crUm);
    if (nCr !== this.crystalCount || Math.abs(crSize - this.crystalSize) > 0.25 * this.crystalSize) {
      this.crystalCount = nCr;
      this.crystalSize = crSize;
      this.layoutCrystals(wsum > 0 ? this.bedColorTarget : new THREE.Color(1, 1, 1));
    }
    // gel / curd lumps
    const nL = lumpMass > 1e-4 ? Math.min(40, Math.floor(4 + Math.sqrt(lumpMass) * 30)) : 0;
    if (nL !== this.lumpCount) {
      this.lumpCount = nL;
      this.layoutLumps(lumpCol, lumpMass > 0 ? lumpSusp / lumpMass : 0);
    }
    // floating pieces, frozen mass, metal
    metals.sort((x, y) => y.volumeMl - x.volumeMl);
    this.pieces.setSolids(floaters, metals);
  }

  private layoutCrystals(col: THREE.Color) {
    const p = this.profile;
    const n = this.crystalCount;
    this.crystals.count = n;
    this.crystals.visible = n > 0;
    this.crystalPolar = [];
    for (let i = 0; i < n; i++) {
      this.crystalPolar.push({
        a: prand(i, 1) * Math.PI * 2,
        f: Math.sqrt(prand(i, 2)),
        s: this.crystalSize * (0.6 + prand(i, 3) * 0.8) * Math.min(1.2, p.rimInnerRadius / 3),
        rot: prand(i, 4),
      });
      this.crystals.setColorAt(i, tmpC.copy(col).multiplyScalar(0.85 + prand(i, 8) * 0.25));
    }
    if (this.crystals.instanceColor) this.crystals.instanceColor.needsUpdate = true;
    this.placeCrystals();
  }

  /** Crystals rest on the (heaped) bed surface; re-placed whenever the bed is rebuilt. */
  private placeCrystals() {
    const n = this.crystalCount;
    if (n === 0) return;
    const R = Math.max(0.1, Math.max(this.bed.rS, this.bed.rp) * 0.85);
    for (let i = 0; i < n; i++) {
      const c = this.crystalPolar[i];
      if (!c) break;
      const rr = c.f * R;
      const s = c.s;
      tmpP.set(Math.cos(c.a) * rr, this.bedSurfaceAt(rr) + s * 0.4, Math.sin(c.a) * rr);
      tmpQ.setFromEuler(tmpE.set(prand(i, 4) * 3, prand(i, 5) * 3, prand(i, 6) * 3));
      tmpS.set(s, s * (1.1 + prand(i, 7) * 0.7), s);
      tmpM.compose(tmpP, tmpQ, tmpS);
      this.crystals.setMatrixAt(i, tmpM);
    }
    this.crystals.instanceMatrix.needsUpdate = true;
  }

  private layoutLumps(col: THREE.Color, suspFrac: number) {
    const p = this.profile;
    const n = this.lumpCount;
    this.lumps.count = n;
    this.lumps.visible = n > 0;
    const lm = this.lumps.material as THREE.MeshStandardMaterial;
    lm.color.copy(col);
    // a flocculent precipitate hanging in the liquid is translucent; settled curds are denser
    lm.opacity = 0.92 - 0.38 * Math.max(0, Math.min(1, suspFrac));
    this.lumpState = [];
    for (let i = 0; i < n; i++) {
      const susp = prand(i, 11) < suspFrac;
      this.lumpState.push({
        x: 0, y: 0, z: 0,
        s: (0.12 + prand(i, 12) * 0.23) * Math.min(1.3, p.rimInnerRadius / 3),
        floatY: prand(i, 13),
        susp,
        ph: prand(i, 14) * 6.28,
      });
    }
  }

  // ---------------------------------------------------------------- events
  private popStopper() {
    if (!this.stopper.visible && !this.sealed) return;
    this.stopperFlying = true;
    this.stopperT = 0;
    this.stopper.visible = true;
    this.stopperV.set(rnd(-25, 25), rnd(160, 220), rnd(-10, 25));
    this.stopperW.set(rnd(-12, 12), rnd(-6, 6), rnd(-12, 12));
    this.sealed = false;
    const y = this.profile.rimY;
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rnd(10, 40);
      this.smoke.spawn(Math.cos(a) * 0.5, y + 0.5, Math.sin(a) * 0.5, Math.cos(a) * sp, rnd(10, 60), Math.sin(a) * sp, rnd(0.6, 1.2), 1, 5, 0.22, 0.95, 0.96, 0.97, 0, 3.5, 3);
    }
  }

  private spatter(n: number) {
    const fill = this.liquid.fillY;
    const c = new THREE.Color(this.liquid.getApparentHex());
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      this.splash.spawn(Math.cos(a) * 0.5, fill, Math.sin(a) * 0.5, Math.cos(a) * rnd(5, 20), rnd(40, 90), Math.sin(a) * rnd(5, 20), 1.5, 0.25, 0.2, 0.9, c.r, c.g, c.b, 981, 0, 0);
    }
  }

  /** Shatter the glass: shards fly and settle on the bench, liquid spreads as a puddle. */
  public triggerBurst() {
    if (this.burst) return;
    this.burst = true;
    const p = this.profile;
    const liquidVol = this.liquid.volumeMl;
    const col = new THREE.Color(this.liquid.getApparentHex());
    this.onBurst?.();
    this.bubbles.clear();
    this.precip.clear();
    this.foam.visible = false;
    this.cond.visible = false;
    this.crystals.visible = false;
    this.lumps.visible = false;
    this.pieces.hide();
    this.stirBar.visible = false;
    if (this.bedSide) this.bedSide.visible = false;
    if (this.bedTop) this.bedTop.visible = false;
    if (this.sealed) this.popStopper();

    const n = 34;
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xf2f8f5,
      roughness: 0.04,
      metalness: 0,
      transparent: true,
      opacity: 0.38,
      envMapIntensity: 0.6,
      clearcoat: 0.1,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.shards = new THREE.InstancedMesh(getShardGeo(), mat, n);
    this.shards.frustumCulled = false;
    this.shards.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.shards.raycast = () => {};
    this.group.add(this.shards);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const y = rnd(0.2, p.rimY);
      const r = outerRadiusAt(p, y);
      const out = rnd(40, 140);
      this.shardState.push({
        p: new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r),
        v: new THREE.Vector3(Math.cos(a) * out, rnd(30, 160), Math.sin(a) * out),
        r: new THREE.Euler(rnd(0, 6), rnd(0, 6), rnd(0, 6)),
        w: new THREE.Vector3(rnd(-20, 20), rnd(-20, 20), rnd(-20, 20)),
        s: rnd(0.4, 1.6) * Math.min(1.5, p.rimInnerRadius / 2.5),
        rest: false,
      });
    }
    // spray
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rnd(20, 90);
      this.splash.spawn(Math.cos(a) * 1, rnd(0.5, Math.max(1, this.liquid.fillY)), Math.sin(a) * 1, Math.cos(a) * sp, rnd(20, 120), Math.sin(a) * sp, 2.0, rnd(0.2, 0.5), 0.15, 0.85, col.r, col.g, col.b, 981, 0.2, 0);
    }
    if (liquidVol > 0.5) this.ensurePuddle(col, Math.min(30, Math.sqrt(liquidVol / (Math.PI * 0.22))));
    this.setRenderOrderBase(this.renderBase);
  }

  private ensurePuddle(col: THREE.Color, radius: number) {
    if (!this.puddle) {
      this.puddleMat = new THREE.MeshPhysicalMaterial({
        color: col,
        roughness: 0.03,
        metalness: 0,
        transparent: true,
        opacity: 0.55,
        clearcoat: 0.3,
        envMapIntensity: 0.6,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      });
      const g = new THREE.CircleGeometry(1, 48);
      // wobbly outline
      const pos = g.attributes.position as THREE.BufferAttribute;
      for (let i = 1; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const a = Math.atan2(y, x);
        const f = 1 + 0.12 * Math.sin(a * 3 + 1) + 0.08 * Math.sin(a * 7 + 2) + 0.05 * Math.sin(a * 11);
        pos.setXY(i, x * f, y * f);
      }
      g.rotateX(-Math.PI / 2);
      this.puddle = new THREE.Mesh(g, this.puddleMat);
      this.puddle.position.y = this.floorY + 0.04;
      this.puddle.scale.setScalar(0.01);
      this.puddle.raycast = () => {};
      this.puddle.receiveShadow = true;
      this.group.add(this.puddle);
      this.puddle.renderOrder = this.renderBase;
    } else if (this.puddleMat) {
      this.puddleMat.color.lerp(col, 0.5);
    }
    this.puddleTarget = Math.max(this.puddleTarget, radius);
  }

  /** Splash droplets + ripple at local (x, z) on the surface (pour landing / drop impact). */
  public splashAt(x: number, z: number, color: THREE.Color, count: number, strength: number) {
    const y = this.liquid.fillY;
    this.liquid.impact(x, z, strength, this.time);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rnd(3, 14) * strength;
      this.splash.spawn(x, y + 0.05, z, Math.cos(a) * sp, rnd(15, 45) * strength, Math.sin(a) * sp, 0.6, rnd(0.08, 0.18), 0.06, 0.8, color.r, color.g, color.b, 981, 0, 1);
    }
  }

  // ---------------------------------------------------------------- particle behaviours
  private smokeBehaviour(i: number, dt: number): boolean {
    const k = this.smoke.kind[i];
    const i3 = i * 3;
    const pos = this.smoke.pos;
    const vel = this.smoke.vel;
    const p = this.profile;
    const s = this.smoke.seed[i];
    const t = this.smoke.life[i];
    if (k === 0 || k === 1) {
      // buoyant plume with turbulent drift
      vel[i3] += Math.sin(t * 1.7 + s) * 2.5 * dt;
      vel[i3 + 2] += Math.cos(t * 1.3 + s * 1.7) * 2.5 * dt;
      const y = pos[i3 + 1];
      if (y < p.rimY) {
        // inside the vessel: stay within the wall
        const R = Math.max(0.2, innerRadiusAt(p, Math.min(y, p.innerTopY)) - 0.3);
        const rr = Math.hypot(pos[i3], pos[i3 + 2]);
        if (rr > R) {
          pos[i3] *= R / rr;
          pos[i3 + 2] *= R / rr;
        }
      }
    } else if (k === 2) {
      // dense fume: creeps up to the rim, spills over, falls down the outside, spreads on the bench
      const y = pos[i3 + 1];
      const rr = Math.hypot(pos[i3], pos[i3 + 2]) + 1e-4;
      const nx = pos[i3] / rr;
      const nz = pos[i3 + 2] / rr;
      const rimR = p.rimOuterRadius + 0.4;
      if (y >= p.rimY - 0.3 && rr < rimR) {
        vel[i3] += nx * 9 * dt;
        vel[i3 + 2] += nz * 9 * dt;
        vel[i3 + 1] = Math.max(vel[i3 + 1] - 6 * dt, -0.5);
      } else if (rr >= rimR && y > this.floorY + 0.6) {
        vel[i3 + 1] -= 14 * dt;
        vel[i3 + 1] = Math.max(vel[i3 + 1], -8);
        const R = outerRadiusAt(p, Math.max(0, Math.min(y, p.rimY))) + 0.6;
        if (rr < R) {
          pos[i3] = nx * R;
          pos[i3 + 2] = nz * R;
        }
      } else if (y <= this.floorY + 0.6) {
        pos[i3 + 1] = this.floorY + 0.6;
        vel[i3 + 1] = 0;
        vel[i3] += nx * 2.5 * dt;
        vel[i3 + 2] += nz * 2.5 * dt;
      } else if (y < p.rimY - 0.3) {
        vel[i3 + 1] = Math.max(vel[i3 + 1], 0.8);
        const R = Math.max(0.2, innerRadiusAt(p, Math.min(y, p.innerTopY)) - 0.3);
        if (rr > R) {
          pos[i3] = nx * R;
          pos[i3 + 2] = nz * R;
        }
      }
    }
    return true;
  }

  private splashBehaviour(i: number, _dt: number): boolean {
    const k = this.splash.kind[i];
    const i3 = i * 3;
    const pos = this.splash.pos;
    const vel = this.splash.vel;
    if (k === 1) {
      // droplets from a splash die when they fall back into the liquid
      if (vel[i3 + 1] < 0 && pos[i3 + 1] < this.liquid.fillY) return false;
    } else if (k === 4) {
      // boil-over spill: hugs the outside wall
      const p = this.profile;
      const y = pos[i3 + 1];
      const rr = Math.hypot(pos[i3], pos[i3 + 2]) + 1e-4;
      const R = outerRadiusAt(p, Math.max(0, Math.min(y, p.rimY))) + 0.15;
      if (y > this.floorY + 0.1) {
        pos[i3] *= R / rr;
        pos[i3 + 2] *= R / rr;
      } else {
        pos[i3 + 1] = this.floorY + 0.1;
        vel[i3 + 1] = 0;
        vel[i3] = (pos[i3] / rr) * 2;
        vel[i3 + 2] = (pos[i3 + 2] / rr) * 2;
      }
    }
    if (pos[i3 + 1] < this.floorY + 0.05) {
      pos[i3 + 1] = this.floorY + 0.05;
      vel[i3 + 1] = 0;
      vel[i3] *= 0.5;
      vel[i3 + 2] *= 0.5;
    }
    return true;
  }

  private precipBehaviour(i: number, dt: number): boolean {
    const i3 = i * 3;
    const pos = this.precip.pos;
    const p = this.profile;
    const fill = this.liquid.fillY;
    const s = this.precip.seed[i];
    // swirl around the axis (stirring or gentle convection)
    const omega = this.stirRpm > 0 ? Math.min(4.5, (this.stirRpm / 60) * 6.283 * 0.12) : 0.12 + boilVigour(this.snap?.boil_intensity ?? 0) * 2;
    const x = pos[i3];
    const z = pos[i3 + 2];
    const c = Math.cos(omega * dt);
    const sn = Math.sin(omega * dt);
    pos[i3] = x * c - z * sn;
    pos[i3 + 2] = x * sn + z * c;
    // Brownian-ish jitter + Stokes settling (exaggerated)
    // the engine's settling velocity (mm/s, real physics) shown 30x faster so the cloud clears within an attention span
    const settle = Math.min(1.2, 0.02 + 0.3 * this.suspendedSettleMmS) * (this.stirRpm > 0 ? 0.15 : 1);
    pos[i3 + 1] += (-settle + Math.sin(this.time * 1.3 + s) * 0.25) * dt;
    pos[i3] += Math.sin(this.time * 2.1 + s * 3.1) * 0.15 * dt;
    pos[i3 + 2] += Math.cos(this.time * 1.9 + s * 2.3) * 0.15 * dt;
    const bed = this.bedLevelY();
    const y = pos[i3 + 1];
    if (y < Math.max(bed, p.innerBottomY) + 0.04) return false;
    if (y > fill - 0.05) pos[i3 + 1] = fill - 0.05;
    const R = Math.max(0.05, innerRadiusAt(p, pos[i3 + 1]) - 0.08);
    const rr = Math.hypot(pos[i3], pos[i3 + 2]);
    if (rr > R) {
      pos[i3] *= R / rr;
      pos[i3 + 2] *= R / rr;
    }
    return true;
  }

  // ---------------------------------------------------------------- per frame
  /** Runs one effect. A failure is logged once and never stops the other effects (or the liquid body itself). */
  private safe(name: string, fn: () => void) {
    try {
      fn();
    } catch (e) {
      if (this.failed.has(name)) return;
      this.failed.add(name);
      console.warn(`[effects] ${name} failed (the other effects keep running)`, e);
    }
  }

  public tick(dt: number, time: number) {
    this.time = time;
    const snap = this.snap;
    const p = this.profile;
    const L = this.liquid;
    const fill = L.fillY;
    const hasLiquid = L.volumeMl > 0.05 && !this.burst;
    const surfR = L.surfaceRadius;
    const hex = L.getApparentHex();
    if (hex !== this.appHex) {
      this.appHex = hex;
      this.appColor.set(hex);
    }
    const col = this.appColor;

    // ---- bubbles
    this.safe('bubbles', () => {
      if (snap && hasLiquid) {
        const boiling = snap.boil_intensity > 0.02;
        for (const g of snap.gas_fluxes) {
          // the vapour of a boiling liquid is drawn by the boil path below (bubbles born on the hot floor that grow as
          // they rise); spawning it here too would double it with bulk bubbles of the wrong size and place
          if (boiling && this.isVapourOfLiquid(g, snap)) continue;
          this.spawnGas(g, dt, fill);
        }
        if (boiling) {
          this.spawnAcc.boil += boilVigour(snap.boil_intensity) * 320 * dt;
          const scale = Math.min(1.2, p.rimInnerRadius / 2.5);
          const R = innerRadiusAt(p, p.innerBottomY + 0.3) * 0.85;
          let guard = 0;
          while (this.spawnAcc.boil >= 1 && guard++ < 40) {
            this.spawnAcc.boil -= 1;
            const a = Math.random() * Math.PI * 2;
            const rr = Math.sqrt(Math.random()) * R;
            const rad = rnd(0.05, 0.16) * scale * (0.6 + boilVigour(snap.boil_intensity) * 0.5);
            this.bubbles.spawn(Math.cos(a) * rr, p.innerBottomY + rad, Math.sin(a) * rr, rad, rnd(14, 26), 1, rnd(2.0, 3.4), 0.55 * scale * (0.6 + boilVigour(snap.boil_intensity) * 0.5));
          }
          if (this.spawnAcc.boil > 2) this.spawnAcc.boil = 2;
        }
      }
      const swirl = this.stirRpm > 0 ? Math.min(4.5, (this.stirRpm / 60) * 6.283 * 0.12) : 0;
      const pops = { n: 0 };
      this.bubbles.material.uniforms.uTint.value.copy(col);
      this.bubbles.update(dt, hasLiquid ? fill : -1e3, (y) => innerRadiusAt(p, Math.min(y, p.innerTopY)), swirl, (x, y, z, r) => {
        pops.n++;
        if (pops.n < 6) {
          this.splash.spawn(x, y + 0.02, z, 0, r * 6, 0, 0.12, r * 1.6, r * 3.2, 0.45, 1, 1, 1, 0, 0, 1);
          if (r > 0.12 && Math.random() < 0.5) {
            const a = Math.random() * 6.28;
            this.splash.spawn(x, y + 0.05, z, Math.cos(a) * 8, rnd(25, 60), Math.sin(a) * 8, 0.5, r * 0.5, r * 0.3, 0.8, col.r, col.g, col.b, 981, 0, 1);
          }
        }
      });
    });

    // ---- foam head
    this.safe('foam', () => {
      this.foamLevel += (this.foamTarget - this.foamLevel) * Math.min(1, dt * 1.5);
      this.updateFoam(time, fill, hasLiquid, col);
    });

    // ---- incandescence
    this.safe('glow', () => {
      this.glowLevel += (this.glowTarget - this.glowLevel) * Math.min(1, dt * 1.5);
      this.glow.visible = this.glowLevel > 0.01 && !this.burst;
      this.glowMat.opacity = this.glowLevel * 0.55;
    });

    // ---- condensation
    this.safe('condensation', () => {
      const condA = this.cond.visible ? (this.condMat.uniforms.uAmount.value as number) : 0;
      const condT = this.burst ? 0 : this.condLevel;
      const condNew = condA + (condT - condA) * Math.min(1, dt * 0.8);
      this.condMat.uniforms.uAmount.value = condNew;
      this.cond.visible = condNew > 0.01;
    });

    // ---- steam & fumes
    this.safe('steam/fumes', () => {
      if (snap && !this.burst) {
        const vis = snap.vapour_visibility;
        if (vis > 0.01) {
          this.spawnAcc.steam += vis * 20 * dt;
          while (this.spawnAcc.steam >= 1) {
            this.spawnAcc.steam -= 1;
            const a = Math.random() * Math.PI * 2;
            const rr = Math.sqrt(Math.random()) * surfR * 0.8;
            const y = hasLiquid ? fill + 0.2 : p.innerBottomY + 0.5;
            const s0 = Math.min(2, surfR * 0.5);
            this.smoke.spawn(Math.cos(a) * rr, y, Math.sin(a) * rr, rnd(-0.5, 0.5), rnd(3.5, 7), rnd(-0.5, 0.5), rnd(2.4, 3.6), s0, s0 * 3.5 + 2, Math.min(0.2, 0.06 + vis * 0.1), 0.94, 0.95, 0.97, -0.6, 0.35, 0);
          }
        }
        for (const f of snap.fumes) this.spawnFume(f, dt, hasLiquid ? fill : p.innerBottomY + 0.5, surfR);
      }
    });

    // ---- boil-over spill
    this.safe('spill', () => {
      if (this.spillTime > 0 && !this.burst) {
        this.spillTime -= dt;
        this.spawnAcc.spill += 40 * dt;
        while (this.spawnAcc.spill >= 1) {
          this.spawnAcc.spill -= 1;
          const a = Math.random() * Math.PI * 2;
          const R = p.rimOuterRadius + 0.15;
          const foamy = this.foamLevel > 0.2 || Math.random() < 0.4;
          const c = foamy ? new THREE.Color(0.95, 0.96, 0.97) : col;
          this.splash.spawn(Math.cos(a) * R, p.rimY, Math.sin(a) * R, 0, rnd(-3, 0), 0, rnd(1.5, 2.5), rnd(0.35, 0.6), rnd(0.5, 0.9), 0.85, c.r, c.g, c.b, 60, 0.5, 4);
        }
        this.ensurePuddle(col, p.maxOuterRadius + 2.5);
      }
    });

    // ---- precipitate cloud
    this.safe('precipitate cloud', () => {
      const want = hasLiquid ? this.suspendedTargetCount : 0;
      if (this.precip.live < want) {
        this.spawnAcc.precip += Math.max(30, want) * dt * 2;
        while (this.spawnAcc.precip >= 1 && this.precip.live < want) {
          this.spawnAcc.precip -= 1;
          const y = rnd(p.innerBottomY + 0.2, Math.max(p.innerBottomY + 0.3, fill - 0.1));
          const R = innerRadiusAt(p, y) * 0.92;
          const a = Math.random() * Math.PI * 2;
          const rr = Math.sqrt(Math.random()) * R;
          const shade = rnd(0.85, 1.1);
          const sc = this.suspendedColor;
          const sz = suspendedSpriteCm(this.suspendedDiameterUm) * rnd(0.75, 1.3) * Math.min(1.0, Math.max(0.5, p.rimInnerRadius / 3)); // world-size diameter (cm)
          this.precip.spawn(Math.cos(a) * rr, y, Math.sin(a) * rr, 0, 0, 0, rnd(5, 10), sz, sz * 1.2, 0.7, sc.r * shade, sc.g * shade, sc.b * shade, 0, 0, 0);
        }
      } else if (this.precip.live > want + 10) {
        // let the extras settle out quickly by shortening their life
        for (let i = want; i < this.precip.live; i++) this.precip.maxLife[i] = Math.min(this.precip.maxLife[i], this.precip.life[i] + 0.8);
      }
    });

    // ---- settled bed
    this.safe('settled bed', () => {
      this.bedVol += (this.bedTargetVol - this.bedVol) * Math.min(1, dt * 1.2);
      this.bedColor.lerp(this.bedColorTarget, Math.min(1, dt * 2));
      this.updateBed();
    });

    // ---- lumps (gel/curds)
    this.safe('lumps', () => {
      if (this.lumpCount > 0 && !this.burst) this.updateLumps(time, fill, hasLiquid);
    });

    // ---- floating pieces / frozen mass / film / metal
    this.safe('solid pieces', () => {
      const fizz = snap ? snap.gas_fluxes.some((g) => g.nucleation === 'solid' && g.rate_ml_s > 0.01) : false;
      this.pieces.update(dt, time, { fill, hasLiquid, bedY: Math.max(this.bedLevelY(), p.innerBottomY), stirRpm: this.stirRpm, fizz, burst: this.burst, up: this.liquid.uniforms.uUpObj.value, layerTops: this.liquid.layerTopsY() });
    });

    // ---- stir bar
    this.safe('stir bar', () => {
      if (this.stirRpm > 0 && !this.burst) {
        this.stirBar.visible = true;
        this.stirAngle += Math.min(30, (this.stirRpm / 60) * 6.283) * dt;
        this.stirBar.rotation.y = this.stirAngle;
      } else {
        this.stirBar.visible = false;
      }
    });

    // ---- flame
    this.safe('flame', () => {
      const fl = snap?.flame;
      if (fl && fl.power_w > 0.5 && !this.burst) {
        const h = flameHeightCm(fl.power_w, surfR * 2);
        const w = Math.max(1.5, surfR * 1.5);
        const em = fl.emitter_rgb ? new THREE.Color(fl.emitter_rgb[0], fl.emitter_rgb[1], fl.emitter_rgb[2]) : undefined;
        this.flame.configure(surfR * 0.6, w, h, { luminosity: Math.max(0, Math.min(1, fl.luminosity)), base: em, emitter: em, emitterAmount: em ? Math.min(0.9, fl.metal_share ?? 0) : 0, sootTempK: fl.flame_temp_k });
        this.flame.setTarget(Math.min(1.6, 0.6 + fl.power_w / 300));
        this.flame.group.position.y = hasLiquid ? fill : p.innerBottomY + 0.2;
      } else {
        this.flame.setTarget(0);
      }
      this.flame.tick(dt, time);
    });

    // ---- stopper flight
    this.safe('stopper', () => {
      if (this.stopperFlying) this.updateStopper(dt);
    });

    // ---- shards / puddle
    this.safe('shards/puddle', () => {
      if (this.shards) this.updateShards(dt);
      if (this.puddle) {
        this.puddleR += (this.puddleTarget - this.puddleR) * Math.min(1, dt * 1.8);
        this.puddle.scale.setScalar(Math.max(0.01, this.puddleR));
      }
    });

    this.safe('smoke', () => this.smoke.update(dt));
    this.safe('splash', () => this.splash.update(dt));
    this.safe('precipitate particles', () => this.precip.update(dt));
  }

  /** Which electrode a gas flux comes from (the cell reaction that has the gas among its products), if any. */
  private electrodeFor(g: GasFlux): 'anode' | 'cathode' | null {
    const e = this.snap?.electrolysis;
    if (!e) return null;
    const strip = (id: string) => id.replace(/\((g|aq|s|l)\)$/, '');
    const want = strip(g.species);
    for (const row of e.rows) {
      const products = row.equation.split(/->|→|=>/)[1] ?? '';
      for (const tok of products.trim().split(/\s+/)) if (strip(tok) === want) return row.electrode === 'anode' ? 'anode' : 'cathode';
    }
    return null;
  }

  /** True when the flux is the vapour of a liquid present in the vessel (its species is "X(g)" and X is a liquid component). */
  private isVapourOfLiquid(g: GasFlux, snap: VesselSnapshot): boolean {
    const base = g.species.replace(/\(g\)$/, '');
    return snap.species.some((r) => r.id === base && (r.phase === 'aqueous' || r.phase === 'organic') && r.amount_mol > 1e-6);
  }

  private spawnGas(g: GasFlux, dt: number, fill: number) {
    if (g.rate_ml_s <= 1e-4) return;
    const p = this.profile;
    let dmm = Math.max(0.4, Math.min(6, g.bubble_diameter_mm || 2));
    let perSec = g.rate_ml_s / ((Math.PI / 6) * Math.pow(dmm / 10, 3));
    // A vigorous reaction releases far more gas than the bubble budget can show as individual 1 mm bubbles: past the
    // budget the bubbles merge into larger ones (up to ~3.5 mm, as they do in a real fizzing liquid) and the rest is
    // the milky haze of micro-bubbles the liquid body adds (`setGasAgitation`).
    const maxRate = 800;
    if (perSec > maxRate) {
      dmm = Math.min(3.5, dmm * Math.cbrt(perSec / maxRate));
      perSec = maxRate;
    }
    this.spawnAcc.bubbles += perSec * dt;
    const radius = dmm / 20;
    const speed = Math.min(30, 5 + dmm * 5.5);
    const bedY = this.bedLevelY();
    let guard = 0;
    while (this.spawnAcc.bubbles >= 1 && guard++ < 40) {
      this.spawnAcc.bubbles -= 1;
      const r = radius * rnd(0.6, 1.3);
      let x = 0, y = 0, z = 0;
      const top = Math.max(p.innerBottomY + 0.2, fill - 0.2);
      if (g.nucleation === 'wall') {
        y = rnd(p.innerBottomY + 0.15, top);
        const R = innerRadiusAt(p, y) - r - 0.02;
        const a = Math.random() * Math.PI * 2;
        x = Math.cos(a) * R;
        z = Math.sin(a) * R;
      } else if (g.nucleation === 'solid') {
        const el = this.electrodeFor(g);
        if (el) {
          // gas evolved by an electrode forms on that rod (H2 at the cathode, O2 / Cl2 at the anode), mostly low on it
          const bottom = electrodeBottomY(fill + p.baseOffsetY) - p.baseOffsetY;
          const a = Math.random() * Math.PI * 2;
          x = (el === 'anode' ? -ELECTRODE_X : ELECTRODE_X) + Math.cos(a) * (ELECTRODE_RADIUS + r);
          z = Math.sin(a) * (ELECTRODE_RADIUS + r);
          y = bottom + 0.15 + Math.pow(Math.random(), 1.6) * Math.max(0.1, top - bottom - 0.15);
        } else if (this.pieces.nucleationPoint(tmpP, top)) {
          x = tmpP.x;
          y = tmpP.y;
          z = tmpP.z;
        } else {
          y = Math.max(bedY, p.innerBottomY) + 0.05 + r;
          const R = innerRadiusAt(p, y) * 0.85;
          const a = Math.random() * Math.PI * 2;
          const rr = Math.sqrt(Math.random()) * R;
          x = Math.cos(a) * rr;
          z = Math.sin(a) * rr;
        }
      } else {
        y = rnd(p.innerBottomY + 0.15, top);
        const R = innerRadiusAt(p, y) * 0.9;
        const a = Math.random() * Math.PI * 2;
        const rr = Math.sqrt(Math.random()) * R;
        x = Math.cos(a) * rr;
        z = Math.sin(a) * rr;
      }
      this.bubbles.spawn(x, y, z, r, speed * rnd(0.8, 1.2));
    }
    if (this.spawnAcc.bubbles > 2) this.spawnAcc.bubbles = 2;
  }

  private spawnFume(f: FumeVisual, dt: number, y0: number, surfR: number) {
    if (f.intensity <= 0.005) return;
    this.spawnAcc.fume += f.intensity * 26 * dt;
    while (this.spawnAcc.fume >= 1) {
      this.spawnAcc.fume -= 1;
      const a = Math.random() * Math.PI * 2;
      const rr = Math.sqrt(Math.random()) * surfR * 0.8;
      const s0 = Math.min(1.8, surfR * 0.5);
      const alpha = Math.min(0.5, 0.08 + f.opacity * 0.35) * Math.min(1, 0.4 + f.intensity);
      if (f.denser_than_air) {
        this.smoke.spawn(Math.cos(a) * rr, y0 + 0.2, Math.sin(a) * rr, 0, rnd(1.2, 2.5), 0, rnd(4, 6), s0, s0 * 3 + 2, alpha, f.rgb[0], f.rgb[1], f.rgb[2], 0, 0.6, 2);
      } else {
        this.smoke.spawn(Math.cos(a) * rr, y0 + 0.2, Math.sin(a) * rr, rnd(-0.4, 0.4), rnd(3, 6), rnd(-0.4, 0.4), rnd(2.5, 3.5), s0, s0 * 3 + 2, alpha, f.rgb[0], f.rgb[1], f.rgb[2], -0.4, 0.3, 1);
      }
    }
  }

  private updateFoam(time: number, fill: number, hasLiquid: boolean, col: THREE.Color) {
    const p = this.profile;
    const lvl = hasLiquid ? this.foamLevel : 0;
    if (lvl < 0.02) {
      this.foam.visible = false;
      return;
    }
    const maxH = Math.max(0.3, Math.min(p.rimY + 1.0 - fill, 1.2 + p.rimInnerRadius * 0.8));
    const H = lvl * maxH;
    const baseR = Math.min(0.32, Math.max(0.1, p.rimInnerRadius * 0.08));
    const layerH = baseR * 1.3;
    let n = 0;
    const gasy = (this.snap?.gas_fluxes.length ?? 0) > 0 ? 1 : 0.3;
    for (let i = 0; i < this.foamCells.length; i++) {
      const c = this.foamCells[i];
      const h = c.layer * layerH;
      // the top layer grows in by coverage fraction so the head rises smoothly
      if (h > H + layerH * 0.5) continue;
      if (c.layer === 0 && c.u > 0.15 + lvl * 3) continue;
      const y = fill + h + baseR * 0.4;
      const R = Math.max(0.1, innerRadiusAt(this.profile, Math.min(y, p.innerTopY)) - baseR * 0.6);
      const over = y > p.innerTopY ? (y - p.innerTopY) * 0.6 : 0;
      const rr = c.u * (R + over);
      const wob = Math.sin(time * 2.5 + c.ph) * 0.08 * gasy;
      const s = baseR * c.r * (1 + wob) * (h > H ? Math.max(0.2, 1 - (h - H) / (layerH * 0.5)) : 1);
      tmpP.set(Math.cos(c.v) * rr, y, Math.sin(c.v) * rr);
      tmpS.set(s, s * 0.85, s);
      tmpM.compose(tmpP, tmpQ.identity(), tmpS);
      this.foam.setMatrixAt(n, tmpM);
      n++;
    }
    this.foam.count = n;
    this.foam.visible = n > 0;
    this.foamMat.color.setRGB(0.9 + col.r * 0.1, 0.9 + col.g * 0.1, 0.9 + col.b * 0.1);
    this.foam.instanceMatrix.needsUpdate = true;
  }

  /** Height of the inner floor at radius r (follows the rounded corner / hemispherical tube bottom). */
  private floorYAt(r: number): number {
    const pts = this.profile.inner;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      if (b.x >= r && b.x > a.x && a.x <= r) return a.y + ((b.y - a.y) * (r - a.x)) / Math.max(1e-6, b.x - a.x);
    }
    return this.profile.innerBottomY;
  }

  /** Surface height of the settled bed at radius r: flat layer + powder heap (paraboloid, angle-of-repose-ish). */
  private bedSurfaceAt(r: number): number {
    const { yb, rp, H } = this.bed;
    const q = rp > 1e-4 ? Math.max(0, 1 - (r / rp) * (r / rp)) : 0;
    return Math.max(this.floorYAt(r) + 0.012, yb + H * q);
  }

  /** Representative resting level of the solids (flat layer + a bit of the heap); used by bubbles / ribbon / lumps. */
  private bedLevelY(): number {
    const p = this.profile;
    if (this.bedVol < 0.003) return p.innerBottomY;
    return this.bed.yb + this.bed.H * 0.5;
  }

  /**
   * Settled solids: a heaped bed built from the snapshot's settled volume. Fine powder piles up (it does not
   * spread into a uniform film), so even 0.1 g of powder is a visible mound; a large amount fills the floor and
   * keeps a mound on top. Generic - driven only by `settled_volume_ml` and the solid's reflectance colour.
   */
  private updateBed() {
    const p = this.profile;
    const V = this.bedVol;
    if (V < 0.003 || this.burst) {
      this.bed.vol = -1;
      this.bed.sig = '';
      if (this.bedSide) this.bedSide.visible = false;
      if (this.bedTop) this.bedTop.visible = false;
      return;
    }
    const wet = this.liquid.volumeMl > 0.3;
    const k = wet ? 0.2 : 0.34; // heap height / footprint radius (wet powder is flatter)
    const rW = Math.max(0.12, innerRadiusAt(p, p.innerBottomY + 0.25) - 0.05);
    // a few mg of powder would otherwise be a sub-pixel speck at bench distance: keep a minimum visible mound
    let rp = Math.max(Math.cbrt((2 * V) / (Math.PI * k)), Math.min(0.5, rW));
    let yb = p.innerBottomY;
    let H = k * rp;
    if (rp > rW) {
      rp = rW;
      H = k * rW;
      const vCap = (Math.PI * rp * rp * H) / 2;
      yb = heightForVolume(p, Math.max(0, V - vCap));
    }
    yb = Math.min(yb, p.innerTopY - 0.4);
    H = Math.min(H, Math.max(0.05, p.innerTopY - 0.2 - yb));
    const rim = innerRadiusAt(p, Math.max(yb, p.innerBottomY + 0.05)) - 0.04;
    const flat = yb > p.innerBottomY + 0.03;
    const rS = flat ? Math.max(0.1, rim) : Math.max(0.1, Math.min(rp, rim));
    const prev = this.bed;
    const sig = this.bedLayers.map((l) => `${Math.round(l.vol * 40)}:${l.rgb.map((c) => c.toFixed(2)).join(',')}`).join('|');
    const same = prev.vol >= 0 && prev.wet === wet && prev.sig === sig && Math.abs(V - prev.vol) / Math.max(V, 0.02) < 0.015;
    this.bed = { yb, rp, H, rS, wet, vol: same ? prev.vol : V, sig };
    if (same && this.bedSide && this.bedTop) {
      this.bedSide.visible = flat;
      this.bedTop.visible = true;
      return;
    }

    // side wall of the flat layer: lathe of the inner profile up to yb
    let sideG: THREE.BufferGeometry | null = null;
    if (flat) {
      const pts: THREE.Vector2[] = [];
      for (const q of p.inner) {
        if (q.y < yb) pts.push(new THREE.Vector2(Math.max(0, q.x - 0.04), q.y + 0.01));
      }
      pts.push(new THREE.Vector2(rS, this.bedSurfaceAt(rS)));
      sideG = new THREE.LatheGeometry(pts, 48);
      this.colourBed(sideG, false, 0);
    }
    // top: radial height-field (heap + grain)
    const J = 20;
    const S = 48;
    const pos = new Float32Array((1 + J * S) * 3);
    const seed = this.bedSeed;
    const idx: number[] = [];
    const heightAt = (x: number, z: number, r: number) => {
      const base = this.bedSurfaceAt(r);
      const rel = rp > 1e-4 ? Math.max(0, 1 - r / rp) : 0;
      const grain = (Math.sin(x * 24.0 + seed) * Math.cos(z * 20.0 - seed) * 0.5 + Math.sin(x * 52.0 + z * 44.0) * 0.25) * (0.002 + Math.min(0.006, H * 0.02) * Math.min(1, rel * 2));
      return Math.min(p.innerTopY - 0.1, base + grain);
    };
    pos[0] = 0;
    pos[1] = heightAt(0, 0, 0);
    pos[2] = 0;
    for (let j = 1; j <= J; j++) {
      const r = (rS * j) / J;
      for (let i = 0; i < S; i++) {
        const a = (i / S) * Math.PI * 2;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        const o = (1 + (j - 1) * S + i) * 3;
        pos[o] = x;
        pos[o + 1] = heightAt(x, z, r);
        pos[o + 2] = z;
      }
    }
    for (let i = 0; i < S; i++) idx.push(0, 1 + ((i + 1) % S), 1 + i);
    for (let j = 1; j < J; j++) {
      const a0 = 1 + (j - 1) * S;
      const a1 = 1 + j * S;
      for (let i = 0; i < S; i++) {
        const i1 = (i + 1) % S;
        idx.push(a0 + i, a0 + i1, a1 + i, a0 + i1, a1 + i1, a1 + i);
      }
    }
    const topG = new THREE.BufferGeometry();
    topG.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    topG.setIndex(idx);
    topG.computeVertexNormals();
    this.colourBed(topG, true, seed);

    if (!this.bedTop) {
      this.bedTop = new THREE.Mesh(topG, this.bedMat);
      this.bedTop.raycast = () => {};
      this.bedTop.receiveShadow = true;
      this.bedTop.frustumCulled = false;
      this.bedSide = new THREE.Mesh(sideG ?? new THREE.BufferGeometry(), this.bedMat);
      this.bedSide.raycast = () => {};
      this.bedSide.receiveShadow = true;
      this.bedSide.frustumCulled = false;
      this.group.add(this.bedSide, this.bedTop);
    } else {
      this.bedTop.geometry.dispose();
      this.bedTop.geometry = topG;
      this.bedSide!.geometry.dispose();
      this.bedSide!.geometry = sideG ?? new THREE.BufferGeometry();
    }
    this.bedSide!.visible = flat;
    this.bedTop.visible = true;
    this.placeCrystals();
  }

  /**
   * Vertex colours of the settled bed from the engine's solids (bottom first). The flat layer's wall shows them as bands
   * by cumulative volume; the heap's surface is a mottled mix weighted towards what settled last (it is on top), so a
   * white and a black precipitate make a speckled grey bed, not a flat average.
   */
  private colourBed(g: THREE.BufferGeometry, top: boolean, seed: number) {
    const pos = g.attributes.position as THREE.BufferAttribute;
    const n = pos.count;
    const col = new Float32Array(n * 3);
    const L = this.bedLayers;
    const m = L.length;
    if (m <= 1) {
      const c = m === 1 ? L[0].rgb : [this.bedColorTarget.r, this.bedColorTarget.g, this.bedColorTarget.b];
      for (let i = 0; i < n; i++) {
        // a little tonal grain so a single powder is not a flat paint
        const k = top ? 0.94 + 0.12 * Math.sin(pos.getX(i) * 31 + pos.getZ(i) * 17 + seed) * Math.cos(pos.getZ(i) * 23 - seed) : 1;
        col[i * 3] = c[0] * k;
        col[i * 3 + 1] = c[1] * k;
        col[i * 3 + 2] = c[2] * k;
      }
    } else {
      let total = 0;
      const wTop: number[] = [];
      const cumVol: number[] = [];
      let acc = 0;
      for (let i = 0; i < m; i++) {
        acc += L[i].vol;
        cumVol.push(acc);
        wTop.push(L[i].vol * (1 + 0.9 * i));
        total += wTop[i];
      }
      const cumTop: number[] = [];
      let a2 = 0;
      for (let i = 0; i < m; i++) {
        a2 += wTop[i] / total;
        cumTop.push(a2);
      }
      const yEdge = cumVol.map((v) => heightForVolume(this.profile, v));
      const soft = 0.06;
      for (let i = 0; i < n; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        let c0 = 0, c1 = 0, c2 = 0;
        if (top) {
          // two octaves of smooth value noise in [0,1]
          const u = Math.min(
            1,
            Math.max(0, 0.5 + 0.34 * Math.sin(x * 4.7 + seed) * Math.cos(z * 4.1 - seed * 0.7) + 0.2 * Math.sin(x * 11.3 + z * 9.1 + seed * 1.9) + 0.12 * Math.sin(x * 29 - z * 25 + seed))
          );
          let j = 0;
          while (j < m - 1 && u > cumTop[j]) j++;
          const lo = j > 0 ? cumTop[j - 1] : 0;
          const hi = cumTop[j];
          // blend towards the neighbouring solid near the boundary
          const edge = Math.min(u - lo, hi - u);
          const nb = edge < soft ? (j === 0 || (hi - u) < (u - lo) ? Math.min(m - 1, j + 1) : j - 1) : j;
          const f = edge < soft ? 0.5 * (1 - edge / soft) : 0;
          c0 = L[j].rgb[0] * (1 - f) + L[nb].rgb[0] * f;
          c1 = L[j].rgb[1] * (1 - f) + L[nb].rgb[1] * f;
          c2 = L[j].rgb[2] * (1 - f) + L[nb].rgb[2] * f;
        } else {
          let j = 0;
          while (j < m - 1 && y > yEdge[j] + 0.0) j++;
          const d = j < m - 1 ? yEdge[j] - y : 1;
          const f = d < soft ? 0.5 * (1 - d / soft) : 0;
          const nb = Math.min(m - 1, j + 1);
          c0 = L[j].rgb[0] * (1 - f) + L[nb].rgb[0] * f;
          c1 = L[j].rgb[1] * (1 - f) + L[nb].rgb[1] * f;
          c2 = L[j].rgb[2] * (1 - f) + L[nb].rgb[2] * f;
        }
        col[i * 3] = c0;
        col[i * 3 + 1] = c1;
        col[i * 3 + 2] = c2;
      }
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }

  private updateLumps(time: number, fill: number, hasLiquid: boolean) {
    const p = this.profile;
    const bed = Math.max(this.bedLevelY(), p.innerBottomY);
    for (let i = 0; i < this.lumpCount; i++) {
      const L = this.lumpState[i];
      let y: number;
      if (L.susp && hasLiquid) {
        y = bed + 0.3 + L.floatY * Math.max(0.2, fill - bed - 0.6) + Math.sin(time * 0.6 + L.ph) * 0.15;
      } else {
        y = bed + L.s * 0.5;
      }
      const R = Math.max(0.1, innerRadiusAt(p, y) - L.s);
      const a = L.ph + (L.susp ? time * 0.15 : 0) + (this.stirRpm > 0 ? time * 1.5 : 0);
      const rr = R * (0.2 + 0.75 * ((L.ph * 7.3) % 1));
      L.x = Math.cos(a) * rr;
      L.z = Math.sin(a) * rr;
      L.y = y;
      tmpP.set(L.x, L.y, L.z);
      tmpQ.setFromEuler(tmpE.set(L.ph, L.ph * 2, 0));
      tmpS.set(L.s, L.s * 0.7, L.s * 0.9);
      tmpM.compose(tmpP, tmpQ, tmpS);
      this.lumps.setMatrixAt(i, tmpM);
    }
    this.lumps.instanceMatrix.needsUpdate = true;
  }

  private updateStopper(dt: number) {
    this.stopperT += dt;
    const s = this.stopper;
    this.stopperV.y -= 981 * dt;
    s.position.addScaledVector(this.stopperV, dt);
    s.rotation.x += this.stopperW.x * dt;
    s.rotation.y += this.stopperW.y * dt;
    s.rotation.z += this.stopperW.z * dt;
    const floor = this.floorY + s.scale.y * 0.5;
    if (s.position.y < floor) {
      s.position.y = floor;
      this.stopperV.y = Math.abs(this.stopperV.y) * 0.35;
      this.stopperV.x *= 0.6;
      this.stopperV.z *= 0.6;
      this.stopperW.multiplyScalar(0.5);
      if (this.stopperV.y < 20) {
        this.stopperV.set(0, 0, 0);
        this.stopperW.set(0, 0, 0);
        s.rotation.x = Math.PI / 2;
      }
    }
    if (this.stopperT > 6) {
      this.stopperFlying = false;
      s.visible = this.sealed;
      s.position.set(0, s.userData.homeY, 0);
      s.rotation.set(0, 0, 0);
    }
  }

  private updateShards(dt: number) {
    const sh = this.shards!;
    let moving = false;
    for (let i = 0; i < this.shardState.length; i++) {
      const S = this.shardState[i];
      if (!S.rest) {
        moving = true;
        S.v.y -= 981 * dt;
        S.p.addScaledVector(S.v, dt);
        S.r.x += S.w.x * dt;
        S.r.y += S.w.y * dt;
        S.r.z += S.w.z * dt;
        const floor = this.floorY + 0.04;
        if (S.p.y < floor) {
          S.p.y = floor;
          S.v.y = Math.abs(S.v.y) * 0.25;
          S.v.x *= 0.45;
          S.v.z *= 0.45;
          S.w.multiplyScalar(0.4);
          if (S.v.y < 15) {
            S.rest = true;
            S.r.x = Math.PI / 2 + rnd(-0.1, 0.1);
            S.r.y = rnd(-0.1, 0.1);
          }
        }
      }
      tmpQ.setFromEuler(S.r);
      tmpS.setScalar(S.s);
      tmpM.compose(S.p, tmpQ, tmpS);
      sh.setMatrixAt(i, tmpM);
    }
    sh.count = this.shardState.length;
    if (moving) sh.instanceMatrix.needsUpdate = true;
  }

  /** Brightness of any flame in this vessel (for the shared fire light) and its local height. */
  public flameStrength(time: number): number {
    return this.flame.brightness(time);
  }
  public flameLocalY(): number {
    return this.flame.group.position.y + 3;
  }

  public isAnimating(): boolean {
    return (
      this.stopperFlying ||
      (!!this.shards && this.shardState.some((s) => !s.rest)) ||
      this.stirRpm > 0 ||
      this.bubbles.live > 0
    );
  }

  public dispose() {
    this.bubbles.dispose();
    this.smoke.dispose();
    this.splash.dispose();
    this.precip.dispose();
    this.flame.dispose();
    this.foamMat.dispose();
    this.foam.dispose();
    this.condMat.dispose();
    this.glow.geometry.dispose();
    this.glowMat.dispose();
    this.bedMat.dispose();
    this.bedSide?.geometry.dispose();
    this.bedTop?.geometry.dispose();
    (this.crystals.material as THREE.Material).dispose();
    this.crystals.dispose();
    (this.lumps.material as THREE.Material).dispose();
    this.lumps.dispose();
    this.pieces.dispose();
    (this.stirBar.material as THREE.Material).dispose();
    (this.stopper.material as THREE.Material).dispose();
    if (this.shards) {
      (this.shards.material as THREE.Material).dispose();
      this.shards.dispose();
    }
    if (this.puddle) {
      this.puddle.geometry.dispose();
      this.puddleMat?.dispose();
    }
  }
}
