import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase.ts'

export class AIChat {
  constructor() {
    this.isOpen = false
    this.container = document.getElementById('aiChat')
    this.messagesEl = document.getElementById('chatMessages')
    this.inputEl = document.getElementById('chatInput')
    this.sendBtn = document.getElementById('chatSend')
    this.closeBtn = document.getElementById('chatClose')
    this.toggle = document.getElementById('chatToggle')
    this.lastFocus = null
    this.history = []
    this.isStreaming = false
    this.sessionId = this.getOrCreateSessionId()
    this.init()
  }

  getOrCreateSessionId() {
    let sessionId = sessionStorage.getItem('chat_session_id')
    if (!sessionId) {
      sessionId = crypto.randomUUID()
      sessionStorage.setItem('chat_session_id', sessionId)
    }
    return sessionId
  }

  init() {
    this.closeBtn.addEventListener('click', () => this.close())
    this.sendBtn.addEventListener('click', () => this.send())
    this.inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.send() })
    this.addBotMessage('Привет! Я AI ассистент Клима. Спросите об услугах, портфолио или ценах.')
  }

  open() {
    this.isOpen = true
    this.container.classList.add('open')
    this.toggle.classList.add('hidden')
    this.toggle.setAttribute('aria-expanded', 'true')
    this.lastFocus = document.activeElement
    setTimeout(() => this.inputEl.focus(), 250)
  }

  close() {
    this.isOpen = false
    this.container.classList.remove('open')
    this.toggle.classList.remove('hidden')
    this.toggle.setAttribute('aria-expanded', 'false')
    if (this.lastFocus && this.lastFocus.focus) this.lastFocus.focus()
  }

  async send() {
    const text = this.inputEl.value.trim()
    if (!text || this.isStreaming) return
    
    this.addUserMessage(text)
    this.inputEl.value = ''
    this.isStreaming = true
    this.sendBtn.disabled = true
    this.inputEl.disabled = true

    try {
      await this.streamResponse(text)
    } catch (error) {
      console.error('Chat error:', error)
      this.addBotMessage('Произошла ошибка. Попробуйте ещё раз или напишите на hello@klimdushkin.design')
    } finally {
      this.isStreaming = false
      this.sendBtn.disabled = false
      this.inputEl.disabled = false
      this.inputEl.focus()
    }
  }

  async streamResponse(message) {
    const botMessageEl = document.createElement('div')
    botMessageEl.className = 'chat-msg bot streaming'
    botMessageEl.textContent = ''
    this.messagesEl.appendChild(botMessageEl)
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight

    let fullResponse = ''

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ 
          message, 
          history: this.history.slice(-10),
          sessionId: this.sessionId 
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            if (data === '[DONE]') continue
            
            try {
              const parsed = JSON.parse(data)
              if (parsed.content) {
                fullResponse += parsed.content
                botMessageEl.textContent = fullResponse
                this.messagesEl.scrollTop = this.messagesEl.scrollHeight
              }
              if (parsed.done) {
                break
              }
            } catch (e) {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }

      botMessageEl.classList.remove('streaming')
      
      // Update history
      this.history.push({ role: 'user', content: message })
      this.history.push({ role: 'assistant', content: fullResponse })
      
      // Save session to Supabase (optional)
      this.saveSession()

    } catch (error) {
      console.error('Stream error:', error)
      botMessageEl.textContent = 'Не удалось получить ответ. Попробуйте ещё раз.'
      botMessageEl.classList.remove('streaming')
    }
  }

  async saveSession() {
    if (!supabase) return;
    try {
      await supabase
        .from('chat_sessions')
        .upsert({
          session_id: this.sessionId,
          messages: this.history,
          updated_at: new Date().toISOString()
        }, { onConflict: 'session_id' })
    } catch (error) {
      console.warn('Failed to save chat session:', error)
    }
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