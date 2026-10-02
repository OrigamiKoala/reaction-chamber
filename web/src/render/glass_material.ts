import * as THREE from 'three';

/**
 * Thin-walled glass without the transmission pass (which would hide liquids inside).
 *
 * The glass is drawn in two halves split by a plane through the vessel axis facing the camera:
 *   - FAR half  (renderOrder base+1): drawn before the liquid,
 *   - NEAR half (renderOrder base+5): drawn after the liquid / bubbles.
 * Output is premultiplied (ONE, ONE_MINUS_SRC_ALPHA): reflections are added at full strength while the
 * body of the glass only slightly veils what is behind it; alpha rises with Fresnel at grazing angles,
 * which gives the bright/green "thick edge" look of real borosilicate.
 */
export interface GlassOptions {
  tint: THREE.ColorRepresentation;
  baseAlpha: number;
  fresnelAlpha: number;
  edgeTint: THREE.ColorRepresentation;
  roughness: number;
  envMapIntensity: number;
}

const DEFAULT_GLASS: GlassOptions = {
  tint: 0xf2f8f5,
  baseAlpha: 0.022,
  fresnelAlpha: 0.38,
  edgeTint: 0x6fa595,
  roughness: 0.035,
  envMapIntensity: 0.5,
};

export function makeGlassMaterial(far: boolean, o: Partial<GlassOptions> = {}): THREE.MeshPhysicalMaterial {
  const opt = { ...DEFAULT_GLASS, ...o };
  const m = new THREE.MeshPhysicalMaterial({
    color: opt.tint,
    metalness: 0,
    roughness: opt.roughness,
    ior: 1.47,
    specularIntensity: 0.65,
    clearcoat: 0.0,
    clearcoatRoughness: 0.04,
    envMapIntensity: opt.envMapIntensity,
    transparent: true,
    opacity: opt.baseAlpha,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  m.blending = THREE.CustomBlending;
  m.blendEquation = THREE.AddEquation;
  m.blendSrc = THREE.OneFactor;
  m.blendDst = THREE.OneMinusSrcAlphaFactor;
  m.blendSrcAlpha = THREE.OneFactor;
  m.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
  m.defines = { ...(m.defines || {}), ...(far ? { GLASS_FAR: '' } : { GLASS_NEAR: '' }) };
  const edge = new THREE.Color(opt.edgeTint);
  const fres = opt.fresnelAlpha;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uFresnelAlpha = { value: fres };
    shader.uniforms.uEdgeTint = { value: edge };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGW;\nvarying vec3 vGC;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec4 gwp = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          gwp = instanceMatrix * gwp;
          vGC = ( modelMatrix * instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
        #else
          vGC = ( modelMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
        #endif
        vGW = ( modelMatrix * gwp ).xyz;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vGW;\nvarying vec3 vGC;\nuniform float uFresnelAlpha;\nuniform vec3 uEdgeTint;'
      )
      .replace(
        'void main() {',
        `void main() {
        {
          vec2 toFrag = vGW.xz - vGC.xz;
          vec2 toCam = cameraPosition.xz - vGC.xz;
          float sideTest = dot( toFrag, toCam );
          #ifdef GLASS_FAR
            if ( sideTest > 0.0 ) discard;
          #else
            if ( sideTest <= 0.0 ) discard;
          #endif
        }`
      )
      .replace(
        '#include <opaque_fragment>',
        `{
          float glNV = abs( dot( normalize( normal ), normalize( vViewPosition ) ) );
          float glF = pow( 1.0 - glNV, 3.0 );
          float glA = clamp( diffuseColor.a + glF * uFresnelAlpha, 0.0, 1.0 );
          vec3 glSpec = max( outgoingLight - totalDiffuse, vec3( 0.0 ) );
          #ifdef GLASS_FAR
            float specFactor = 0.35;
          #else
            float specFactor = 0.6;
          #endif
          vec3 col = totalDiffuse * glA + glSpec * specFactor + uEdgeTint * glF * glA * 0.25;
          gl_FragColor = vec4( col, glA );
        }`
      );
  };
  // Same source for every glass material -> one program per define set.
  m.customProgramCacheKey = () => (far ? 'glass_far' : 'glass_near');
  return m;
}

let clearPair: [THREE.MeshPhysicalMaterial, THREE.MeshPhysicalMaterial] | null = null;
let amberPair: [THREE.MeshPhysicalMaterial, THREE.MeshPhysicalMaterial] | null = null;

/** Shared clear borosilicate [far, near]. */
export function clearGlass(): [THREE.MeshPhysicalMaterial, THREE.MeshPhysicalMaterial] {
  if (!clearPair) clearPair = [makeGlassMaterial(true), makeGlassMaterial(false)];
  return clearPair;
}

/** Shared amber (brown) bottle glass [far, near]. */
export function amberGlass(): [THREE.MeshPhysicalMaterial, THREE.MeshPhysicalMaterial] {
  if (!amberPair) {
    const o: Partial<GlassOptions> = {
      tint: 0x4a2008,
      baseAlpha: 0.55,
      fresnelAlpha: 0.25,
      edgeTint: 0x7a3a0a,
      roughness: 0.05,
      envMapIntensity: 0.5,
    };
    amberPair = [makeGlassMaterial(true, o), makeGlassMaterial(false, o)];
  }
  return amberPair;
}

/**
 * Create the far/near glass meshes for a geometry. Returns the near mesh (with the far mesh as a child so that
 * toggling visibility of the returned mesh hides both).
 */
export function createGlassMesh(
  geo: THREE.BufferGeometry,
  pair: [THREE.Material, THREE.Material] = clearGlass()
): { near: THREE.Mesh; far: THREE.Mesh } {
  const near = new THREE.Mesh(geo, pair[1]);
  const far = new THREE.Mesh(geo, pair[0]);
  near.renderOrder = 5;
  far.renderOrder = 1;
  near.add(far);
  return { near, far };
}

let polyPair: [THREE.MeshPhysicalMaterial, THREE.MeshPhysicalMaterial] | null = null;
/** Shared translucent polypropylene [far, near] (centrifuge tubes): milky, soft reflections. */
export function polyGlass(): [THREE.MeshPhysicalMaterial, THREE.MeshPhysicalMaterial] {
  if (!polyPair) {
    const o: Partial<GlassOptions> = {
      tint: 0xf3f5f7,
      baseAlpha: 0.1,
      fresnelAlpha: 0.3,
      edgeTint: 0xc7d2dc,
      roughness: 0.38,
      envMapIntensity: 0.45,
    };
    polyPair = [makeGlassMaterial(true, o), makeGlassMaterial(false, o)];
  }
  return polyPair;
}

const solidMats = new Map<string, THREE.MeshStandardMaterial>();
/** Shared opaque glaze / plastic for porcelain dishes, Büchner funnels, weigh boats. */
export function solidShellMaterial(kind: 'porcelain' | 'plastic'): THREE.MeshStandardMaterial {
  let m = solidMats.get(kind);
  if (!m) {
    m =
      kind === 'porcelain'
        ? new THREE.MeshStandardMaterial({ color: 0xf1efe8, roughness: 0.22, metalness: 0, envMapIntensity: 0.7, side: THREE.DoubleSide })
        : new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.55, metalness: 0, envMapIntensity: 0.5, side: THREE.DoubleSide });
    solidMats.set(kind, m);
  }
  return m;
}

/**
 * Same shape as `createGlassMesh` for opaque shells: the returned "far" half is an invisible child so that code that
 * toggles / re-orders `near` and `near.children[0]` keeps working.
 */
export function createSolidMesh(geo: THREE.BufferGeometry, kind: 'porcelain' | 'plastic'): { near: THREE.Mesh; far: THREE.Mesh } {
  const near = new THREE.Mesh(geo, solidShellMaterial(kind));
  near.castShadow = true;
  near.receiveShadow = true;
  const far = new THREE.Mesh(geo, solidShellMaterial(kind));
  far.visible = false;
  far.raycast = () => {};
  near.add(far);
  return { near, far };
}
