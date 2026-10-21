import * as THREE from 'three'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { AIChat } from './components/AIChat.js'
import { RadialMenu } from './components/RadialMenu.js'
import { Multiplayer } from './components/Multiplayer.js'
import { getQualityPreset, qualityPresets } from './utils/device.js'
import { CursorTrail } from './utils/cursorTrail.js'
import { fetchProjects, fetchServices, fetchSkills, fetchTimeline, fetchProcessSteps, submitContactForm } from './lib/supabase.ts'
import './styles/main.css'

gsap.registerPlugin(ScrollTrigger)

const quality = getQualityPreset()

// ====== GLOBALS ======
let scene, camera, renderer
let flowParticles, flowMaterial
let heroSphere, heroGlow, heroGlowBase = 8
let mouseX = 0, mouseY = 0
let clock = new THREE.Clock()
let scrollProgress = 0
const PAGE_ORDER = ['home', 'work', 'about', 'services', 'contact']

// ====== NAVIGATION ======
let isTransitioning = false

function navigate(name, el) {
  if (isTransitioning) return

  const target = document.getElementById('page-' + name)
  if (!target) return

  document.querySelectorAll('.top-links a, .mobile-tab').forEach(n => {
    n.classList.toggle('active', n.dataset.nav === name)
  })
  if (el && el.closest('.radial-item')) {
    document.querySelectorAll('.radial-item').forEach(i => i.classList.toggle('active', i.dataset.page === name))
  }

  isTransitioning = true
  window.scrollTo({ top: target.offsetTop, behavior: 'smooth' })
  setTimeout(() => { isTransitioning = false }, 800)
}

function initNavigation() {
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault()
      navigate(el.dataset.nav, el)
    })
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        navigate(el.dataset.nav, el)
      }
    })
  })
}

// ====== POPULATE CONTENT ======
let projectsData = []
let servicesData = []
let skillsData = []
let timelineData = []
let processStepsData = []

async function populateWork() {
  try {
    projectsData = await fetchProjects()
  } catch (error) {
    console.error('Failed to fetch projects:', error)
    projectsData = []
  }
  
  const grid = document.getElementById('projectsGrid')
  grid.innerHTML = projectsData.map(p => `
    <div class="project-card" data-id="${p.id}" data-tilt="6">
      <div class="project-thumb">
        <img src="${p.image_url}" alt="${p.title}" loading="lazy">
        <div class="project-overlay"><span>View Project</span></div>
      </div>
      <div class="project-info">
        <div class="project-number">${p.number} / ${p.category}</div>
        <div class="project-title">${p.title}</div>
        <div class="project-cat">${p.client} — ${p.year}</div>
      </div>
    </div>
  `).join('')
}

async function populateWorkFilters() {
  if (projectsData.length === 0) {
    try {
      projectsData = await fetchProjects()
    } catch (error) {
      console.error('Failed to fetch projects for filters:', error)
    }
  }
  
  const el = document.getElementById('workFilters')
  const cats = ['All', ...new Set(projectsData.map(p => p.category))]
  el.innerHTML = cats.map((c, i) =>
    `<button class="filter-btn ${i === 0 ? 'active' : ''}" data-filter="${c}" data-magnetic="0.3">${c}</button>`
  ).join('')
  el.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      const f = btn.dataset.filter
      document.querySelectorAll('.project-card').forEach(card => {
        const p = projectsData.find(x => x.id === card.dataset.id)
        card.style.display = (f === 'All' || p.category === f) ? '' : 'none'
      })
      // Refresh ScrollTrigger after filtering
      ScrollTrigger.refresh()
    })
  })
}

function initProjectModal() {
  const modal = document.getElementById('projectModal')
  const close = document.getElementById('modalClose')
  const content = document.getElementById('modalContent')

  function open(id) {
    const p = projectsData.find(x => x.id === id)
    if (!p) return
    content.innerHTML = `
      <div class="modal-number">${p.number} — ${p.category}</div>
      <div class="modal-title">${p.title}</div>
      <div class="modal-meta">
        <span>Client: <b>${p.client}</b></span>
        <span>Year: <b>${p.year}</b></span>
        <span>Category: <b>${p.category}</b></span>
      </div>
      <div class="modal-image"><img src="${p.image_url}" alt="${p.title}"></div>
      <div class="modal-desc">${p.content_md || p.description}</div>
      <div class="modal-tags">${p.tags.map(t => `<span class="modal-tag">${t}</span>`).join('')}</div>
    `
    modal.classList.add('open')
  }
  function closeModal() { modal.classList.remove('open') }

  document.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('click', () => open(card.dataset.id))
  })
  close.addEventListener('click', closeModal)
  close.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      closeModal()
    }
  })
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal() })
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal() })
}

async function populateAbout() {
  try {
    [skillsData, timelineData] = await Promise.all([
      fetchSkills(),
      fetchTimeline(),
    ])
  } catch (error) {
    console.error('Failed to fetch about data:', error)
    skillsData = []
    timelineData = []
  }
  
  document.getElementById('skillsGrid').innerHTML = skillsData.map(s => `
    <div class="skill-card" data-magnetic="0.2" data-tilt="3">
      <h4>${s.name}</h4>
      <p>${s.level}</p>
      <div class="skill-bar"><div class="skill-bar-fill" data-pct="${s.pct}" style="width:0%"></div></div>
    </div>
  `).join('')

  document.getElementById('timeline').innerHTML = timelineData.map(t => `
    <div class="timeline-item" data-magnetic="0.2">
      <div class="timeline-dot"></div>
      <div class="timeline-year">${t.year}</div>
      <div class="timeline-title">${t.title}</div>
      <div class="timeline-desc">${t.description}</div>
    </div>
  `).join('')
}

async function populateServices() {
  try {
    [servicesData, processStepsData] = await Promise.all([
      fetchServices(),
      fetchProcessSteps(),
    ])
  } catch (error) {
    console.error('Failed to fetch services data:', error)
    servicesData = []
    processStepsData = []
  }
  
  document.getElementById('servicesGrid').innerHTML = servicesData.map(s => `
    <div class="service-card" data-tilt="4">
      <div class="service-thumb">
        <span class="service-thumb-num">${s.num}</span>
      </div>
      <div class="service-info">
        <div class="service-number">${s.num} / Service</div>
        <h3>${s.name}</h3>
        <p>${s.description}</p>
        <ul class="service-features">${s.features.map(f => `<li>${f}</li>`).join('')}</ul>
      </div>
    </div>
  `).join('')

  document.getElementById('processSteps').innerHTML = processStepsData.map(s => `
    <div class="process-step" data-tilt="3">
      <div class="step-number">${s.num}</div>
      <h4>${s.title}</h4>
      <p>${s.description}</p>
    </div>
  `).join('')
}

// ====== SCROLL ======
function onScroll() {
  const max = document.documentElement.scrollHeight - window.innerHeight
  scrollProgress = max > 0 ? window.scrollY / max : 0
  updateProgressBar()
  updateActiveNav()
}

function initPageScroll() {
  window.addEventListener('scroll', onScroll, { passive: true })
}

function updateProgressBar() {
  const bar = document.getElementById('progressBar')
  if (bar) bar.style.width = (scrollProgress * 100) + '%'
}

// ====== THROTTLE HELPER ======
function throttle(fn, ms) {
  let last = 0
  return function (...args) {
    const now = performance.now()
    if (now - last >= ms) {
      last = now
      return fn.apply(this, args)
    }
  }
}

// ====== MAGNETIC ELEMENTS ======
function initMagnetic() {
  if (!quality.enableMagnetic) return
  const handleMove = throttle((e, el, strength) => {
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = (e.clientX - cx) * strength
    const dy = (e.clientY - cy) * strength
    gsap.to(el, { x: dx, y: dy, duration: 0.3, ease: 'power2.out' })
  }, 16)
  document.querySelectorAll('[data-magnetic]').forEach(el => {
    const strength = parseFloat(el.dataset.magnetic) || 0.3
    el.addEventListener('mousemove', (e) => handleMove(e, el, strength))
    el.addEventListener('mouseleave', () => {
      gsap.to(el, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.5)' })
    })
  })
}

// ====== 3D TILT CARDS ======
function initTiltCards() {
  if (!quality.enableTilt) return
  const handleMove = throttle((e, card, maxRotate) => {
    const rect = card.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = (e.clientX - cx) / (rect.width / 2)
    const dy = (e.clientY - cy) / (rect.height / 2)
    const rx = -dy * maxRotate
    const ry = dx * maxRotate
    const lift = card.classList.contains('project-card') ? -8 : 0
    gsap.to(card, {
      rotationX: rx, rotationY: ry, y: lift,
      duration: 0.25, ease: 'power2.out',
      transformPerspective: 1000, overwrite: true
    })
  }, 16)
  document.querySelectorAll('[data-tilt]').forEach(card => {
    const maxRotate = parseFloat(card.dataset.tilt) || 8
    card.addEventListener('mousemove', (e) => handleMove(e, card, maxRotate))
    card.addEventListener('mouseleave', () => {
      gsap.to(card, { rotationX: 0, rotationY: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.5)', overwrite: true })
    })
  })
}

// ====== WEBGL ======

async function initWebGL() {
  const canvas = document.getElementById('webgl-canvas')
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x050507)
  scene.fog = new THREE.FogExp2(0x050507, 0.01)

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000)
  camera.position.set(0, 0, 12)

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.2

  // Initialize flow particles
  createFlowParticles()
  createHeroSphere()
  layoutHero()

  // Initialize canvas-based cursor trail
  if (quality.enableCursorTrail) {
    const trailCanvas = document.createElement('canvas')
    trailCanvas.id = 'cursor-trail-canvas'
    trailCanvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5;'
    document.body.appendChild(trailCanvas)
    new CursorTrail(trailCanvas, quality === qualityPresets.high ? 'high' : 'medium')
  }

  window.addEventListener('resize', onResize)
  window.addEventListener('mousemove', onMouseMove)

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault()
    console.warn('WebGL context lost')
    cancelAnimationFrame(animationFrameId)
  })
  canvas.addEventListener('webglcontextrestored', () => {
    console.log('WebGL context restored')
    animate()
  })
}

// ====== FLOW PARTICLES (motion.dev inspired) ======

function createFlowParticles() {
  const count = quality.particleCount
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const randoms = new Float32Array(count)
  const sizes = new Float32Array(count)

  const gold = new THREE.Color(0xffd700)
  const goldLight = new THREE.Color(0xfff2b0)
  const goldDeep = new THREE.Color(0xffb300)

  for (let i = 0; i < count; i++) {
    const i3 = i * 3
    const r = Math.pow(Math.random(), 0.45) * 16 + 3
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    positions[i3] = r * Math.sin(phi) * Math.cos(theta)
    positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta)
    positions[i3 + 2] = r * Math.cos(phi)

    const m = Math.random()
    const c = m < 0.45 ? gold : m < 0.85 ? goldLight : goldDeep
    colors[i3] = c.r; colors[i3 + 1] = c.g; colors[i3 + 2] = c.b
    randoms[i] = Math.random()
    sizes[i] = Math.random() * 0.4 + 0.22
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1))
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))

  flowMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    },
    vertexShader: `
      attribute float aRandom;
      attribute float aSize;
      varying vec3 vColor;
      varying float vRandom;
      varying float vSize;
      uniform float uTime;
      uniform float uScroll;
      uniform float uPixelRatio;
      void main(){
        vColor = color;
        vRandom = aRandom;
        vSize = aSize;
        vec3 pos = position;
        float t = uTime * 0.15;
        float s = uScroll * 6.28;
        vec3 flow = vec3(
          sin(t + pos.y * 0.5 + s) * 0.4,
          cos(t + pos.z * 0.5 + s) * 0.4,
          sin(t + pos.x * 0.5 + s) * 0.4
        );
        float drift = uScroll * 12.0;
        pos.z -= drift;
        pos.x += sin(s + pos.y * 0.3) * 1.5;
        pos.y += cos(s + pos.x * 0.3) * 1.5;
        pos += flow * aRandom;
        pos.y += sin(uTime * 0.5 + aRandom * 6.28) * 0.5;
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = aSize * uPixelRatio * (54.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vColor;
      varying float vRandom;
      varying float vSize;
      void main(){
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float core = 1.0 - smoothstep(0.0, 0.5, d);
        float a = core * (0.85 + 0.15 * vRandom);
        vec3 color = vColor * (1.35 + core * 0.9);
        gl_FragColor = vec4(color, a);
      }`,
    transparent: true, vertexColors: true, depthWrite: false, blending: THREE.AdditiveBlending
  })

  flowParticles = new THREE.Points(geo, flowMaterial)
  scene.add(flowParticles)
}

// ====== HERO GOLD SPHERE ======
function createGlowTexture() {
  const size = 256
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,225,130,0.9)')
  g.addColorStop(0.22, 'rgba(255,196,60,0.5)')
  g.addColorStop(0.55, 'rgba(255,170,0,0.14)')
  g.addColorStop(1, 'rgba(255,160,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return new THREE.CanvasTexture(c)
}

function createHeroSphere() {
  const count = Math.min(6000, Math.round(quality.particleCount * 2.5))
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const randoms = new Float32Array(count)
  const sizes = new Float32Array(count)

  const gold = new THREE.Color(0xffd700)
  const goldLight = new THREE.Color(0xfff3b8)
  const goldDeep = new THREE.Color(0xffa400)
  const R = 2.6

  for (let i = 0; i < count; i++) {
    const i3 = i * 3
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const rr = R * (Math.random() < 0.15 ? 0.45 + Math.random() * 0.4 : 0.94 + Math.random() * 0.09)
    positions[i3] = rr * Math.sin(phi) * Math.cos(theta)
    positions[i3 + 1] = rr * Math.cos(phi)
    positions[i3 + 2] = rr * Math.sin(phi) * Math.sin(theta)

    const m = Math.random()
    const c = m < 0.4 ? goldLight : m < 0.85 ? gold : goldDeep
    colors[i3] = c.r; colors[i3 + 1] = c.g; colors[i3 + 2] = c.b
    randoms[i] = Math.random()
    sizes[i] = Math.random() * 0.6 + 0.22
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1))
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uOpacity: { value: 1 },
    },
    vertexShader: `
      attribute float aRandom;
      attribute float aSize;
      varying vec3 vColor;
      varying float vRandom;
      varying float vRim;
      varying float vFade;
      uniform float uTime;
      uniform float uPixelRatio;
      uniform float uOpacity;
      void main(){
        vColor = color;
        vRandom = aRandom;
        vFade = uOpacity;
        vec3 pos = position;

        float band = sin(pos.y * 1.8 + uTime * 0.7);
        float ang = uTime * (0.32 + 0.16 * band) + pos.y * 0.35;
        float ca = cos(ang);
        float sa = sin(ang);
        pos.xz = mat2(ca, -sa, sa, ca) * pos.xz;

        vec3 turb = vec3(
          sin(pos.y * 4.0 + uTime * 2.0 + aRandom * 6.28),
          sin(pos.z * 3.5 + uTime * 1.5 + aRandom * 5.0),
          sin(pos.x * 4.5 + uTime * 2.4 + aRandom * 4.2)
        );
        pos += turb * (0.05 + 0.12 * aRandom);
        pos *= 1.0 + sin(uTime * 1.1 + aRandom * 3.14) * 0.02;

        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        vec3 nView = normalize(normalMatrix * normalize(position));
        float rim = 1.0 - abs(dot(nView, normalize(-mv.xyz)));
        vRim = smoothstep(0.5, 1.0, rim);

        gl_PointSize = aSize * uPixelRatio * (46.0 / -mv.z) * (1.0 + vRim * 0.9);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vColor;
      varying float vRandom;
      varying float vRim;
      varying float vFade;
      void main(){
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float core = 1.0 - smoothstep(0.0, 0.5, d);
        float a = core * (0.55 + 0.45 * vRandom) * vFade;
        a *= 0.75 + vRim * 1.1;
        vec3 color = mix(vColor, vec3(1.0, 0.96, 0.82), vRim * 0.45);
        color *= 1.1 + core * 0.8;
        gl_FragColor = vec4(color, a);
      }`,
    transparent: true, vertexColors: true, depthWrite: false,
    blending: THREE.AdditiveBlending
  })

  heroSphere = new THREE.Points(geo, mat)
  scene.add(heroSphere)

  heroGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: createGlowTexture(),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
    opacity: 0.38
  }))
  scene.add(heroGlow)
}

function layoutHero() {
  if (!heroSphere || !heroGlow) return
  const aspect = window.innerWidth / window.innerHeight

  if (aspect < 1.05) {
    heroSphere.position.set(0, 1.1, -1.5)
    heroSphere.scale.setScalar(0.72)
    heroGlow.position.set(0, 1.1, -2.2)
    heroGlowBase = 4.5
  } else {
    heroSphere.position.set(4.3, 0.4, 0)
    heroSphere.scale.setScalar(aspect > 1.6 ? 1 : 0.9)
    heroGlow.position.set(4.3, 0.4, -0.8)
    heroGlowBase = aspect > 1.6 ? 6.5 : 5.5
  }

  heroGlow.scale.setScalar(heroGlowBase)
}



function onMouseMove(e) {
  mouseX = (e.clientX / window.innerWidth) * 2 - 1
  mouseY = -(e.clientY / window.innerHeight) * 2 + 1
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  if (renderer) {
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  }
  if (flowMaterial) {
    flowMaterial.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2)
  }
  if (heroSphere) {
    heroSphere.material.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2)
  }
  layoutHero()
}

// ====== ANIMATE ======
let animationFrameId = 0

function animate() {
  animationFrameId = requestAnimationFrame(animate)
  const elapsed = clock.getElapsedTime()

  camera.position.x += (mouseX * 1.5 - camera.position.x) * 0.02
  camera.position.y += (mouseY * 1 - camera.position.y) * 0.02
  camera.lookAt(0, 0, 0)

  if (flowParticles) {
    flowParticles.material.uniforms.uTime.value = elapsed
    flowParticles.material.uniforms.uScroll.value = scrollProgress
    flowParticles.rotation.y = elapsed * 0.005
    flowParticles.rotation.x = scrollProgress * 0.2
  }

  const heroFade = Math.max(0, Math.min(1, 1 - window.scrollY / (window.innerHeight * 0.85)))
  const heroShow = window.innerWidth / window.innerHeight >= 1.05
  const heroScale = heroShow ? 1 : 0
  if (heroSphere) {
    heroSphere.material.uniforms.uTime.value = elapsed
    heroSphere.material.uniforms.uOpacity.value = heroFade * heroScale
    heroSphere.rotation.x = mouseY * 0.15
    heroSphere.rotation.z = -mouseX * 0.15
    heroSphere.visible = heroShow && heroFade > 0.01
  }
  if (heroGlow) {
    heroGlow.material.opacity = 0.38 * heroFade * heroScale * (0.9 + Math.sin(elapsed * 1.2) * 0.1)
    heroGlow.scale.setScalar(heroGlowBase * (1 + Math.sin(elapsed * 0.8) * 0.03))
    heroGlow.visible = heroShow && heroFade > 0.01
  }

  if (renderer) {
    renderer.render(scene, camera)
  }
}

// ====== LOADING ======
function simulateLoading(onComplete) {
  const bar = document.getElementById('loadingBar')
  const el = document.getElementById('loading')
  let progress = 0
  const interval = setInterval(() => {
    progress += Math.random() * 10 + 5
    if (progress >= 100) {
      progress = 100
      clearInterval(interval)
      bar.style.width = '100%'
      setTimeout(() => {
        el.classList.add('hidden')
        setTimeout(() => { el.style.display = 'none' }, 1000)
        onComplete()
      }, 300)
    } else {
      bar.style.width = progress + '%'
    }
  }, 80)
}

// ====== CONTACT FORM ======
function initContactForm() {
  const form = document.getElementById('contactForm')
  if (!form) return
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const btn = form.querySelector('.submit-btn')
    const originalText = btn.textContent
    
    const formData = new FormData(form)
    const name = formData.get('name') || form.querySelector('input[name="name"]').value
    const email = formData.get('email') || form.querySelector('input[name="email"]').value
    const subject = formData.get('subject') || form.querySelector('input[name="subject"]').value
    const message = formData.get('message') || form.querySelector('textarea[name="message"]').value
    
    btn.textContent = 'Отправка...'
    btn.disabled = true
    
    try {
      const result = await submitContactForm({ name, email, subject, message })
      if (result.success) {
        btn.textContent = 'Отправлено!'
        btn.style.background = '#00f0ff'
        btn.style.color = '#000'
        form.reset()
      } else {
        btn.textContent = 'Ошибка: ' + (result.error || 'Попробуйте снова')
        btn.style.background = '#ff3333'
        btn.style.color = '#fff'
      }
    } catch (error) {
      console.error('Contact form error:', error)
      btn.textContent = 'Ошибка соединения'
      btn.style.background = '#ff3333'
      btn.style.color = '#fff'
    }
    
    setTimeout(() => {
      btn.textContent = originalText
      btn.style.background = ''
      btn.style.color = ''
      btn.disabled = false
    }, 3000)
  })
}

function initScrollHint() {
  const hint = document.getElementById('scrollHint')
  if (!hint) return
  hint.addEventListener('click', () => navigate('work'))
}

function updateActiveNav() {
  const links = document.querySelectorAll('.top-links a')
  const tabs = document.querySelectorAll('.mobile-tab')
  const items = [...PAGE_ORDER].reverse()
  let current = 'home'
  for (const name of items) {
    const el = document.getElementById('page-' + name)
    if (el && window.scrollY >= el.offsetTop - 200) { current = name; break }
  }
  links.forEach(l => l.classList.toggle('active', l.dataset.nav === current))
  tabs.forEach(t => t.classList.toggle('active', t.dataset.nav === current))
  document.querySelectorAll('.radial-item').forEach(i => i.classList.toggle('active', i.dataset.page === current))

  const hint = document.getElementById('scrollHint')
  if (hint) hint.style.opacity = current === 'home' ? '1' : '0'
  if (hint) hint.style.pointerEvents = current === 'home' ? 'auto' : 'none'
}

function initRevealAnimations() {
  ScrollTrigger.create({
    trigger: '.home-content',
    start: 'top 60%',
    once: true,
    onEnter: () => gsap.fromTo('.home-content', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' })
  })
  document.querySelectorAll('.work-header, .about-header, .services-header, .contact-header').forEach(el => {
    ScrollTrigger.create({
      trigger: el,
      start: 'top 80%',
      onEnter: () => gsap.fromTo(el, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' })
    })
  })
}

// ====== STAGGER REVEALS ======
function revealBatch(selector, { y = 40, x = 0, duration = 0.7, stagger = 0.08, onComplete } = {}) {
  ScrollTrigger.batch(selector, {
    start: 'top 85%',
    once: true,
    onEnter: (elements) => {
      const els = elements.filter(el => !el.dataset.revealed)
      if (!els.length) return
      els.forEach(el => { el.dataset.revealed = 'true' })
      gsap.fromTo(els,
        { x, y, opacity: 0 },
        {
          x: 0, y: 0, opacity: 1,
          duration, stagger, ease: 'power3.out',
          overwrite: true,
          clearProps: 'transform,opacity',
          onComplete: onComplete ? () => onComplete(els) : undefined
        }
      )
    }
  })
}

function initStaggerReveals() {
  revealBatch('.project-card')
  revealBatch('.service-card')
  revealBatch('.skill-card', {
    y: 30, duration: 0.6, stagger: 0.06,
    onComplete: (els) => els.forEach((el, i) => {
      const fill = el.querySelector('.skill-bar-fill')
      if (fill) gsap.to(fill, { width: fill.dataset.pct + '%', duration: 1.2, delay: i * 0.05, ease: 'power3.out' })
    })
  })
  revealBatch('.timeline-item', { x: -30, y: 0, duration: 0.6, stagger: 0.1 })
  revealBatch('.process-step', { y: 30, duration: 0.6, stagger: 0.1 })
  revealBatch('.contact-item', { x: -30, y: 0, duration: 0.6, stagger: 0.1 })
}

// Initialize GSAP with reduced motion support
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
if (prefersReducedMotion) {
  gsap.config({ force3D: false })
  ScrollTrigger.config({ limitCallbacks: true })
}

// Cleanup on page unload
function cleanup() {
  if (renderer) {
    renderer.dispose()
  }
  ScrollTrigger.getAll().forEach(t => t.kill())
  gsap.killTweensOf('*')
  window.removeEventListener('resize', onResize)
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('scroll', onScroll)
}

window.addEventListener('beforeunload', cleanup)
window.addEventListener('pagehide', cleanup)

async function boot() {
  await populateWork()
  await populateWorkFilters()
  await populateAbout()
  await populateServices()
  try {
    await initWebGL()
  } catch (e) {
    console.error('WebGL init failed, continuing without 3D:', e)
    if (renderer) renderer.dispose()
    renderer = null
  }
  initNavigation()
  new RadialMenu((name) => navigate(name))
  new Multiplayer()
  initProjectModal()
  initPageScroll()
  initMagnetic()
  initTiltCards()
  initContactForm()
  initScrollHint()
  initRevealAnimations()
  initStaggerReveals()
  onScroll()

  // AI Chat
  const aiChat = new AIChat()
  const chatToggle = document.getElementById('chatToggle')
  chatToggle.addEventListener('click', () => aiChat.open())
  chatToggle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      aiChat.open()
    }
  })

  animate()
  simulateLoading(() => {
    gsap.from('.top-bar', { y: -30, opacity: 0, duration: 1, ease: 'power3.out' })
    gsap.from('.home-title', { y: 30, opacity: 0, duration: 1, delay: 0.2, ease: 'power3.out' })
    gsap.from('.home-subtitle', { y: 20, opacity: 0, duration: 0.8, delay: 0.4, ease: 'power3.out' })
    gsap.from('.home-tagline', { y: 20, opacity: 0, duration: 0.8, delay: 0.6, ease: 'power3.out' })
    gsap.from('.scroll-hint', { y: 15, opacity: 0, duration: 0.8, delay: 0.8, ease: 'power3.out' })
  })
}

// Boot after DOM is ready
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', boot)
}