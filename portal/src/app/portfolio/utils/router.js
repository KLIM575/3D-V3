export class Router {
  constructor() {
    this.routes = {}
    this.currentPage = null
    this.listeners = []
    this.isTransitioning = false
  }

  addRoute(path, handler) {
    this.routes[path] = handler
  }

  onNavigate(callback) {
    this.listeners.push(callback)
  }

  navigate(path) {
    if (this.isTransitioning) return
    const cleanPath = path.replace('#', '') || '/'
    if (this.routes[cleanPath]) {
      window.location.hash = cleanPath === '/' ? '' : cleanPath
    }
  }

  handleRoute() {
    const hash = window.location.hash.replace('#', '') || '/'
    const handler = this.routes[hash]
    if (handler && hash !== this.currentPage) {
      this.isTransitioning = true
      this.listeners.forEach(cb => cb({ from: this.currentPage, to: hash }))
      const prevPage = this.currentPage
      this.currentPage = hash
      handler({ from: prevPage, to: hash })
      setTimeout(() => { this.isTransitioning = false }, 600)
    }
  }

  init() {
    window.addEventListener('hashchange', () => this.handleRoute())
    window.addEventListener('load', () => this.handleRoute())
    this.handleRoute()
  }
}

export const router = new Router()
