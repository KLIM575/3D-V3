export class RadialMenu {
  constructor(onSelect) {
    this.isOpen = false
    this.onSelect = onSelect
    this.items = [
      { id: 'home', label: 'Home', icon: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>' },
      { id: 'work', label: 'Work', icon: '<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>' },
      { id: 'about', label: 'About', icon: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>' },
      { id: 'services', label: 'Services', icon: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>' },
      { id: 'contact', label: 'Contact', icon: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>' }
    ]
    this.container = document.getElementById('radialMenu')
    this.toggle = document.getElementById('radialToggle')
    this.itemsContainer = document.getElementById('radialItems')
    this.init()
  }

  init() {
    this.toggle.addEventListener('click', () => this.toggleMenu())
    this.renderItems()
    setTimeout(() => this.container.classList.add('visible'), 1000)
  }

  renderItems() {
    const count = this.items.length
    const radius = 85
    this.items.forEach((item, i) => {
      const angle = (Math.PI / 2) + (Math.PI * 2 / count) * i
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius
      const el = document.createElement('div')
      el.className = 'radial-item'
      el.dataset.page = item.id
      el.style.cssText = `bottom:${28 - y}px;right:${28 + x}px;`
      el.innerHTML = `<svg viewBox="0 0 24 24">${item.icon}</svg><span class="tooltip">${item.label}</span>`
      el.addEventListener('click', () => {
        this.onSelect(item.id)
        this.close()
      })
      this.itemsContainer.appendChild(el)
    })
  }

  toggleMenu() {
    this.isOpen ? this.close() : this.open()
  }

  open() {
    this.isOpen = true
    this.toggle.classList.add('open')
    const items = this.itemsContainer.querySelectorAll('.radial-item')
    items.forEach((el, i) => {
      setTimeout(() => {
        el.style.opacity = '1'
        el.style.transform = 'scale(1)'
      }, i * 60)
    })
  }

  close() {
    this.isOpen = false
    this.toggle.classList.remove('open')
    const items = this.itemsContainer.querySelectorAll('.radial-item')
    items.forEach((el, i) => {
      el.style.opacity = '0'
      el.style.transform = 'scale(0)'
    })
  }

  setActive(page) {
    this.itemsContainer.querySelectorAll('.radial-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page)
    })
  }
}
