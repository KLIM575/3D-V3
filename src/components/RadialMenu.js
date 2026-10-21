export class RadialMenu {
  constructor(onNavigate) {
    this.onNavigate = onNavigate
    this.isOpen = false
    this.container = document.getElementById('radialMenu')
    this.itemsContainer = document.getElementById('radialItems')
    this.toggle = document.getElementById('radialToggle')
    this.pages = [
      { id: 'home', label: 'Home', icon: 'home' },
      { id: 'work', label: 'Work', icon: 'work' },
      { id: 'about', label: 'About', icon: 'about' },
      { id: 'services', label: 'Services', icon: 'services' },
      { id: 'contact', label: 'Contact', icon: 'contact' }
    ]
    this.init()
  }

  init() {
    this.renderItems()
    this.toggle.addEventListener('click', () => this.toggleMenu())
    this.toggle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        this.toggleMenu()
      }
    })
    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target)) this.close()
    })
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close()
    })
  }

  renderItems() {
    const icons = {
      home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
      work: '<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
      about: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
      services: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
      contact: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>'
    }
    
    this.itemsContainer.innerHTML = this.pages.map((page, i) => {
      const angle = (i / this.pages.length) * 360 - 90
      const radius = 100
      const x = Math.cos(angle * Math.PI / 180) * radius
      const y = Math.sin(angle * Math.PI / 180) * radius
      
      return `
        <button class="radial-item" data-page="${page.id}" style="--angle: ${angle}deg; --x: ${x}px; --y: ${y}px;" data-magnetic="0.3" aria-label="${page.label}">
          <svg viewBox="0 0 24 24" aria-hidden="true">${icons[page.icon]}</svg>
          <span>${page.label}</span>
        </button>
      `
    }).join('')
    
    this.itemsContainer.querySelectorAll('.radial-item').forEach(item => {
      item.addEventListener('click', () => {
        this.onNavigate(item.dataset.page)
        this.close()
      })
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          this.onNavigate(item.dataset.page)
          this.close()
        }
      })
    })
  }

  toggleMenu() {
    if (this.isOpen) this.close()
    else this.open()
  }

  open() {
    this.isOpen = true
    this.container.classList.add('open')
    this.toggle.setAttribute('aria-expanded', 'true')
  }

  close() {
    this.isOpen = false
    this.container.classList.remove('open')
    this.toggle.setAttribute('aria-expanded', 'false')
  }
}