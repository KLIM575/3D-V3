import * as THREE from 'three'

let RAPIER = null

async function initRapier() {
  if (RAPER) return RAPIER
  const mod = await import('@dimforge/rapier3d')
  RAPIER = await mod.default()
  return RAPIER
}

export class PhysicsWorld {
  constructor(options = {}) {
    this.gravity = options.gravity || { x: 0, y: -9.81, z: 0 }
    this.world = null
    this.bodies = new Map()
    this.colliders = new Map()
    this.joints = new Map()
    this.threeObjects = new Map()
    this.timeStep = 1 / 60
    this.subSteps = 4
    this.enabled = true
  }

  async init() {
    const Rapier = await initRapier()
    this.world = new Rapier.World(this.gravity)
    return this
  }

  createRigidBody(desc) {
    const Rapier = RAPIER
    const body = this.world.createRigidBody(desc)
    return body
  }

  createCollider(desc, body) {
    const Rapier = RAPIER
    const collider = this.world.createCollider(desc, body)
    return collider
  }

  addBox(position, size, options = {}) {
    const Rapier = RAPIER
    const bodyDesc = options.fixed
      ? Rapier.RigidBodyDesc.fixed()
      : Rapier.RigidBodyDesc.dynamic()
    bodyDesc.setTranslation(position.x, position.y, position.z)

    const body = this.createRigidBody(bodyDesc)
    const colliderDesc = Rapier.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
    if (options.friction !== undefined) colliderDesc.setFriction(options.friction)
    if (options.restitution !== undefined) colliderDesc.setRestitution(options.restitution)
    if (options.density !== undefined) colliderDesc.setDensity(options.density)
    if (options.sensor) colliderDesc.setSensor(true)

    this.createCollider(colliderDesc, body)

    const id = options.id || `box_${this.bodies.size}`
    this.bodies.set(id, body)

    return { id, body }
  }

  addSphere(position, radius, options = {}) {
    const Rapier = RAPIER
    const bodyDesc = options.fixed
      ? Rapier.RigidBodyDesc.fixed()
      : Rapier.RigidBodyDesc.dynamic()
    bodyDesc.setTranslation(position.x, position.y, position.z)

    const body = this.createRigidBody(bodyDesc)
    const colliderDesc = Rapier.ColliderDesc.ball(radius)
    if (options.friction !== undefined) colliderDesc.setFriction(options.friction)
    if (options.restitution !== undefined) colliderDesc.setRestitution(options.restitution)
    if (options.density !== undefined) colliderDesc.setDensity(options.density)

    this.createCollider(colliderDesc, body)

    const id = options.id || `sphere_${this.bodies.size}`
    this.bodies.set(id, body)

    return { id, body }
  }

  addCapsule(position, radius, halfHeight, options = {}) {
    const Rapier = RAPIER
    const bodyDesc = options.fixed
      ? Rapier.RigidBodyDesc.fixed()
      : Rapier.RigidBodyDesc.dynamic()
    bodyDesc.setTranslation(position.x, position.y, position.z)

    const body = this.createRigidBody(bodyDesc)
    const colliderDesc = Rapier.ColliderDesc.capsule(halfHeight, radius)
    if (options.friction !== undefined) colliderDesc.setFriction(options.friction)
    if (options.restitution !== undefined) colliderDesc.setRestitution(options.restitution)

    this.createCollider(colliderDesc, body)

    const id = options.id || `capsule_${this.bodies.size}`
    this.bodies.set(id, body)

    return { id, body }
  }

  addTrimesh(vertices, indices, options = {}) {
    const Rapier = RAPIER
    const bodyDesc = options.fixed
      ? Rapier.RigidBodyDesc.fixed()
      : Rapier.RigidBodyDesc.dynamic()
    if (options.position) bodyDesc.setTranslation(options.position.x, options.position.y, options.position.z)

    const body = this.createRigidBody(bodyDesc)
    const colliderDesc = Rapier.ColliderDesc.trimesh(vertices, indices)
    if (options.friction !== undefined) colliderDesc.setFriction(options.friction)
    if (options.restitution !== undefined) colliderDesc.setRestitution(options.restitution)

    this.createCollider(colliderDesc, body)

    const id = options.id || `trimesh_${this.bodies.size}`
    this.bodies.set(id, body)

    return { id, body }
  }

  addHeightfield(heights, scale, options = {}) {
    const Rapier = RAPIER
    const bodyDesc = Rapier.RigidBodyDesc.fixed()
    if (options.position) bodyDesc.setTranslation(options.position.x, options.position.y, options.position.z)

    const body = this.createRigidBody(bodyDesc)
    const colliderDesc = Rapier.ColliderDesc.heightfield(heights, scale)
    if (options.friction !== undefined) colliderDesc.setFriction(options.friction)

    this.createCollider(colliderDesc, body)

    const id = options.id || `heightfield_${this.bodies.size}`
    this.bodies.set(id, body)

    return { id, body }
  }

  createCloth(width, height, segmentsX, segmentsY, options = {}) {
    const Rapier = RAPIER
    const { position = { x: 0, y: 10, z: 0 }, spacing = 0.5, stiffness = 100, damping = 1, pinnedCorners = true } = options

    const cloth = this.world.createCloth(
      Rapier.Vector3.new(position.x, position.y, position.z),
      segmentsX, segmentsY,
      spacing, spacing
    )

    if (pinnedCorners) {
      const numX = segmentsX + 1
      cloth.setVertexFixed(0, true)
      cloth.setVertexFixed(segmentsX, true)
      cloth.setVertexFixed(segmentsX * numX, true)
      cloth.setVertexFixed(segmentsX * numX + segmentsX, true)
    }

    const id = options.id || `cloth_${this.bodies.size}`
    this.bodies.set(id, cloth)

    return { id, cloth, segmentsX, segmentsY, spacing }
  }

  createSoftBody(vertices, indices, options = {}) {
    const Rapier = RAPIER
    const { position = { x: 0, y: 5, z: 0 }, mass = 1, stiffness = 10, damping = 0.5 } = options

    const softBody = this.world.createSoftBody(vertices, indices, mass)
    softBody.setStiffness(stiffness)
    softBody.setDamping(damping)

    const translation = new Rapier.Vector3(position.x, position.y, position.z)
    softBody.setTranslation(translation, true)

    const id = options.id || `softbody_${this.bodies.size}`
    this.bodies.set(id, softBody)

    return { id, softBody }
  }

  createFluidParticleSystem(particleRadius, options = {}) {
    const Rapier = RAPIER
    const fluid = this.world.createFluidSystem(particleRadius)
    const id = options.id || `fluid_${this.bodies.size}`
    this.bodies.set(id, fluid)
    return { id, fluid }
  }

  addFluidParticles(fluidId, positions) {
    const fluid = this.bodies.get(fluidId)
    if (!fluid) return
    fluid.addParticles(positions)
  }

  createJoint(body1Id, body2Id, jointType, params) {
    const Rapier = RAPIER
    const body1 = this.bodies.get(body1Id)
    const body2 = this.bodies.get(body2Id)
    if (!body1 || !body2) return

    let joint
    switch (jointType) {
      case 'fixed':
        joint = this.world.createImpulseJoint(Rapier.JointData.fixed(params), body1, body2, true)
        break
      case 'spherical':
        joint = this.world.createImpulseJoint(Rapier.JointData.spherical(params), body1, body2, true)
        break
      case 'revolute':
        joint = this.world.createImpulseJoint(Rapier.JointData.revolute(params), body1, body2, true)
        break
      case 'prismatic':
        joint = this.world.createImpulseJoint(Rapier.JointData.prismatic(params), body1, body2, true)
        break
      case 'distance':
        joint = this.world.createImpulseJoint(Rapier.JointData.distance(params), body1, body2, true)
        break
    }

    if (joint) {
      const id = `${body1Id}_${body2Id}_${jointType}`
      this.joints.set(id, joint)
      return { id, joint }
    }
  }

  syncThreeObject(physicsId, threeObject, options = {}) {
    const body = this.bodies.get(physicsId)
    if (!body) return

    this.threeObjects.set(physicsId, { object: threeObject, options })
  }

  update(delta) {
    if (!this.enabled || !this.world) return

    const steps = Math.min(Math.ceil(delta / this.timeStep), this.subSteps)
    const stepDelta = delta / steps

    for (let i = 0; i < steps; i++) {
      this.world.step(stepDelta)
    }

    this.threeObjects.forEach(({ object, options }, physicsId) => {
      const body = this.bodies.get(physicsId)
      if (!body) return

      if (body.type && body.type() === 'RigidBody') {
        const pos = body.translation()
        const rot = body.rotation()

        object.position.set(pos.x, pos.y, pos.z)
        object.quaternion.set(rot.x, rot.y, rot.z, rot.w)
      } else if (body.type && body.type() === 'Cloth') {
        this._updateClothMesh(object, body, options)
      } else if (body.type && body.type() === 'SoftBody') {
        this._updateSoftBodyMesh(object, body, options)
      } else if (body.type && body.type() === 'FluidSystem') {
        this._updateFluidParticles(object, body, options)
      }
    })
  }

  _updateClothMesh(mesh, cloth, options) {
    const positions = mesh.geometry.attributes.position
    const numX = options.segmentsX + 1
    const numY = options.segmentsY + 1

    for (let y = 0; y <= options.segmentsY; y++) {
      for (let x = 0; x <= options.segmentsX; x++) {
        const idx = y * numX + x
        const vertex = cloth.vertex(idx)
        positions.setXYZ(idx, vertex.x, vertex.y, vertex.z)
      }
    }
    positions.needsUpdate = true
    mesh.geometry.computeVertexNormals()
  }

  _updateSoftBodyMesh(mesh, softBody, options) {
    const positions = mesh.geometry.attributes.position
    const vertexCount = softBody.numVertices()

    for (let i = 0; i < vertexCount; i++) {
      const vertex = softBody.vertex(i)
      positions.setXYZ(i, vertex.x, vertex.y, vertex.z)
    }
    positions.needsUpdate = true
    mesh.geometry.computeVertexNormals()
  }

  _updateFluidParticles(points, fluid, options) {
    const positions = points.geometry.attributes.position
    const particleCount = fluid.numParticles()

    for (let i = 0; i < particleCount; i++) {
      const pos = fluid.particlePosition(i)
      positions.setXYZ(i, pos.x, pos.y, pos.z)
    }
    positions.needsUpdate = true
  }

  applyForce(physicsId, force, point) {
    const body = this.bodies.get(physicsId)
    if (!body || !body.applyForce) return

    body.applyForce(force, point || { x: 0, y: 0, z: 0 }, true)
  }

  applyImpulse(physicsId, impulse, point) {
    const body = this.bodies.get(physicsId)
    if (!body || !body.applyImpulse) return

    body.applyImpulse(impulse, point || { x: 0, y: 0, z: 0 }, true)
  }

  setVelocity(physicsId, velocity) {
    const body = this.bodies.get(physicsId)
    if (!body || !body.setLinvel) return

    body.setLinvel(velocity, true)
  }

  getPosition(physicsId) {
    const body = this.bodies.get(physicsId)
    if (!body) return null
    const pos = body.translation()
    return { x: pos.x, y: pos.y, z: pos.z }
  }

  raycast(origin, direction, maxDistance = 100) {
    const Rapier = RAPIER
    const ray = new Rapier.Ray(origin, direction)
    return this.world.castRay(ray, maxDistance, true, Rapier.QueryFilter.default())
  }

  enable() { this.enabled = true }
  disable() { this.enabled = false }

  dispose() {
    if (this.world) {
      this.world.free()
      this.world = null
    }
    this.bodies.clear()
    this.colliders.clear()
    this.joints.clear()
    this.threeObjects.clear()
  }
}

export function createClothMesh(segmentsX, segmentsY, spacing, options = {}) {
  const geometry = new THREE.PlaneGeometry(
    segmentsX * spacing,
    segmentsY * spacing,
    segmentsX,
    segmentsY
  )
  geometry.rotateX(-Math.PI / 2)

  const material = new THREE.MeshStandardMaterial({
    side: THREE.DoubleSide,
    color: options.color || 0xffffff,
    metalness: options.metalness || 0.1,
    roughness: options.roughness || 0.8,
    transparent: options.transparent || false,
    opacity: options.opacity || 1
  })

  return new THREE.Mesh(geometry, material)
}

export function createSoftBodyMesh(vertices, indices, options = {}) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()

  const material = new THREE.MeshStandardMaterial({
    side: THREE.DoubleSide,
    color: options.color || 0xffffff,
    metalness: options.metalness || 0.1,
    roughness: options.roughness || 0.8
  })

  return new THREE.Mesh(geometry, material)
}

export function createFluidParticles(count, size, options = {}) {
  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const sizes = new Float32Array(count)

  for (let i = 0; i < count; i++) {
    positions[i * 3] = 0
    positions[i * 3 + 1] = 0
    positions[i * 3 + 2] = 0
    colors[i * 3] = 0.2
    colors[i * 3 + 1] = 0.6
    colors[i * 3 + 2] = 1.0
    sizes[i] = size
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))

  const material = new THREE.PointsMaterial({
    size: size,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })

  return new THREE.Points(geometry, material)
}

export async function createPhysicsDemo(scene, options = {}) {
  const physics = new PhysicsWorld({ gravity: { x: 0, y: -9.81, z: 0 } })
  await physics.init()

  const { Rapier } = await import('@dimforge/rapier3d')

  const ground = physics.addBox(
    { x: 0, y: -0.5, z: 0 },
    { x: 50, y: 1, z: 50 },
    { fixed: true, friction: 0.8, id: 'ground' }
  )

  const groundMesh = new THREE.Mesh(
    new THREE.BoxGeometry(50, 1, 50),
    new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 })
  )
  groundMesh.position.set(0, -0.5, 0)
  scene.add(groundMesh)

  for (let i = 0; i < 20; i++) {
    const box = physics.addBox(
      { x: (Math.random() - 0.5) * 10, y: 5 + i * 2, z: (Math.random() - 0.5) * 10 },
      { x: 1, y: 1, z: 1 },
      { friction: 0.5, restitution: 0.3, id: `box_${i}` }
    )

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(Math.random(), 0.7, 0.5),
        roughness: 0.4,
        metalness: 0.2
      })
    )
    mesh.position.copy(box.body.translation())
    scene.add(mesh)
    physics.syncThreeObject(box.id, mesh)
  }

  const cloth = physics.createCloth(20, 20, 20, 20, {
    position: { x: 0, y: 15, z: 0 },
    spacing: 0.3,
    pinnedCorners: true,
    id: 'cloth'
  })

  const clothMesh = createClothMesh(20, 20, 0.3, { color: 0x00f0ff, transparent: true, opacity: 0.8 })
  clothMesh.position.set(0, 15, 0)
  clothMesh.rotation.x = -Math.PI / 2
  scene.add(clothMesh)
  physics.syncThreeObject(cloth.id, clothMesh, { segmentsX: 20, segmentsY: 20, spacing: 0.3 })

  const windForce = new THREE.Vector3(0, 0, 0)
  let windTime = 0

  return {
    physics,
    update: (delta) => {
      windTime += delta
      windForce.set(
        Math.sin(windTime * 0.5) * 2,
        Math.cos(windTime * 0.3) * 0.5,
        Math.sin(windTime * 0.7) * 2
      )

      const clothBody = physics.bodies.get('cloth')
      if (clothBody && clothBody.addForce) {
        for (let y = 0; y <= 20; y++) {
          for (let x = 0; x <= 20; x++) {
            const idx = y * 21 + x
            clothBody.addForce(idx, windForce, true)
          }
        }
      }

      physics.update(delta)
    },
    addExplosion: (position, force = 50, radius = 10) => {
      physics.bodies.forEach((body, id) => {
        if (id === 'ground' || id === 'cloth') return
        const pos = physics.getPosition(id)
        if (!pos) return

        const dx = pos.x - position.x
        const dy = pos.y - position.y
        const dz = pos.z - position.z
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

        if (dist < radius) {
          const dir = { x: dx / dist, y: dy / dist, z: dz / dist }
          const f = force * (1 - dist / radius)
          physics.applyImpulse(id, { x: dir.x * f, y: dir.y * f, z: dir.z * f })
        }
      })
    }
  }
}