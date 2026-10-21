import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js'
import { SSRPass } from 'three/examples/jsm/postprocessing/SSRPass.js'
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js'
import { FilmPass } from 'three/examples/jsm/postprocessing/FilmPass.js'
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js'
import { AfterimagePass } from 'three/examples/jsm/postprocessing/AfterimagePass.js'
import { SavePass } from 'three/examples/jsm/postprocessing/SavePass.js'
import { ClearPass } from 'three/examples/jsm/postprocessing/ClearPass.js'
import { MaskPass, ClearMaskPass } from 'three/examples/jsm/postprocessing/MaskPass.js'

export class AdvancedPostProcessing {
  constructor(renderer, scene, camera, options = {}) {
    this.renderer = renderer
    this.scene = scene
    this.camera = camera
    this.options = {
      enableSSAO: true,
      enableSSR: true,
      enableDOF: true,
      enableMotionBlur: true,
      enableBloom: true,
      enableFilmGrain: true,
      enableSMAA: true,
      enableChromaticAberration: true,
      enableVignette: true,
      ...options
    }

    this.composer = null
    this.passes = {}
    this.renderTargets = {}
    this.prevCameraMatrix = new THREE.Matrix4()
    this.velocityTexture = null
    this.depthTexture = null
    this.normalTexture = null

    this._init()
  }

  _init() {
    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))

    this._createGBufferPass()
    this._createSSAOPass()
    this._createSSRPass()
    this._createDOFPass()
    this._createMotionBlurPass()
    this._createBloomPass()
    this._createChromaticAberrationPass()
    this._createVignettePass()
    this._createFilmGrainPass()
    this._createSMAAPass()

    this._setupRenderTargets()
  }

  _createGBufferPass() {
    const gBufferShader = {
      uniforms: {
        tDiffuse: { value: null },
        cameraNear: { value: this.camera.near },
        cameraFar: { value: this.camera.far }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        void main() {
          vUv = uv;
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        uniform float cameraNear;
        uniform float cameraFar;
        layout(location = 0) out vec4 outColor;
        layout(location = 1) out vec4 outNormal;
        layout(location = 2) out vec4 outPosition;
        layout(location = 3) out vec4 outDepth;
        void main() {
          outColor = vec4(1.0);
          outNormal = vec4(normalize(vNormal) * 0.5 + 0.5, 1.0);
          outPosition = vec4(vWorldPosition, 1.0);
          float depth = length(vWorldPosition - cameraPosition) / (cameraFar - cameraNear);
          outDepth = vec4(vec3(depth), 1.0);
        }
      `
    }

    this.passes.gBuffer = new ShaderPass(gBufferShader)
    this.passes.gBuffer.renderToScreen = false
    this.composer.addPass(this.passes.gBuffer)
  }

  _createSSAOPass() {
    if (!this.options.enableSSAO) return

    this.passes.ssao = new SSAOPass(this.scene, this.camera, window.innerWidth, window.innerHeight)
    this.passes.ssao.kernelRadius = 16
    this.passes.ssao.minDistance = 0.005
    this.passes.ssao.maxDistance = 0.1
    this.passes.ssao.output = SSAOPass.OUTPUT.Default
    this.composer.addPass(this.passes.ssao)
  }

  _createSSRPass() {
    if (!this.options.enableSSR) return

    this.passes.ssr = new SSRPass({
      renderer: this.renderer,
      scene: this.scene,
      camera: this.camera,
      width: window.innerWidth,
      height: window.innerHeight,
      selects: this.scene.children.filter(c => c.isMesh)
    })
    this.passes.ssr.maxDistance = 100
    this.passes.ssr.thickness = 1.0
    this.passes.ssr.opacity = 0.8
    this.composer.addPass(this.passes.ssr)
  }

  _createDOFPass() {
    if (!this.options.enableDOF) return

    this.passes.dof = new BokehPass(this.scene, this.camera, {
      focus: 10,
      aperture: 0.025,
      maxblur: 0.01,
      width: window.innerWidth,
      height: window.innerHeight
    })
    this.passes.dof.renderToScreen = false
    this.composer.addPass(this.passes.dof)
  }

  _createMotionBlurPass() {
    if (!this.options.enableMotionBlur) return

    const motionBlurShader = {
      uniforms: {
        tDiffuse: { value: null },
        tDepth: { value: null },
        tVelocity: { value: null },
        cameraNear: { value: this.camera.near },
        cameraFar: { value: this.camera.far },
        uTime: { value: 0 },
        uStrength: { value: 0.5 },
        uSamples: { value: 16 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D tDiffuse;
        uniform sampler2D tDepth;
        uniform sampler2D tVelocity;
        uniform float cameraNear;
        uniform float cameraFar;
        uniform float uStrength;
        uniform int uSamples;
        void main() {
          vec4 color = texture2D(tDiffuse, vUv);
          vec2 velocity = texture2D(tVelocity, vUv).rg * uStrength;
          vec3 acc = color.rgb;
          float totalWeight = 1.0;

          for (int i = 1; i < 32; i++) {
            if (i >= uSamples) break;
            float t = float(i) / float(uSamples);
            vec2 offset = velocity * t;
            vec4 sample = texture2D(tDiffuse, vUv + offset);
            float w = 1.0 - t;
            acc += sample.rgb * w;
            totalWeight += w;
          }

          gl_FragColor = vec4(acc / totalWeight, color.a);
        }
      `
    }

    this.passes.motionBlur = new ShaderPass(motionBlurShader)
    this.passes.motionBlur.renderToScreen = false
    this.composer.addPass(this.passes.motionBlur)
  }

  _createBloomPass() {
    if (!this.options.enableBloom) return

    this.passes.bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.5, 0.4, 0.85
    )
    this.passes.bloom.threshold = 0.8
    this.passes.bloom.strength = 1.2
    this.passes.bloom.radius = 0.6
    this.composer.addPass(this.passes.bloom)
  }

  _createChromaticAberrationPass() {
    if (!this.options.enableChromaticAberration) return

    const chromaticShader = {
      uniforms: {
        tDiffuse: { value: null },
        uOffset: { value: new THREE.Vector2(0.001, 0.001) },
        uDistortion: { value: 1.0 }
      },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D tDiffuse;
        uniform vec2 uOffset;
        uniform float uDistortion;
        void main() {
          vec2 uv = vUv;
          vec2 center = vec2(0.5);
          vec2 dir = uv - center;
          float dist = length(dir);
          float distortion = 1.0 + dist * dist * uDistortion * 0.1;
          vec2 rUV = center + dir * distortion + uOffset;
          vec2 bUV = center + dir * distortion - uOffset;
          float r = texture2D(tDiffuse, rUV).r;
          float g = texture2D(tDiffuse, vUv).g;
          float b = texture2D(tDiffuse, bUV).b;
          gl_FragColor = vec4(r, g, b, 1.0);
        }
      `
    }

    this.passes.chromatic = new ShaderPass(chromaticShader)
    this.composer.addPass(this.passes.chromatic)
  }

  _createVignettePass() {
    if (!this.options.enableVignette) return

    const vignetteShader = {
      uniforms: {
        tDiffuse: { value: null },
        uDarkness: { value: 1.3 },
        uOffset: { value: 1.15 },
        uColor: { value: new THREE.Color(0x000000) }
      },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D tDiffuse;
        uniform float uDarkness;
        uniform float uOffset;
        uniform vec3 uColor;
        void main() {
          vec4 color = texture2D(tDiffuse, vUv);
          vec2 uv = (vUv - vec2(0.5)) * vec2(uOffset);
          float vig = 1.0 - dot(uv, uv);
          vig = clamp(pow(vig, uDarkness), 0.0, 1.0);
          gl_FragColor = vec4(mix(uColor, color.rgb, vig), color.a);
        }
      `
    }

    this.passes.vignette = new ShaderPass(vignetteShader)
    this.composer.addPass(this.passes.vignette)
  }

  _createFilmGrainPass() {
    if (!this.options.enableFilmGrain) return

    this.passes.film = new FilmPass(0.35, 0.025, 648, false)
    this.composer.addPass(this.passes.film)
  }

  _createSMAAPass() {
    if (!this.options.enableSMAA) return

    this.passes.smaa = new SMAAPass(
      window.innerWidth * this.renderer.getPixelRatio(),
      window.innerHeight * this.renderer.getPixelRatio()
    )
    this.composer.addPass(this.passes.smaa)
  }

  _setupRenderTargets() {
    const params = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      depthBuffer: true,
      stencilBuffer: false
    }

    this.renderTargets.velocity = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, params)
    this.renderTargets.depth = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
      ...params,
      format: THREE.DepthFormat,
      type: THREE.FloatType
    })
    this.renderTargets.normal = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, params)
  }

  setFocusDistance(distance) {
    if (this.passes.dof) {
      this.passes.dof.uniforms.focus.value = distance
    }
  }

  setAperture(aperture) {
    if (this.passes.dof) {
      this.passes.dof.uniforms.aperture.value = aperture
    }
  }

  setBloomStrength(strength) {
    if (this.passes.bloom) {
      this.passes.bloom.strength = strength
    }
  }

  setBloomThreshold(threshold) {
    if (this.passes.bloom) {
      this.passes.bloom.threshold = threshold
    }
  }

  setMotionBlurStrength(strength) {
    if (this.passes.motionBlur) {
      this.passes.motionBlur.uniforms.uStrength.value = strength
    }
  }

  setChromaticAberration(offset) {
    if (this.passes.chromatic) {
      this.passes.chromatic.uniforms.uOffset.value.set(offset, offset)
    }
  }

  setVignetteDarkness(darkness) {
    if (this.passes.vignette) {
      this.passes.vignette.uniforms.uDarkness.value = darkness
    }
  }

  setFilmGrain(intensity) {
    if (this.passes.film) {
      this.passes.film.uniforms.nIntensity.value = intensity
    }
  }

  update(delta, time) {
    if (this.passes.motionBlur) {
      this.passes.motionBlur.uniforms.uTime.value = time
    }

    if (this.passes.ssr) {
      this.passes.ssr.camera = this.camera
    }

    if (this.passes.dof) {
      this.passes.dof.camera = this.camera
    }
  }

  render(delta) {
    this.composer.render(delta)
  }

  resize(width, height) {
    this.composer.setSize(width, height)

    if (this.passes.ssao) this.passes.ssao.setSize(width, height)
    if (this.passes.ssr) this.passes.ssr.setSize(width, height)
    if (this.passes.dof) this.passes.dof.setSize(width, height)
    if (this.passes.smaa) this.passes.smaa.setSize(width, height)

    Object.values(this.renderTargets).forEach(rt => rt.setSize(width, height))
  }

  dispose() {
    this.composer.passes.forEach(pass => {
      if (pass.dispose) pass.dispose()
    })
    Object.values(this.renderTargets).forEach(rt => rt.dispose())
  }
}

export const lensFlareShader = {
  uniforms: {
    tDiffuse: { value: null },
    tLens: { value: null },
    uTime: { value: 0 },
    uIntensity: { value: 1.0 },
    uColor: { value: new THREE.Color(0xffeecc) },
    uCount: { value: 8 }
  },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uIntensity;
    uniform vec3 uColor;
    uniform int uCount;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      vec2 center = vec2(0.5);
      vec2 dir = vUv - center;
      float dist = length(dir);
      float maxDist = length(center);

      vec3 flare = vec3(0.0);
      for (int i = 1; i <= 16; i++) {
        if (i > uCount) break;
        float t = float(i) / float(uCount);
        vec2 uv = vUv + dir * t * 0.5;
        vec4 sample = texture2D(tDiffuse, uv);
        float luma = dot(sample.rgb, vec3(0.299, 0.587, 0.114));
        if (luma > 0.9) {
          flare += sample.rgb * uColor * (1.0 - t) * uIntensity * 0.1;
        }
      }

      float vignette = 1.0 - smoothstep(0.5, 1.0, dist / maxDist);
      color.rgb += flare * vignette;
      gl_FragColor = color;
    }
  `
}

export const colorGradingShader = {
  uniforms: {
    tDiffuse: { value: null },
    uLut: { value: null },
    uExposure: { value: 1.0 },
    uContrast: { value: 1.0 },
    uSaturation: { value: 1.0 },
    uTemperature: { value: 0.0 },
    uTint: { value: 0.0 },
    uLift: { value: new THREE.Vector3(0, 0, 0) },
    uGamma: { value: new THREE.Vector3(1, 1, 1) },
    uGain: { value: new THREE.Vector3(1, 1, 1) }
  },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    uniform float uExposure;
    uniform float uContrast;
    uniform float uSaturation;
    uniform float uTemperature;
    uniform float uTint;
    uniform vec3 uLift;
    uniform vec3 uGamma;
    uniform vec3 uGain;
    void main() {
      vec3 color = texture2D(tDiffuse, vUv).rgb;
      color *= uExposure;
      color = color + uLift;
      color = pow(color, uGamma);
      color = color * uGain;
      color = mix(vec3(dot(color, vec3(0.2126, 0.7152, 0.0722))), color, uSaturation);
      color.r += uTemperature * 0.1;
      color.b -= uTemperature * 0.1;
      color.g += uTint * 0.05;
      color = mix(color, vec3(pow(color.r, 1.0/uContrast), pow(color.g, 1.0/uContrast), pow(color.b, 1.0/uContrast)), 0.5);
      gl_FragColor = vec4(color, 1.0);
    }
  `
}