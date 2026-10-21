import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'RUB'): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...options,
  })
}

export function formatDateTime(date: Date | string): string {
  return formatDate(date, { hour: '2-digit', minute: '2-digit' })
}

export function generateInvoiceNumber(): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `INV-${year}${month}-${random}`
}

export function getStageLabel(type: string): string {
  const labels: Record<string, string> = {
    SPECIFICATION: 'Техническое задание',
    DESIGN: 'Дизайн',
    DEVELOPMENT: 'Вёрстка / Разработка',
    TESTING: 'Тестирование',
    DEPLOYMENT: 'Развёртывание',
    SUPPORT: 'Техподдержка',
  }
  return labels[type] || type
}

export function getStageColor(type: string): string {
  const colors: Record<string, string> = {
    SPECIFICATION: 'bg-blue-100 text-blue-800',
    DESIGN: 'bg-purple-100 text-purple-800',
    DEVELOPMENT: 'bg-orange-100 text-orange-800',
    TESTING: 'bg-yellow-100 text-yellow-800',
    DEPLOYMENT: 'bg-green-100 text-green-800',
    SUPPORT: 'bg-gray-100 text-gray-800',
  }
  return colors[type] || 'bg-gray-100 text-gray-800'
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-800',
    ACTIVE: 'bg-blue-100 text-blue-800',
    ON_HOLD: 'bg-yellow-100 text-yellow-800',
    COMPLETED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
    PENDING: 'bg-gray-100 text-gray-800',
    IN_PROGRESS: 'bg-blue-100 text-blue-800',
    REVIEW: 'bg-purple-100 text-purple-800',
    APPROVED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
    SENT: 'bg-blue-100 text-blue-800',
    PAID: 'bg-green-100 text-green-800',
    OVERDUE: 'bg-red-100 text-red-800',
    REFUNDED: 'bg-orange-100 text-orange-800',
  }
  return colors[status] || 'bg-gray-100 text-gray-800'
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    DRAFT: 'Черновик',
    ACTIVE: 'Активен',
    ON_HOLD: 'На паузе',
    COMPLETED: 'Завершён',
    CANCELLED: 'Отменён',
    PENDING: 'Ожидает',
    IN_PROGRESS: 'В процессе',
    REVIEW: 'На проверке',
    APPROVED: 'Утверждён',
    REJECTED: 'Отклонён',
    SENT: 'Отправлен',
    PAID: 'Оплачен',
    OVERDUE: 'Просрочен',
    REFUNDED: 'Возвращён',
  }
  return labels[status] || status
}

export function getFileCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    FIGMA: 'Макеты Figma',
    CONTRACT: 'Договоры',
    ACT: 'Акты',
    ARCHIVE: 'Архивы',
    DESIGN: 'Дизайн',
    DOCUMENT: 'Документы',
    OTHER: 'Прочее',
  }
  return labels[category] || category
}

export function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'music'
  if (mimeType === 'application/pdf') return 'file-text'
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) return 'archive'
  if (mimeType.includes('figma') || mimeType.includes('json')) return 'figma'
  return 'file'
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function truncate(text: string, length: number): string {
  if (text.length <= length) return text
  return text.slice(0, length) + '...'
}