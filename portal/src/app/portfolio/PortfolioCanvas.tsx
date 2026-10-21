'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { projects } from './data/projects.js'

gsap.registerPlugin(ScrollTrigger)

interface ProSceneManager {
  init: () => Promise<any>
  update: (delta: number) => void
  render: () => void
  resize: () => void
  setActiveDemo: (demo: string) => void
  loadSplineScene: (name: string, url: string, options?: any) => Promise<any>
  mountSplineScene: (name: string, options?: any) => void
  demoScenes: any
  postProcessing: any
  mouse: any
  camera: any
  scene: any
}

export default function PortfolioCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [proSceneManager, setProSceneManager] = useState<ProSceneManager | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    let scene: THREE.Scene
    let camera: THREE.PerspectiveCamera
    let renderer: THREE.WebGLRenderer
    let composer: EffectComposer
    let bloomPass: UnrealBloomPass
    let ambientParticles: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>
    let heroMesh: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>
    let heroMaterial: THREE.ShaderMaterial
    let clock = new THREE.Clock()
    let scrollProgress = 0
    let mouseX = 0, mouseY = 0
    let animationId: number
    let proManager: ProSceneManager | null = null

    async function initWebGL() {
      const canvas = canvasRef.current
      if (!canvas) return

      scene = new THREE.Scene()
      scene.fog = new THREE.FogExp2(0x000000, 0.015)

      camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000)
      camera.position.set(0, 0, 5)

      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
      renderer.setSize(window.innerWidth, window.innerHeight)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.0

      // Try to load ProSceneManager dynamically
      try {
        const { ProSceneManager } = await import('./systems/ProSceneManager.js')
        proManager = new ProSceneManager(renderer, scene, camera, {
          enableInstancing: true,
          enablePostProcessing: true,
          enablePhysics: true,
          enableSpline: true
        })
        await proManager.init()
        setProSceneManager(proManager)
      } catch (e) {
        console.warn('ProSceneManager not available, using fallback')
      }

      createAmbientParticles()
      createHeroEffect()
      createLights()
      createPostProcessing()

      window.addEventListener('resize', onResize)
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('scroll', onScroll, { passive: true })

      setIsLoaded(true)
    }

    function createAmbientParticles() {
      const count = 3000
      const positions = new Float32Array(count * 3)
      const colors = new Float32Array(count * 3)
      const sizes = new Float32Array(count)
      const randoms = new Float32Array(count)

      const white = new THREE.Color(0xffffff)
      const cool = new THREE.Color(0x8899aa)
      const warm = new THREE.Color(0x667788)

      for (let i = 0; i < count; i++) {
        const i3 = i * 3
        const r = Math.random() * 40 + 5
        const theta = Math.random() * Math.PI * 2
        const phi = Math.acos(2 * Math.random() - 1)
        positions[i3] = r * Math.sin(phi) * Math.cos(theta)
        positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta)
        positions[i3 + 2] = r * Math.cos(phi)

        const m = Math.random()
        const c = m < 0.6 ? white : m < 0.8 ? cool : warm
        colors[i3] = c.r; colors[i3 + 1] = c.g; colors[i3 + 2] = c.b
        sizes[i] = Math.random() * 1.5 + 0.2
        randoms[i] = Math.random()
      }

      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
      geo.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1))

      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
          uScroll: { value: 0 }
        },
        vertexShader: `
          attribute float aSize;
          attribute float aRandom;
          varying vec3 vColor;
          varying float vRandom;
          uniform float uTime;
          uniform float uPixelRatio;
          uniform float uScroll;
          void main(){
            vColor=color;
            vRandom=aRandom;
            vec3 pos=position;
            float angle=uTime*0.05*aRandom+uScroll*2.0;
            float c=cos(angle);float s=sin(angle);
            pos.xz=mat2(c,-s,s,c)*pos.xz;
            pos.y+=sin(uTime*0.3+aRandom*6.28)*0.3+uScroll*3.0;
            vec4 mv=modelViewMatrix*vec4(pos,1.0);
            gl_PointSize=aSize*uPixelRatio*(60.0/-mv.z);
            gl_Position=projectionMatrix*mv;
          }`,
        fragmentShader: `
          varying vec3 vColor;
          varying float vRandom;
          void main(){
            float d=length(gl_PointCoord-vec2(0.5));
            if(d>0.5)discard;
            float a=1.0-smoothstep(0.0,0.5,d);
            a*=0.25;
            gl_FragColor=vec4(vColor*1.2,a);
          }`,
        transparent: true, vertexColors: true, depthWrite: false, blending: THREE.AdditiveBlending
      })

      ambientParticles = new THREE.Points(geo, mat)
      scene.add(ambientParticles)
    }

    function createPostProcessing() {
      composer = new EffectComposer(renderer)
      composer.addPass(new RenderPass(scene, camera))

      bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.3, 0.7
      )
      bloomPass.threshold = 0.1
      bloomPass.strength = 1.4
      bloomPass.radius = 0.4
      composer.addPass(bloomPass)

      const vignetteShader = {
        uniforms: { tDiffuse: { value: null }, darkness: { value: 1.3 }, offset: { value: 1.15 } },
        vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
        fragmentShader: 'uniform sampler2D tDiffuse;uniform float darkness;uniform float offset;varying vec2 vUv;void main(){vec4 texel=texture2D(tDiffuse,vUv);vec2 uv=(vUv-vec2(0.5))*vec2(offset);float vig=1.0-dot(uv,uv);vig=clamp(pow(vig,darkness),0.0,1.0);gl_FragColor=vec4(texel.rgb*vig,texel.a);}'
      }
      composer.addPass(new ShaderPass(vignetteShader))
    }

    function createHeroEffect() {
      const count = 150000
      const positions = new Float32Array(count * 3)
      const alphas = new Float32Array(count)
      const speeds = new Float32Array(count)
      const offsets = new Float32Array(count)
      const lengths = new Float32Array(count)

      for (let i = 0; i < count; i++) {
        const i3 = i * 3
        const r = Math.pow(Math.random(), 0.5) * 8 + 1
        const theta = Math.random() * Math.PI * 2
        const phi = Math.acos(2 * Math.random() - 1)
        positions[i3] = r * Math.sin(phi) * Math.cos(theta)
        positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta)
        positions[i3 + 2] = r * Math.cos(phi)
        alphas[i] = Math.random() * 0.5 + 0.2
        speeds[i] = Math.random() * 0.5 + 0.2
        offsets[i] = Math.random() * Math.PI * 2
        lengths[i] = Math.random() * 0.8 + 0.4
      }

      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1))
      geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1))
      geo.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 1))
      geo.setAttribute('aLength', new THREE.BufferAttribute(lengths, 1))

      heroMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uScroll: { value: 0 },
          uMouse: { value: new THREE.Vector2(0, 0) },
          uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
          uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
          uColorA: { value: new THREE.Color(0x00f0ff) },
          uColorB: { value: new THREE.Color(0x7b2dff) },
          uColorC: { value: new THREE.Color(0xff006e) }
        },
        vertexShader: `
          attribute float aAlpha;
          attribute float aSpeed;
          attribute float aOffset;
          attribute float aLength;
          varying float vAlpha;
          varying float vSpeed;
          varying float vOffset;
          varying float vLength;
          varying vec3 vPosition;
          uniform float uTime;
          uniform float uScroll;
          uniform vec2 uMouse;
          void main() {
            vAlpha = aAlpha;
            vSpeed = aSpeed;
            vOffset = aOffset;
            vLength = aLength;
            vPosition = position;
            
            vec3 pos = position;
            float t = uTime * 0.3 + aOffset;
            float scrollEffect = uScroll * 10.0;
            
            vec3 p = pos * 0.5 + vec3(t * 0.1, t * 0.07, t * 0.13);
            float n1 = sin(p.x * 2.0 + sin(p.y * 3.0 + t) + cos(p.z * 2.5));
            float n2 = sin(p.y * 2.0 + sin(p.z * 3.0 + t) + cos(p.x * 2.5));
            float n3 = sin(p.z * 2.0 + sin(p.x * 3.0 + t) + cos(p.y * 2.5));
            vec3 curl = vec3(n2 - n3, n3 - n1, n1 - n2) * 0.5;
            
            vec3 mouseDir = normalize(vec3(uMouse.x, uMouse.y, 0.0) - pos.xyz * 0.1);
            float mouseDist = length(vec3(uMouse.x, uMouse.y, 0.0) - pos.xyz * 0.1);
            float mouseInfluence = smoothstep(3.0, 0.0, mouseDist) * 2.0;
            curl += mouseDir * mouseInfluence * aSpeed;
            
            pos += curl * aSpeed * 0.8;
            pos.z -= scrollEffect * aLength;
            pos.y += sin(t * 2.0 + pos.x * 0.5) * 0.3 * aLength;
            pos.x += cos(t * 1.5 + pos.y * 0.5) * 0.2 * aLength;
            
            vec4 mv = modelViewMatrix * vec4(pos, 1.0);
            gl_PointSize = (3.0 + aLength * 4.0) * uPixelRatio * (80.0 / -mv.z);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: `
          varying float vAlpha;
          varying float vSpeed;
          varying float vOffset;
          varying float vLength;
          varying vec3 vPosition;
          uniform vec3 uColorA;
          uniform vec3 uColorB;
          uniform vec3 uColorC;
          uniform float uTime;
          uniform float uScroll;
          void main() {
            float d = length(gl_PointCoord - vec2(0.5));
            if (d > 0.5) discard;
            
            float core = 1.0 - smoothstep(0.0, 0.5, d);
            float ring = smoothstep(0.3, 0.45, d) * 0.3;
            float a = (core + ring) * vAlpha * 0.6;
            
            float hue = (vPosition.x * 0.1 + vPosition.y * 0.1 + vPosition.z * 0.05 + uTime * 0.02 + vOffset) * 0.15;
            vec3 colA = uColorA;
            vec3 colB = uColorB;
            vec3 colC = uColorC;
            
            float h = fract(hue);
            vec3 color = mix(colA, colB, smoothstep(0.0, 0.5, h));
            color = mix(color, colC, smoothstep(0.5, 1.0, h));
            
            color *= (1.0 + core * 2.0);
            
            gl_FragColor = vec4(color, a);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: false
      })

      heroMesh = new THREE.Points(geo, heroMaterial)
      scene.add(heroMesh)
    }

    function createLights() {
      scene.add(new THREE.AmbientLight(0x111111))
      const p1 = new THREE.PointLight(0xffffff, 2, 60)
      p1.position.set(5, 5, 5)
      scene.add(p1)
      const p2 = new THREE.PointLight(0x8899aa, 1.5, 60)
      p2.position.set(-5, -3, 5)
      scene.add(p2)
    }

    function onMouseMove(e: MouseEvent) {
      mouseX = (e.clientX / window.innerWidth) * 2 - 1
      mouseY = -(e.clientY / window.innerHeight) * 2 + 1
    }

    function onScroll() {
      const max = document.documentElement.scrollHeight - window.innerHeight
      scrollProgress = max > 0 ? window.scrollY / max : 0
      const bar = document.getElementById('progressBar')
      if (bar) bar.style.width = (scrollProgress * 100) + '%'
    }

    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      if (proManager) {
        proManager.resize()
      }
      if (composer) {
        composer.setSize(window.innerWidth, window.innerHeight)
      }
      if (heroMaterial) {
        heroMaterial.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight)
        heroMaterial.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2)
      }
    }

    function animate() {
      animationId = requestAnimationFrame(animate)
      const delta = clock.getDelta()
      const elapsed = clock.getElapsedTime()

      camera.position.x += (mouseX * 1.5 - camera.position.x) * 0.02
      camera.position.y += (mouseY * 1 - camera.position.y) * 0.02
      camera.position.z = 5 - scrollProgress * 15
      camera.lookAt(0, 0, -5)

      if (ambientParticles) {
        ambientParticles.material.uniforms.uTime.value = elapsed
        ambientParticles.material.uniforms.uScroll.value = scrollProgress
        ambientParticles.rotation.y = elapsed * 0.008
      }

      if (heroMesh && heroMaterial) {
        heroMaterial.uniforms.uTime.value = elapsed
        heroMaterial.uniforms.uScroll.value = scrollProgress
        heroMaterial.uniforms.uMouse.value.set(mouseX, mouseY)
        heroMesh.rotation.y = elapsed * 0.005 + scrollProgress * 0.5
        heroMesh.rotation.x = scrollProgress * 0.3
      }

      if (proManager) {
        proManager.update(delta)
        proManager.render()
      } else if (composer) {
        composer.render()
      }
    }

    initWebGL()

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('scroll', onScroll)
      if (renderer) renderer.dispose()
    }
  }, [])

  if (!isLoaded) return null

  return <canvas ref={canvasRef} id="webgl-canvas" className="webgl-canvas" />
}