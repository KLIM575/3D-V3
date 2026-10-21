import gsap from 'gsap'

export class LoadingScreen {
  constructor(onComplete) {
    this.el = document.getElementById('loading')
    this.bar = document.getElementById('loadingBar')
    this.onComplete = onComplete
    this.progress = 0
  }

  start() {
    this.simulate()
  }

  simulate() {
    const interval = setInterval(() => {
      this.progress += Math.random() * 12 + 3
      if (this.progress >= 100) {
        this.progress = 100
        clearInterval(interval)
        this.bar.style.width = '100%'
        setTimeout(() => this.hide(), 400)
      } else {
        this.bar.style.width = this.progress + '%'
      }
    }, 80)
  }

  hide() {
    gsap.to(this.el, {
      opacity: 0,
      duration: 0.8,
      ease: 'power2.inOut',
      onComplete: () => {
        this.el.classList.add('hidden')
        this.el.style.display = 'none'
        this.onComplete()
      }
    })
  }
}
