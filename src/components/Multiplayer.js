export class Multiplayer {
  constructor() {
    this.textEl = document.getElementById('mpText')
    this.count = 1
    this.init()
  }

  init() {
    this.simulateActivity()
  }

  simulateActivity() {
    setInterval(() => {
      const variation = Math.floor(Math.random() * 3) - 1
      this.count = Math.max(1, this.count + variation)
      this.updateDisplay()
    }, 8000 + Math.random() * 12000)
  }

  updateDisplay() {
    if (this.textEl) {
      this.textEl.textContent = `${this.count} online`
    }
  }
}
