export class Multiplayer {
  constructor() {
    this.el = document.getElementById('multiplayer')
    this.textEl = document.getElementById('mpText')
    this.count = 1
    this.channel = null
    this.init()
  }

  init() {
    try {
      this.channel = new BroadcastChannel('klim-dushkin-presence')
      this.channel.onmessage = (e) => this.handleMessage(e)
      this.channel.postMessage({ type: 'join', id: this.id })
      this.count++
      this.update()
    } catch (e) {
      this.simulatePresence()
    }
    setTimeout(() => this.el.classList.add('visible'), 2000)
  }

  get id() {
    return Math.random().toString(36).substr(2, 9)
  }

  handleMessage(e) {
    if (e.data.type === 'join') {
      this.count++
      this.update()
    }
  }

  simulatePresence() {
    setInterval(() => {
      this.count = Math.random() > 0.5 ? 1 : 2
      this.update()
    }, 10000)
  }

  update() {
    this.textEl.textContent = `${this.count} online`
  }
}
