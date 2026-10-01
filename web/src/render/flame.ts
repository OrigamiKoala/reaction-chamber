import * as THREE from 'three';

/**
 * Procedural flame: a cylindrical billboard (rotates about world Y to face the camera) with an fbm-distorted
 * teardrop, blue premixed inner cone, and a luminous (sooty) yellow/orange outer envelope. Additive.
 */
const flameGeo = (() => {
  const g = new THREE.PlaneGeometry(1, 1, 1, 1);
  g.translate(0, 0.5, 0);
  return g;
})();

export interface FlameParams {
  /** 0 = clean blue (ethanol/premixed), 1 = sooty yellow */
  luminosity: number;
  /** Optional flame-test emitter colour (linear rgb) and its weight. */
  emitter: THREE.Color;
  emitterAmount: number;
  intensity: number;
  width: number;
  height: number;
}

export function makeFlameMaterial(seed = 0): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSeed: { value: seed },
      uLum: { value: 0 },
      uEmit: { value: new THREE.Color(1, 0.8, 0.2) },
      uEmitAmt: { value: 0 },
      uIntensity: { value: 0 },
      uSize: { value: new THREE.Vector2(2, 5) },
      uInnerCone: { value: 1 },
    },
    vertexShader: /* glsl */ `
      uniform vec2 uSize;
      varying vec2 vUv;
      void main() {
        vec3 center = ( modelMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
        vec3 toCam = cameraPosition - center;
        vec3 right = normalize( vec3( toCam.z, 0.0, -toCam.x ) + vec3( 1e-5, 0.0, 0.0 ) );
        vec3 wp = center + right * position.x * uSize.x + vec3( 0.0, 1.0, 0.0 ) * position.y * uSize.y;
        vUv = vec2( position.x + 0.5, position.y );
        gl_Position = projectionMatrix * viewMatrix * vec4( wp, 1.0 );
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uSeed;
      uniform float uLum;
      uniform vec3 uEmit;
      uniform float uEmitAmt;
      uniform float uIntensity;
      uniform float uInnerCone;
      varying vec2 vUv;
      float hash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
      float noise( vec2 p ) {
        vec2 i = floor( p ); vec2 f = fract( p );
        f = f * f * ( 3.0 - 2.0 * f );
        return mix( mix( hash( i ), hash( i + vec2( 1.0, 0.0 ) ), f.x ), mix( hash( i + vec2( 0.0, 1.0 ) ), hash( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
      }
      float fbm( vec2 p ) {
        float v = 0.0; float a = 0.5;
        for ( int i = 0; i < 4; i++ ) { v += a * noise( p ); p *= 2.03; a *= 0.5; }
        return v;
      }
      void main() {
        float t = uTime + uSeed * 13.7;
        vec2 uv = vUv;
        float n = fbm( vec2( uv.x * 3.0 + uSeed, uv.y * 2.2 - t * 2.6 ) );
        float n2 = fbm( vec2( uv.x * 6.0 - uSeed, uv.y * 4.0 - t * 4.1 ) );
        float y = uv.y;
        float x = ( uv.x - 0.5 ) * 2.0;
        x += ( n - 0.5 ) * 0.55 * y + sin( t * 7.0 + y * 6.0 ) * 0.04 * y;
        float w = pow( max( y, 0.0 ), 0.42 ) * pow( max( 1.0 - y, 0.0 ), 0.75 ) * 1.75 + 1e-3;
        float d = abs( x ) / w;
        float tip = y + ( n2 - 0.5 ) * 0.35;
        float body = smoothstep( 1.0, 0.45, d ) * smoothstep( 0.98, 0.55, tip ) * smoothstep( 0.0, 0.05, y );
        // inner premixed cone
        float ih = 0.42;
        float iw = 0.5 * w * max( 0.0, 1.0 - y / ih );
        float inner = smoothstep( 1.0, 0.3, abs( x ) / max( iw, 1e-3 ) ) * step( y, ih ) * uInnerCone;
        vec3 blue = vec3( 0.18, 0.38, 1.0 );
        vec3 hot = mix( vec3( 1.0, 0.42, 0.08 ), vec3( 1.0, 0.86, 0.5 ), smoothstep( 0.2, 1.0, 1.0 - d ) );
        vec3 outer = mix( blue * 0.55, hot, uLum );
        outer = mix( outer, uEmit * 1.2, uEmitAmt );
        float a = body * mix( 0.35, 1.0, uLum ) + body * uEmitAmt * 0.5;
        vec3 col = outer * a + blue * inner * 1.3 * ( 1.0 - uLum * 0.6 );
        gl_FragColor = vec4( col * uIntensity, 1.0 );
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

/** A cluster of flame billboards (one for a burner, several spread over a burning liquid surface). */
export class FlameCluster {
  public group = new THREE.Group();
  private meshes: THREE.Mesh[] = [];
  private mats: THREE.ShaderMaterial[] = [];
  private offsets: THREE.Vector2[] = [];
  public intensity = 0;
  private target = 0;

  constructor(count: number) {
    for (let i = 0; i < count; i++) {
      const m = makeFlameMaterial(i * 1.37 + Math.random());
      const mesh = new THREE.Mesh(flameGeo, m);
      mesh.frustumCulled = false;
      mesh.renderOrder = 900;
      mesh.raycast = () => {};
      this.meshes.push(mesh);
      this.mats.push(m);
      this.offsets.push(new THREE.Vector2());
      this.group.add(mesh);
    }
    this.group.visible = false;
  }

  /** Spread billboards over a disc of `radius`; flame size w×h (cm). */
  public configure(radius: number, width: number, height: number, p: Partial<FlameParams>) {
    const n = this.meshes.length;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.4;
      const r = n === 1 ? 0 : radius * (i === 0 ? 0 : 0.55);
      this.offsets[i].set(Math.cos(a) * r, Math.sin(a) * r);
      this.meshes[i].position.set(this.offsets[i].x, 0, this.offsets[i].y);
      const m = this.mats[i];
      const s = i === 0 ? 1 : 0.75;
      m.uniforms.uSize.value.set(width * s, height * s * (0.85 + 0.3 * Math.sin(i * 2.1)));
      if (p.luminosity !== undefined) m.uniforms.uLum.value = p.luminosity;
      if (p.emitter) m.uniforms.uEmit.value.copy(p.emitter);
      if (p.emitterAmount !== undefined) m.uniforms.uEmitAmt.value = p.emitterAmount;
    }
  }

  public setInnerCone(on: boolean) {
    for (const m of this.mats) m.uniforms.uInnerCone.value = on ? 1 : 0;
  }

  public setTarget(intensity: number) {
    this.target = Math.max(0, intensity);
  }

  public tick(dt: number, time: number) {
    this.intensity += (this.target - this.intensity) * Math.min(1, dt * 6);
    if (this.target === 0 && this.intensity < 0.01) this.intensity = 0;
    this.group.visible = this.intensity > 0.005;
    if (!this.group.visible) return;
    const flick = 0.85 + 0.15 * Math.sin(time * 23.0) * Math.sin(time * 7.3);
    for (const m of this.mats) {
      m.uniforms.uTime.value = time;
      m.uniforms.uIntensity.value = this.intensity * flick;
    }
  }

  /** Current flicker-modulated brightness (for driving a light). */
  public brightness(time: number): number {
    return this.intensity * (0.8 + 0.2 * Math.sin(time * 31.0) * Math.sin(time * 11.7));
  }

  public dispose() {
    for (const m of this.mats) m.dispose();
  }
}
