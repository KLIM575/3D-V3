export class AIChat {
  constructor() {
    this.isOpen = false
    this.container = document.getElementById('aiChat')
    this.messagesEl = document.getElementById('chatMessages')
    this.inputEl = document.getElementById('chatInput')
    this.sendBtn = document.getElementById('chatSend')
    this.closeBtn = document.getElementById('chatClose')
    this.responses = {
      'привет': 'Привет! Я AI ассистент Клима. Чем могу помочь?',
      'hello': 'Hello! I\'m Klim\'s AI assistant. How can I help you?',
      'услуги': 'Клим предлагает: создание сайтов на WebGL/Three.js, 3D визуализацию, интерактивные инсталляции, дизайн интерфейсов и full-stack разработку. Хотите узнать подробнее?',
      'services': 'Klim offers: WebGL/Three.js websites, 3D visualization, interactive installations, UI/UX design, and full-stack development. Want to know more?',
      'цена': 'Стоимость зависит от сложности проекта. Простой лендинг — от 50 000₽, интерактивный сайт с 3D — от 150 000₽. Для точной оценки свяжитесь с Климом напрямую.',
      'price': 'Pricing depends on project complexity. Simple landing page — from $700, interactive 3D website — from $2000. Contact Klim directly for an accurate quote.',
      'контакты': 'Телефон: +7 (914) 200-81-18. Также можете заполнить форму на странице Contact.',
      'contact': 'Phone: +7 (914) 200-81-18. You can also fill out the form on the Contact page.',
      'портфолио': 'В портфолио Клима более 10 проектов — от иммерсивных 3D-сайтов до интерактивных инсталляций. Перейдите на страницу Work, чтобы увидеть все проекты.',
      'portfolio': 'Klim\'s portfolio includes 10+ projects — from immersive 3D websites to interactive installations. Visit the Work page to see them all.',
      'skills': 'Клим владеет: Three.js, WebGL, GLSL, React, Vue, Node.js, Blender, Houdini, GSAP, Figma и многим другим.',
      'default': 'Интересный вопрос! Для детального обсуждения рекомендую связаться с Климом напрямую. Телефон: +7 (914) 200-81-18'
    }
    this.init()
  }

  init() {
    this.closeBtn.addEventListener('click', () => this.close())
    this.sendBtn.addEventListener('click', () => this.send())
    this.inputEl.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.send() })
    this.addBotMessage('Привет! Я AI ассистент Клима. Спросите об услугах, портфолио или ценах.')
  }

  open() {
    this.isOpen = true
    this.container.classList.add('open')
  }

  close() {
    this.isOpen = false
    this.container.classList.remove('open')
  }

  send() {
    const text = this.inputEl.value.trim()
    if (!text) return
    this.addUserMessage(text)
    this.inputEl.value = ''
    setTimeout(() => this.addBotMessage(this.getResponse(text)), 800 + Math.random() * 600)
  }

  getResponse(text) {
    const lower = text.toLowerCase()
    for (const [key, val] of Object.entries(this.responses)) {
      if (key !== 'default' && lower.includes(key)) return val
    }
    return this.responses.default
  }

  addUserMessage(text) {
    const el = document.createElement('div')
    el.className = 'chat-msg user'
    el.textContent = text
    this.messagesEl.appendChild(el)
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight
  }

  addBotMessage(text) {
    const el = document.createElement('div')
    el.className = 'chat-msg bot'
    el.textContent = text
    this.messagesEl.appendChild(el)
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight
  }
}
