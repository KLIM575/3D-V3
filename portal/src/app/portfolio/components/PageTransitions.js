import gsap from 'gsap'

export class PageTransitions {
  constructor() {
    this.pages = document.querySelectorAll('.page')
    this.topLinks = document.querySelectorAll('.top-links a')
    this.mobileTabs = document.querySelectorAll('.mobile-tab')
    this.progressBar = document.getElementById('progressBar')
    this.scrollHint = document.getElementById('scrollHint')
  }

  showPage(pageId) {
    this.pages.forEach(p => {
      p.classList.remove('active')
      p.style.display = 'none'
    })
    const target = document.getElementById('page-' + pageId)
    if (target) {
      target.style.display = 'block'
      target.classList.add('active')
      gsap.fromTo(target, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' })
    }
    this.updateNav(pageId)
    this.updateProgress(pageId)
    this.updateScrollHint(pageId)
  }

  updateNav(pageId) {
    const navMap = { 'home': 'home', 'work': 'work', 'about': 'about', 'services': 'services', 'contact': 'contact' }
    const active = navMap[pageId] || 'home'
    this.topLinks.forEach(l => l.classList.toggle('active', l.dataset.nav === active))
    this.mobileTabs.forEach(t => t.classList.toggle('active', t.dataset.nav === active))
  }

  updateProgress(pageId) {
    const order = ['home', 'work', 'about', 'services', 'contact']
    const idx = order.indexOf(pageId)
    const progress = ((idx + 1) / order.length) * 100
    this.progressBar.style.width = progress + '%'
  }

  updateScrollHint(pageId) {
    if (this.scrollHint) {
      this.scrollHint.style.opacity = pageId === 'home' ? '1' : '0'
    }
  }
}
