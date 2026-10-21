'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Loader2, User, Mail, Lock, Bell, Shield, CheckCircle, AlertCircle } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { cn } from '@/lib/utils'

const profileSchema = z.object({
  name: z.string().min(1, 'Имя обязательно').max(100),
  email: z.string().email('Неверный формат email'),
})

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Введите текущий пароль'),
  newPassword: z.string().min(8, 'Минимум 8 символов'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Пароли не совпадают',
  path: ['confirmPassword'],
})

type ProfileForm = z.infer<typeof profileSchema>
type PasswordForm = z.infer<typeof passwordSchema>

export default function SettingsPage() {
  const { data: session, update } = useSession()
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications'>('profile')
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: session?.user?.name || '',
      email: session?.user?.email || '',
    },
  })

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  })

  const handleProfileSubmit = async (data: ProfileForm) => {
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        await update()
        setProfileMessage({ type: 'success', text: 'Профиль обновлён' })
      } else {
        const error = await res.json()
        setProfileMessage({ type: 'error', text: error.error || 'Ошибка обновления' })
      }
    } catch {
      setProfileMessage({ type: 'error', text: 'Произошла ошибка' })
    }
  }

  const handlePasswordSubmit = async (data: PasswordForm) => {
    try {
      const res = await fetch('/api/user/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        }),
      })
      if (res.ok) {
        setPasswordMessage({ type: 'success', text: 'Пароль изменён' })
        passwordForm.reset()
      } else {
        const error = await res.json()
        setPasswordMessage({ type: 'error', text: error.error || 'Ошибка смены пароля' })
      }
    } catch {
      setPasswordMessage({ type: 'error', text: 'Произошла ошибка' })
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Настройки</h1>
        <p className="text-gray-600">Управляйте своим профилем и предпочтениями</p>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="border-b border-gray-100">
          <nav className="flex gap-1 px-4" aria-label="Settings tabs">
            <button
              onClick={() => setActiveTab('profile')}
              className={cn(
                'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === 'profile'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              <User className="w-4 h-4 mr-2 inline" />
              Профиль
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={cn(
                'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === 'security'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              <Shield className="w-4 h-4 mr-2 inline" />
              Безопасность
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={cn(
                'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === 'notifications'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              <Bell className="w-4 h-4 mr-2 inline" />
              Уведомления
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'profile' && <ProfileTab form={profileForm} onSubmit={handleProfileSubmit} message={profileMessage} />}
          {activeTab === 'security' && <SecurityTab form={passwordForm} onSubmit={handlePasswordSubmit} message={passwordMessage} />}
          {activeTab === 'notifications' && <NotificationsTab />}
        </div>
      </div>
    </div>
  )
}

function ProfileTab({ form, onSubmit, message }: { form: any; onSubmit: (data: any) => void; message: any }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = form

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {message && (
        <div className={cn(
          'p-4 rounded-lg flex items-center gap-3',
          message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        )}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{message.text}</span>
        </div>
      )}

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Личная информация</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="label">Имя</label>
            <input
              id="name"
              {...register('name')}
              className={cn('input', errors.name && 'input-error')}
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
          </div>
          <div>
            <label htmlFor="email" className="label">Email</label>
            <input
              id="email"
              type="email"
              {...register('email')}
              className={cn('input', errors.email && 'input-error')}
            />
            {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
          </div>
        </div>
      </div>

      <button type="submit" disabled={isSubmitting} className="btn-primary">
        {isSubmitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Сохранение...
          </>
        ) : (
          'Сохранить изменения'
        )}
      </button>
    </form>
  )
}

function SecurityTab({ form, onSubmit, message }: { form: any; onSubmit: (data: any) => void; message: any }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = form

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {message && (
        <div className={cn(
          'p-4 rounded-lg flex items-center gap-3',
          message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        )}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{message.text}</span>
        </div>
      )}

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Смена пароля</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="currentPassword" className="label">Текущий пароль</label>
            <input
              id="currentPassword"
              type="password"
              {...register('currentPassword')}
              className={cn('input', errors.currentPassword && 'input-error')}
            />
            {errors.currentPassword && <p className="mt-1 text-sm text-red-600">{errors.currentPassword.message}</p>}
          </div>
          <div>
            <label htmlFor="newPassword" className="label">Новый пароль</label>
            <input
              id="newPassword"
              type="password"
              {...register('newPassword')}
              className={cn('input', errors.newPassword && 'input-error')}
            />
            {errors.newPassword && <p className="mt-1 text-sm text-red-600">{errors.newPassword.message}</p>}
          </div>
          <div>
            <label htmlFor="confirmPassword" className="label">Подтвердите новый пароль</label>
            <input
              id="confirmPassword"
              type="password"
              {...register('confirmPassword')}
              className={cn('input', errors.confirmPassword && 'input-error')}
            />
            {errors.confirmPassword && <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>}
          </div>
        </div>
      </div>

      <div className="p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-2">Рекомендации по безопасности</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Используйте уникальный пароль минимум 12 символов</li>
          <li>• Включите двухфакторную аутентификацию (скоро)</li>
          <li>• Не делитесь паролем с посторонними</li>
        </ul>
      </div>

      <button type="submit" disabled={isSubmitting} className="btn-primary">
        {isSubmitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Сменить пароль
          </>
        ) : (
          'Сменить пароль'
        )}
      </button>
    </form>
  )
}

function NotificationsTab() {
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    projectUpdates: true,
    messages: true,
    billing: true,
    weeklyDigest: false,
  })

  const handleChange = (key: string, value: boolean) => {
    setNotifications((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Email уведомления</h3>
        <div className="space-y-4">
          {[
            { key: 'email', label: 'Все уведомления по email', description: 'Получать все уведомления на почту' },
            { key: 'projectUpdates', label: 'Обновления проектов', description: 'Изменения статусов, новые этапы, задачи' },
            { key: 'messages', label: 'Новые сообщения', description: 'Когда вам пишут в чате проекта' },
            { key: 'billing', label: 'Биллинг и платежи', description: 'Счета, напоминания об оплате, квитанции' },
            { key: 'weeklyDigest', label: 'Еженедельный дайджест', description: 'Сводка по проектам за неделю' },
          ].map(({ key, ...item }) => (
            <NotificationToggle key={key} {...item} onChange={handleChange} checked={notifications[key as keyof typeof notifications]} />
          ))}
        </div>
      </div>

      <div className="p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-2">Push уведомления</h4>
        <p className="text-sm text-gray-600 mb-4">Получайте уведомления в браузере в реальном времени</p>
        <NotificationToggle
          key="push"
          label="Push уведомления"
          description="Работают когда вкладка закрыта"
          checked={notifications.push}
          onChange={handleChange}
        />
      </div>
    </div>
  )
}

function NotificationToggle({ key, label, description, checked, onChange }: { key: string; label: string; description: string; checked: boolean; onChange: (key: string, value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium text-gray-900">{label}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(key, !checked)}
        className={cn(
          'relative w-11 h-6 rounded-full transition-colors',
          checked ? 'bg-primary-600' : 'bg-gray-300'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0.5'
          )}
        />
      </button>
    </div>
  )
}