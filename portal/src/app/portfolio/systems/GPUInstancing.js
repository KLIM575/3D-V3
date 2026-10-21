import * as THREE from 'three'

export class GPUInstancingSystem {
  constructor(renderer, options = {}) {
    this.renderer = renderer
    this.maxInstances = options.maxInstances || 1000000
    this.instancedMeshes = new Map()
    this.computeShaders = new Map()
    this.buffers = new Map()
    this.frame = 0
  }

  createInstancedMesh(name, geometry, material, count, options = {}) {
    const mesh = new THREE.InstancedMesh(geometry, material, count)
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    mesh.instanceColor = options.hasColor ? new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3) : null

    if (options.frustumCulled === false) mesh.frustumCulled = false
    if (options.castShadow) mesh.castShadow = true
    if (options.receiveShadow) mesh.receiveShadow = true

    this.instancedMeshes.set(name, { mesh, count, options, data: this._createInstanceData(count, options) })
    return mesh
  }

  _createInstanceData(count, options) {
    const data = {
      position: new Float32Array(count * 3),
      rotation: new Float32Array(count * 4),
      scale: new Float32Array(count * 3),
      color: options.hasColor ? new Float32Array(count * 3) : null,
      velocity: options.physics ? new Float32Array(count * 3) : null,
      life: options.particles ? new Float32Array(count) : null,
      custom: options.customAttributes ? {} : null
    }

    if (options.customAttributes) {
      Object.entries(options.customAttributes).forEach(([key, { size, defaultValue = 0 }]) => {
        data.custom[key] = new Float32Array(count * size)
        data.custom[key].fill(defaultValue)
      })
    }

    return data
  }

  setInstanceAt(index, name, { position, rotation, scale, color, custom }) {
    const instanced = this.instancedMeshes.get(name)
    if (!instanced || index >= instanced.count) return

    const { data, mesh } = instanced
    const dummy = this._getDummy()

    if (position) {
      dummy.position.set(position.x, position.y, position.z)
      data.position[index * 3] = position.x
      data.position[index * 3 + 1] = position.y
      data.position[index * 3 + 2] = position.z
    }
    if (rotation) {
      dummy.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
      data.rotation[index * 4] = rotation.x
      data.rotation[index * 4 + 1] = rotation.y
      data.rotation[index * 4 + 2] = rotation.z
      data.rotation[index * 4 + 3] = rotation.w
    }
    if (scale) {
      dummy.scale.set(scale.x, scale.y, scale.z)
      data.scale[index * 3] = scale.x
      data.scale[index * 3 + 1] = scale.y
      data.scale[index * 3 + 2] = scale.z
    }

    dummy.updateMatrix()
    mesh.setMatrixAt(index, dummy.matrix)
    mesh.instanceMatrix.needsUpdate = true

    if (color && data.color) {
      data.color[index * 3] = color.r
      data.color[index * 3 + 1] = color.g
      data.color[index * 3 + 2] = color.b
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }

    if (custom && data.custom) {
      Object.entries(custom).forEach(([key, value]) => {
        if (data.custom[key]) {
          const attr = data.custom[key]
          const size = attr.length / instanced.count
          value.forEach((v, i) => attr[index * size + i] = v)
        }
      })
    }
  }

  _getDummy() {
    if (!this._dummy) this._dummy = new THREE.Object3D()
    return this._dummy
  }

  createComputeShader(name, shaderCode, uniforms, workgroupSize = 64) {
    const computeShader = {
      uniforms,
      workgroupSize,
      shaderCode,
      pipeline: null,
      bindGroup: null,
      buffers: {}
    }
    this.computeShaders.set(name, computeShader)
    return computeShader
  }

  async initComputePipelines() {
    if (!this.renderer.backend || !this.renderer.backend.device) {
      console.warn('WebGPU not available, compute shaders disabled')
      return
    }

    const device = this.renderer.backend.device

    for (const [name, shader] of this.computeShaders) {
      const module = device.createShaderModule({
        code: shader.shaderCode
      })

      const bindGroupLayoutEntries = []
      const bindGroupEntries = []
      let binding = 0

      for (const [uniformName, uniform] of Object.entries(shader.uniforms)) {
        let buffer
        if (uniform.type === 'storage') {
          buffer = device.createBuffer({
            size: uniform.size,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
            mappedAtCreation: false
          })
          bindGroupLayoutEntries.push({ binding: binding++, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } })
          bindGroupEntries.push({ binding: binding - 1, resource: { buffer } })
        } else if (uniform.type === 'uniform') {
          buffer = device.createBuffer({
            size: uniform.size,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            mappedAtCreation: false
          })
          bindGroupLayoutEntries.push({ binding: binding++, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } })
          bindGroupEntries.push({ binding: binding - 1, resource: { buffer } })
        }
        shader.buffers[uniformName] = buffer
      }

      const bindGroupLayout = device.createBindGroupLayout({ entries: bindGroupLayoutEntries })
      const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] })

      shader.pipeline = device.createComputePipeline({
        layout: pipelineLayout,
        compute: { module, entryPoint: 'main' }
      })

      shader.bindGroup = device.createBindGroup({ layout: bindGroupLayout, entries: bindGroupEntries })
    }
  }

  dispatchCompute(name, workgroups) {
    const shader = this.computeShaders.get(name)
    if (!shader || !shader.pipeline) return

    const encoder = this.renderer.backend.device.createCommandEncoder()
    const pass = encoder.beginComputePass()
    pass.setPipeline(shader.pipeline)
    pass.setBindGroup(0, shader.bindGroup)
    pass.dispatchWorkgroups(workgroups.x, workgroups.y, workgroups.z)
    pass.end()
    this.renderer.backend.device.queue.submit([encoder.finish()])
  }

  updateUniformBuffer(name, uniformName, data) {
    const shader = this.computeShaders.get(name)
    if (!shader || !shader.buffers[uniformName]) return

    this.renderer.backend.device.queue.writeBuffer(shader.buffers[uniformName], 0, data)
  }

  readBuffer(name, uniformName, size) {
    const shader = this.computeShaders.get(name)
    if (!shader || !shader.buffers[uniformName]) return null

    return new Promise(resolve => {
      const buffer = shader.buffers[uniformName]
      const readBuffer = this.renderer.backend.device.createBuffer({
        size: buffer.size,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      })

      const encoder = this.renderer.backend.device.createCommandEncoder()
      encoder.copyBufferToBuffer(buffer, 0, readBuffer, 0, buffer.size)
      this.renderer.backend.device.queue.submit([encoder.finish()])

      readBuffer.mapAsync(GPUMapMode.READ).then(() => {
        const arrayBuffer = readBuffer.getMappedRange(0, size)
        resolve(new Float32Array(arrayBuffer.slice(0)))
        readBuffer.unmap()
      })
    })
  }

  createGrassField(name, count, bounds, options = {}) {
    const geometry = new THREE.PlaneGeometry(0.1, 1.5, 1, 3)
    geometry.translate(0, 0.75, 0)

    const material = new THREE.MeshStandardMaterial({
      color: 0x3a5a2a,
      side: THREE.DoubleSide,
      alphaTest: 0.5,
      roughness: 0.9,
      metalness: 0.1
    })

    const mesh = this.createInstancedMesh(name, geometry, material, count, {
      hasColor: true,
      frustumCulled: false,
      customAttributes: {
        windOffset: { size: 1, defaultValue: Math.random() * Math.PI * 2 },
        stiffness: { size: 1, defaultValue: 0.5 + Math.random() * 0.5 }
      }
    })

    const data = this.instancedMeshes.get(name).data
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * bounds.width
      const z = (Math.random() - 0.5) * bounds.depth
      const y = options.heightMap ? options.heightMap(x, z) : 0

      this.setInstanceAt(i, name, {
        position: new THREE.Vector3(x, y, z),
        rotation: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI * 2),
        scale: new THREE.Vector3(0.8 + Math.random() * 0.4, 0.8 + Math.random() * 0.4, 0.8 + Math.random() * 0.4),
        color: new THREE.Color().setHSL(0.3, 0.4, 0.2 + Math.random() * 0.2)
      })
    }

    return mesh
  }

  createParticleField(name, count, bounds, options = {}) {
    const geometry = new THREE.PlaneGeometry(1, 1)
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute vec3 instancePosition;
        attribute vec4 instanceRotation;
        attribute vec3 instanceScale;
        attribute float instanceLife;
        attribute vec3 instanceVelocity;
        uniform float uTime;
        uniform float uDelta;
        varying float vLife;
        varying vec3 vVelocity;
        void main() {
          vLife = instanceLife;
          vVelocity = instanceVelocity;
          vec3 pos = instancePosition;
          vec3 scale = instanceScale;
          mat4 rotMat = mat4(
            1.0 - 2.0*(instanceRotation.y*instanceRotation.y + instanceRotation.z*instanceRotation.z), 2.0*(instanceRotation.x*instanceRotation.y - instanceRotation.z*instanceRotation.w), 2.0*(instanceRotation.x*instanceRotation.z + instanceRotation.y*instanceRotation.w), 0.0,
            2.0*(instanceRotation.x*instanceRotation.y + instanceRotation.z*instanceRotation.w), 1.0 - 2.0*(instanceRotation.x*instanceRotation.x + instanceRotation.z*instanceRotation.z), 2.0*(instanceRotation.y*instanceRotation.z - instanceRotation.x*instanceRotation.w), 0.0,
            2.0*(instanceRotation.x*instanceRotation.z - instanceRotation.y*instanceRotation.w), 2.0*(instanceRotation.y*instanceRotation.z + instanceRotation.x*instanceRotation.w), 1.0 - 2.0*(instanceRotation.x*instanceRotation.x + instanceRotation.y*instanceRotation.y), 0.0,
            0.0, 0.0, 0.0, 1.0
          );
          vec4 mvPosition = modelViewMatrix * rotMat * vec4(position * scale, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = scale.x * (300.0 / -mvPosition.z);
        }
      `,
      fragmentShader: `
        varying float vLife;
        varying vec3 vVelocity;
        uniform float uTime;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float a = 1.0 - smoothstep(0.0, 0.5, d);
          a *= vLife;
          vec3 color = mix(vec3(0.0, 0.5, 1.0), vec3(1.0, 0.3, 0.0), vLife);
          gl_FragColor = vec4(color, a * 0.8);
        }
      `
    })

    const mesh = this.createInstancedMesh(name, geometry, material, count, {
      particles: true,
      customAttributes: {
        velocity: { size: 3, defaultValue: 0 },
        life: { size: 1, defaultValue: 1 }
      }
    })

    return mesh
  }

  update(delta, time) {
    this.frame++

    this.instancedMeshes.forEach(({ mesh, data, options }) => {
      if (options.particles && data.life && data.velocity) {
        for (let i = 0; i < mesh.count; i++) {
          data.position[i * 3] += data.velocity[i * 3] * delta
          data.position[i * 3 + 1] += data.velocity[i * 3 + 1] * delta
          data.position[i * 3 + 2] += data.velocity[i * 3 + 2] * delta
          data.life[i] -= delta * (options.lifeDecay || 0.1)

          if (data.life[i] <= 0) {
            this._respawnParticle(i, data, options)
          }
        }
        mesh.instanceMatrix.needsUpdate = true
      }

      if (options.wind && data.custom?.windOffset && data.custom?.stiffness) {
        const dummy = this._getDummy()
        for (let i = 0; i < mesh.count; i++) {
          const windForce = Math.sin(time * 2 + data.custom.windOffset[i]) * 0.1
          const bend = windForce * data.custom.stiffness[i]
          dummy.position.fromArray(data.position, i * 3)
          dummy.rotation.y = bend
          dummy.scale.fromArray(data.scale, i * 3)
          dummy.updateMatrix()
          mesh.setMatrixAt(i, dummy.matrix)
        }
        mesh.instanceMatrix.needsUpdate = true
      }
    })
  }

  _respawnParticle(i, data, options) {
    const bounds = options.bounds || { width: 100, height: 100, depth: 100 }
    data.position[i * 3] = (Math.random() - 0.5) * bounds.width
    data.position[i * 3 + 1] = bounds.height
    data.position[i * 3 + 2] = (Math.random() - 0.5) * bounds.depth
    data.velocity[i * 3] = (Math.random() - 0.5) * 2
    data.velocity[i * 3 + 1] = -Math.random() * 5 - 1
    data.velocity[i * 3 + 2] = (Math.random() - 0.5) * 2
    data.life[i] = 1
  }

  getInstancedMesh(name) {
    return this.instancedMeshes.get(name)?.mesh
  }

  dispose() {
    this.instancedMeshes.forEach(({ mesh }) => {
      mesh.geometry.dispose()
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(m => m.dispose())
      } else {
        mesh.material.dispose()
      }
    })
    this.instancedMeshes.clear()
    this.computeShaders.clear()
  }
}

export const grassComputeShader = `
  struct InstanceData {
    position: vec3<f32>,
    rotation: vec4<f32>,
    scale: vec3<f32>,
    windOffset: f32,
    stiffness: f32,
  };

  @group(0) @binding(0) var<storage, read_write> instances: array<InstanceData>;
  @group(0) @binding(1) var<uniform> params: Params;

  struct Params {
    time: f32,
    delta: f32,
    windStrength: f32,
    windSpeed: f32,
    count: u32,
  };

  @compute @workgroup_size(64)
  fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let index = id.x;
    if (index >= params.count) { return; }

    var instance = instances[index];
    let windForce = sin(params.time * params.windSpeed + instance.windOffset) * params.windStrength;
    let bend = windForce * instance.stiffness;

    let rotY = bend;
    let c = cos(rotY * 0.5);
    let s = sin(rotY * 0.5);
    instance.rotation = vec4<f32>(0.0, s, 0.0, c);

    instances[index] = instance;
  }
`

export const particleComputeShader = `
  struct Particle {
    position: vec3<f32>,
    velocity: vec3<f32>,
    life: f32,
    color: vec3<f32>,
    size: f32,
  };

  @group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
  @group(0) @binding(1) var<uniform> params: Params;

  struct Params {
    time: f32,
    delta: f32,
    gravity: vec3<f32>,
    bounds: vec3<f32>,
    lifeDecay: f32,
    count: u32,
  };

  @compute @workgroup_size(256)
  fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let index = id.x;
    if (index >= params.count) { return; }

    var p = particles[index];
    p.position += p.velocity * params.delta;
    p.velocity += params.gravity * params.delta;
    p.life -= params.lifeDecay * params.delta;

    if (p.life <= 0.0) {
      p.position = vec3<f32>(
        (rand(vec2<f32>(params.time, f32(index))) - 0.5) * params.bounds.x,
        params.bounds.y,
        (rand(vec2<f32>(params.time + 1.0, f32(index))) - 0.5) * params.bounds.z
      );
      p.velocity = vec3<f32>(
        (rand(vec2<f32>(params.time + 2.0, f32(index))) - 0.5) * 2.0,
        -rand(vec2<f32>(params.time + 3.0, f32(index))) * 5.0 - 1.0,
        (rand(vec2<f32>(params.time + 4.0, f32(index))) - 0.5) * 2.0
      );
      p.life = 1.0;
      p.size = rand(vec2<f32>(params.time + 5.0, f32(index))) * 0.5 + 0.5;
    }

    particles[index] = p;
  }

  fn rand(seed: vec2<f32>) -> f32 {
    return fract(sin(dot(seed, vec2<f32>(12.9898, 78.233))) * 43758.5453);
  }
`