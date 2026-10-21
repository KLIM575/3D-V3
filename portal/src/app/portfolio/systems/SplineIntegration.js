import { Application } from '@splinetool/runtime'
import * as THREE from 'three'

export class SplineSceneManager {
  constructor(options = {}) {
    this.canvas = options.canvas
    this.scene = options.scene
    this.camera = options.camera
    this.renderer = options.renderer
    this.splineApps = new Map()
    this.loadedScenes = new Map()
    this.customObjects = new Map()
  }

  async loadSplineScene(name, splineUrl, options = {}) {
    const container = document.createElement('div')
    container.style.width = '100%'
    container.style.height = '100%'
    container.style.position = 'absolute'
    container.style.top = '0'
    container.style.left = '0'
    container.style.pointerEvents = options.pointerEvents !== false ? 'auto' : 'none'

    const app = new Application(container)
    this.splineApps.set(name, { app, container, options })

    try {
      await app.load(splineUrl)
      this.loadedScenes.set(name, app)
      console.log(`[Spline] Loaded: ${name}`)
      return app
    } catch (error) {
      console.error(`[Spline] Failed to load ${name}:`, error)
      throw error
    }
  }

  mountToThreeScene(name, threeScene) {
    const splineData = this.splineApps.get(name)
    if (!splineData) return

    const { app, container } = splineData
    app.canvas.style.position = 'absolute'
    app.canvas.style.top = '0'
    app.canvas.style.left = '0'
    app.canvas.style.width = '100%'
    app.canvas.style.height = '100%'
    app.canvas.style.zIndex = '1'

    threeScene.add(app.scene)
    return app.scene
  }

  getSplineObject(name, objectName) {
    const app = this.loadedScenes.get(name)
    if (!app) return null
    return app.scene.getObjectByName(objectName)
  }

  playAnimation(name, animationName, options = {}) {
    const app = this.loadedScenes.get(name)
    if (!app) return

    const animation = app.scene.animations?.find(a => a.name === animationName)
    if (animation) {
      const mixer = new THREE.AnimationMixer(app.scene)
      const action = mixer.clipAction(animation)
      action.play()
      return { mixer, action }
    }
    return null
  }

  setCustomUniforms(name, uniforms) {
    const app = this.loadedScenes.get(name)
    if (!app) return

    app.scene.traverse(obj => {
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        mats.forEach(mat => {
          if (mat.isShaderMaterial || mat.isRawShaderMaterial) {
            Object.entries(uniforms).forEach(([key, value]) => {
              if (mat.uniforms[key]) mat.uniforms[key].value = value
            })
          }
        })
      }
    })
  }

  onEvent(name, eventType, callback) {
    const app = this.loadedScenes.get(name)
    if (!app) return

    app.canvas.addEventListener(eventType, callback)
    return () => app.canvas.removeEventListener(eventType, callback)
  }

  update(delta) {
    this.splineApps.forEach(({ app, options }) => {
      if (options.autoUpdate !== false) {
        app.update(delta)
      }
    })
  }

  resize(width, height) {
    this.splineApps.forEach(({ app }) => {
      app.resize()
    })
  }

  dispose(name) {
    const splineData = this.splineApps.get(name)
    if (splineData) {
      splineData.app.destroy()
      this.splineApps.delete(name)
      this.loadedScenes.delete(name)
    }
  }

  disposeAll() {
    this.splineApps.forEach((_, name) => this.dispose(name))
  }
}

export class HybridSceneComposer {
  constructor(threeScene, splineManager) {
    this.threeScene = threeScene
    this.splineManager = splineManager
    this.effectLayers = []
    this.postProcessing = null
  }

  addEffectLayer(layer) {
    this.effectLayers.push(layer)
    this.threeScene.add(layer)
  }

  removeEffectLayer(layer) {
    const idx = this.effectLayers.indexOf(layer)
    if (idx > -1) {
      this.effectLayers.splice(idx, 1)
      this.threeScene.remove(layer)
    }
  }

  async composeScene(config) {
    const { splineScenes = [], customObjects = [], effects = [] } = config

    for (const { name, url, position, rotation, scale, options } of splineScenes) {
      await this.splineManager.loadSplineScene(name, url, options)
      const splineScene = this.splineManager.mountToThreeScene(name, this.threeScene)
      if (splineScene) {
        if (position) splineScene.position.copy(position)
        if (rotation) splineScene.rotation.copy(rotation)
        if (scale) splineScene.scale.copy(scale)
      }
    }

    for (const obj of customObjects) {
      this.threeScene.add(obj)
      this.splineManager.customObjects.set(obj.name || obj.uuid, obj)
    }

    for (const effect of effects) {
      this.addEffectLayer(effect)
    }
  }

  update(delta, camera) {
    this.splineManager.update(delta)

    this.effectLayers.forEach(layer => {
      if (layer.update) layer.update(delta, camera)
    })

    this.splineManager.customObjects.forEach(obj => {
      if (obj.update) obj.update(delta, camera)
    })
  }
}

export function createSplineMaterialOverrides() {
  return {
    addGlow: (object, color = 0x00f0ff, intensity = 1) => {
      object.traverse(child => {
        if (child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material]
          mats.forEach(mat => {
            if (!mat.userData.originalEmissive) {
              mat.userData.originalEmissive = mat.emissive?.clone() || new THREE.Color(0x000000)
              mat.userData.originalEmissiveIntensity = mat.emissiveIntensity || 0
            }
            mat.emissive = new THREE.Color(color)
            mat.emissiveIntensity = intensity
            mat.needsUpdate = true
          })
        }
      })
    },

    addPBR: (object, params = {}) => {
      object.traverse(child => {
        if (child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material]
          mats.forEach(mat => {
            if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
              Object.assign(mat, {
                metalness: params.metalness ?? 0.5,
                roughness: params.roughness ?? 0.3,
                clearcoat: params.clearcoat ?? 0,
                clearcoatRoughness: params.clearcoatRoughness ?? 0,
                transmission: params.transmission ?? 0,
                thickness: params.thickness ?? 0,
                ior: params.ior ?? 1.5,
                envMapIntensity: params.envMapIntensity ?? 1,
              })
              mat.needsUpdate = true
            }
          })
        }
      })
    },

    addIridescence: (object, params = {}) => {
      object.traverse(child => {
        if (child.material && (child.material.isMeshStandardMaterial || child.material.isMeshPhysicalMaterial)) {
          child.material.iridescence = params.iridescence ?? 1
          child.material.iridescenceIOR = params.iridescenceIOR ?? 1.3
          child.material.iridescenceThicknessRange = params.thicknessRange ?? [100, 400]
          child.material.needsUpdate = true
        }
      })
    },

    addSubsurfaceScattering: (object, params = {}) => {
      object.traverse(child => {
        if (child.material && child.material.isMeshPhysicalMaterial) {
          child.material.transmission = params.transmission ?? 1
          child.material.thickness = params.thickness ?? 1
          child.material.attenuationColor = params.attenuationColor || new THREE.Color(0xff8844)
          child.material.attenuationDistance = params.attenuationDistance ?? 10
          child.material.needsUpdate = true
        }
      })
    }
  }
}