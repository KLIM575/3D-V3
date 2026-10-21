export class CursorTrail {
  constructor(canvas, quality = 'medium') {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.points = []
    this.maxPoints = quality === 'high' ? 60 : quality === 'medium' ? 30 : 15
    this.mouseX = 0
    this.mouseY = 0
    this.targetX = 0
    this.targetY = 0
    this.init()
  }

  init() {
    this.resize()
    window.addEventListener('resize', () => this.resize())
    window.addEventListener('mousemove', (e) => {
      this.targetX = e.clientX
      this.targetY = e.clientY
    })
    this.animate()
  }

  resize() {
    this.canvas.width = window.innerWidth
    this.canvas.height = window.innerHeight
  }

  animate() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    
    this.mouseX += (this.targetX - this.mouseX) * 0.15
    this.mouseY += (this.targetY - this.mouseY) * 0.15
    
    this.points.unshift({ x: this.mouseX, y: this.mouseY, life: 1 })
    if (this.points.length > this.maxPoints) this.points.pop()
    
    for (let i = 0; i < this.points.length; i++) {
      const p = this.points[i]
      const next = this.points[i + 1]
      
      p.life -= 0.02
      
      if (p.life <= 0) continue
      
      const alpha = p.life * 0.4
      const size = Math.max(1, p.life * 8)
      
      this.ctx.beginPath()
      this.ctx.arc(p.x, p.y, size, 0, Math.PI * 2)
      this.ctx.fillStyle = `rgba(0, 240, 255, ${alpha})`
      this.ctx.fill()
      
      if (next && next.life > 0) {
        this.ctx.beginPath()
        this.ctx.moveTo(p.x, p.y)
        this.ctx.lineTo(next.x, next.y)
        this.ctx.strokeStyle = `rgba(0, 240, 255, ${alpha * 0.3})`
        this.ctx.lineWidth = size * 0.5
        this.ctx.stroke()
      }
    }
    
    requestAnimationFrame(() => this.animate())
  }
}