import * as THREE from 'three'
import { GPUInstancingSystem, grassComputeShader, particleComputeShader } from './GPUInstancing.js'
import { AdvancedPostProcessing, lensFlareShader, colorGradingShader } from './AdvancedPostProcessing.js'
import { PhysicsWorld, createPhysicsDemo } from './PhysicsSystem.js'
import { SplineSceneManager, HybridSceneComposer, createSplineMaterialOverrides } from './SplineIntegration.js'

export class ProSceneManager {
  constructor(renderer, scene, camera, options = {}) {
    this.renderer = renderer
    this.scene = scene
    this.camera = camera
    this.options = {
      enableInstancing: true,
      enablePostProcessing: true,
      enablePhysics: true,
      enableSpline: true,
      ...options
    }

    this.instancing = null
    this.postProcessing = null
    this.physics = null
    this.splineManager = null
    this.composer = null
    this.clock = new THREE.Clock()
    this.time = 0
    this.frame = 0

    this.demoScenes = {}
    this.activeDemo = null
    this.envMap = null
  }

  async init() {
    await this._createEnvironmentMap()

    if (this.options.enableInstancing) {
      this.instancing = new GPUInstancingSystem(this.renderer)
      await this._setupInstancingDemos()
    }

    if (this.options.enablePostProcessing) {
      this.postProcessing = new AdvancedPostProcessing(this.renderer, this.scene, this.camera, {
        enableSSAO: true,
        enableSSR: true,
        enableDOF: true,
        enableMotionBlur: true,
        enableBloom: true,
        enableFilmGrain: true,
        enableSMAA: true,
        enableChromaticAberration: true,
        enableVignette: true
      })
    }

    if (this.options.enablePhysics) {
      this.physics = new PhysicsWorld({ gravity: { x: 0, y: -9.81, z: 0 } })
      await this.physics.init()
      this.demoScenes.physics = await createPhysicsDemo(this.scene)
    }

    if (this.options.enableSpline) {
      this.splineManager = new SplineSceneManager({
        scene: this.scene,
        camera: this.camera,
        renderer: this.renderer
      })
      this.composer = new HybridSceneComposer(this.scene, this.splineManager)
    }

    this._setupEventListeners()
    return this
  }

  async _createEnvironmentMap() {
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer)
    pmremGenerator.compileEquirectangularShader()

    const textureLoader = new THREE.TextureLoader()
    const envTexture = await new Promise((resolve, reject) => {
      textureLoader.load(
        'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/industrial_sunset_02_2k.hdr',
        (tex) => {
          tex.mapping = THREE.EquirectangularReflectionMapping
          tex.colorSpace = THREE.SRGBColorSpace
          resolve(pmremGenerator.fromEquirectangular(tex).texture)
        },
        undefined,
        reject
      )
    })

    this.envMap = envTexture
    this.scene.environment = envTexture
    pmremGenerator.dispose()
  }

  async _setupInstancingDemos() {
    this.demoScenes.grass = this._createGrassDemo()
    this.demoScenes.particles = this._createParticleDemo()
    this.demoScenes.instancedObjects = this._createInstancedObjectsDemo()
  }

  _createGrassDemo() {
    const grassMesh = this.instancing.createGrassField('grass', 50000, { width: 100, depth: 100 }, {
      heightMap: (x, z) => Math.sin(x * 0.1) * Math.cos(z * 0.1) * 0.5
    })
    grassMesh.position.y = -0.5
    this.scene.add(grassMesh)
    return { mesh: grassMesh, name: 'grass', windEnabled: true }
  }

  _createParticleDemo() {
    const particleMesh = this.instancing.createParticleField('particles', 200000, { width: 50, height: 50, depth: 50 })
    particleMesh.position.y = 10
    this.scene.add(particleMesh)
    return { mesh: particleMesh, name: 'particles' }
  }

  _createInstancedObjectsDemo() {
    const geometry = new THREE.IcosahedronGeometry(0.5, 1)
    const material = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      metalness: 0.8,
      roughness: 0.2,
      envMapIntensity: 1.5,
      emissive: new THREE.Color(0x00f0ff),
      emissiveIntensity: 0.2
    })

    const mesh = this.instancing.createInstancedMesh('crystals', geometry, material, 5000, {
      hasColor: true,
      frustumCulled: false,
      customAttributes: {
        rotationSpeed: { size: 3, defaultValue: 0 },
        floatOffset: { size: 1, defaultValue: 0 },
        floatSpeed: { size: 1, defaultValue: 0 }
      }
    })

    for (let i = 0; i < 5000; i++) {
      const radius = 20 + Math.random() * 30
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      this.instancing.setInstanceAt(i, 'crystals', {
        position: new THREE.Vector3(
          radius * Math.sin(phi) * Math.cos(theta),
          radius * Math.sin(phi) * Math.sin(theta) * 0.5,
          radius * Math.cos(phi)
        ),
        rotation: new THREE.Quaternion().setFromEuler(
          new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI)
        ),
        scale: new THREE.Vector3(0.5 + Math.random() * 1.5, 0.5 + Math.random() * 1.5, 0.5 + Math.random() * 1.5),
        color: new THREE.Color().setHSL(0.55 + Math.random() * 0.1, 1, 0.5),
        custom: {
          rotationSpeed: [
            (Math.random() - 0.5) * 0.5,
            (Math.random() - 0.5) * 0.5,
            (Math.random() - 0.5) * 0.5
          ],
          floatOffset: [Math.random() * Math.PI * 2],
          floatSpeed: [0.5 + Math.random() * 1.5]
        }
      })
    }

    mesh.position.y = 5
    this.scene.add(mesh)
    return { mesh, name: 'crystals' }
  }

  async loadSplineScene(name, url, options = {}) {
    if (!this.splineManager) return null
    return await this.splineManager.loadSplineScene(name, url, options)
  }

  mountSplineScene(name, transform) {
    if (!this.splineManager) return null
    const splineScene = this.splineManager.mountToThreeScene(name, this.scene)
    if (splineScene && transform) {
      if (transform.position) splineScene.position.copy(transform.position)
      if (transform.rotation) splineScene.rotation.copy(transform.rotation)
      if (transform.scale) splineScene.scale.copy(transform.scale)
    }
    return splineScene
  }

  _setupEventListeners() {
    window.addEventListener('resize', () => this.resize())
    window.addEventListener('mousemove', (e) => this._onMouseMove(e))
    window.addEventListener('click', (e) => this._onClick(e))
  }

  _onMouseMove(e) {
    this.mouse = {
      x: (e.clientX / window.innerWidth) * 2 - 1,
      y: -(e.clientY / window.innerHeight) * 2 + 1
    }
  }

  _onClick(e) {
    if (this.physics && this.demoScenes.physics) {
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(this.mouse, this.camera)
      const intersects = raycaster.intersectObjects(this.scene.children, true)

      if (intersects.length > 0) {
        const point = intersects[0].point
        this.demoScenes.physics.addExplosion(point, 100, 15)
      }
    }
  }

  setActiveDemo(name) {
    Object.values(this.demoScenes).forEach(demo => {
      if (demo.mesh) demo.mesh.visible = false
    })

    const demo = this.demoScenes[name]
    if (demo && demo.mesh) {
      demo.mesh.visible = true
      this.activeDemo = name
    }
  }

  update(delta) {
    this.time += delta
    this.frame++

    if (this.instancing) {
      this.instancing.update(delta, this.time)
      this._updateInstancedDemos(delta)
    }

    if (this.physics && this.demoScenes.physics) {
      this.demoScenes.physics.update(delta)
    }

    if (this.splineManager) {
      this.splineManager.update(delta)
    }

    if (this.composer) {
      this.composer.update(delta, this.camera)
    }

    if (this.postProcessing) {
      this.postProcessing.update(delta, this.time)
    }
  }

  _updateInstancedDemos(delta) {
    if (this.demoScenes.grass && this.demoScenes.grass.windEnabled) {
      const grass = this.instancing.instancedMeshes.get('grass')
      if (grass) {
        const dummy = new THREE.Object3D()
        for (let i = 0; i < grass.mesh.count; i++) {
          const windForce = Math.sin(this.time * 2 + grass.data.custom.windOffset[i]) * 0.15
          const bend = windForce * grass.data.custom.stiffness[i]
          dummy.position.fromArray(grass.data.position, i * 3)
          dummy.rotation.y = bend
          dummy.rotation.x = Math.sin(this.time + grass.data.custom.windOffset[i]) * 0.05
          dummy.scale.fromArray(grass.data.scale, i * 3)
          dummy.updateMatrix()
          grass.mesh.setMatrixAt(i, dummy.matrix)
        }
        grass.mesh.instanceMatrix.needsUpdate = true
      }
    }

    if (this.demoScenes.crystals) {
      const crystals = this.instancing.instancedMeshes.get('crystals')
      if (crystals) {
        const dummy = new THREE.Object3D()
        for (let i = 0; i < crystals.mesh.count; i++) {
          dummy.position.fromArray(crystals.data.position, i * 3)
          dummy.position.y += Math.sin(this.time * crystals.data.custom.floatSpeed[i] + crystals.data.custom.floatOffset[i]) * 0.2

          const rot = crystals.data.custom.rotationSpeed
          dummy.rotation.x += rot[0] * delta
          dummy.rotation.y += rot[1] * delta
          dummy.rotation.z += rot[2] * delta

          dummy.scale.fromArray(crystals.data.scale, i * 3)
          dummy.updateMatrix()
          crystals.mesh.setMatrixAt(i, dummy.matrix)
        }
        crystals.mesh.instanceMatrix.needsUpdate = true
      }
    }
  }

  render() {
    if (this.postProcessing) {
      this.postProcessing.render(this.clock.getDelta())
    } else {
      this.renderer.render(this.scene, this.camera)
    }
  }

  resize() {
    const width = window.innerWidth
    const height = window.innerHeight

    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    if (this.postProcessing) {
      this.postProcessing.resize(width, height)
    }

    if (this.instancing) {
      this.instancing.instancedMeshes.forEach(({ mesh }) => {
        if (mesh.material.uniforms?.uResolution) {
          mesh.material.uniforms.uResolution.value.set(width, height)
        }
        if (mesh.material.uniforms?.uPixelRatio) {
          mesh.material.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2)
        }
      })
    }
  }

  setBloomStrength(strength) {
    if (this.postProcessing) this.postProcessing.setBloomStrength(strength)
  }

  setFocusDistance(distance) {
    if (this.postProcessing) this.postProcessing.setFocusDistance(distance)
  }

  setAperture(aperture) {
    if (this.postProcessing) this.postProcessing.setAperture(aperture)
  }

  setMotionBlurStrength(strength) {
    if (this.postProcessing) this.postProcessing.setMotionBlurStrength(strength)
  }

  dispose() {
    if (this.instancing) this.instancing.dispose()
    if (this.postProcessing) this.postProcessing.dispose()
    if (this.physics) this.physics.dispose()
    if (this.splineManager) this.splineManager.disposeAll()
  }
}

export async function createProScene(renderer, scene, camera) {
  const manager = new ProSceneManager(renderer, scene, camera, {
    enableInstancing: true,
    enablePostProcessing: true,
    enablePhysics: true,
    enableSpline: true
  })
  await manager.init()
  return manager
}