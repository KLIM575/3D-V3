'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Mail, Lock, User, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react'
import { signIn } from 'next-auth/react'
import { cn } from '@/lib/utils'

const acceptSchema = z.object({
  name: z.string().min(1, 'Имя обязательно').max(100),
  password: z.string().min(8, 'Минимум 8 символов').optional(),
  confirmPassword: z.string().optional(),
}).refine((data) => !data.password || data.password === data.confirmPassword, {
  message: 'Пароли не совпадают',
  path: ['confirmPassword'],
})

type AcceptForm = z.infer<typeof acceptSchema>

function AcceptInvitationContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  // ... rest of component
  const [step, setStep] = useState<'loading' | 'form' | 'success' | 'error'>('loading')
  const [invitation, setInvitation] = useState<{ email: string; projectTitle?: string; role: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AcceptForm>({
    resolver: zodResolver(acceptSchema),
    defaultValues: {
      name: '',
      password: '',
      confirmPassword: '',
    },
  })

  const password = watch('password')

  useEffect(() => {
    if (!token) {
      setStep('error')
      setError('Токен приглашения не найден')
      return
    }

    fetchInvitation()
  }, [token])

  const fetchInvitation = async () => {
    try {
      const res = await fetch(`/api/invitations/accept?token=${token}`)
      if (res.ok) {
        const data = await res.json()
        setInvitation({ email: data.user.email, projectTitle: data.project?.title, role: data.user.role })
        setStep('form')
      } else {
        const err = await res.json()
        setStep('error')
        setError(err.error || 'Недействительное приглашение')
      }
    } catch {
      setStep('error')
      setError('Ошибка при проверке приглашения')
    }
  }

  const onSubmit = async (data: AcceptForm) => {
    try {
      const res = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name: data.name, password: data.password }),
      })

      if (res.ok) {
        setStep('success')
        // Sign in automatically
        setTimeout(() => {
          signIn('credentials', {
            email: invitation?.email,
            password: data.password || undefined,
            callbackUrl: '/dashboard',
            redirect: true,
          })
        }, 1500)
      } else {
        const err = await res.json()
        setError(err.error || 'Ошибка при принятии приглашения')
      }
    } catch {
      setError('Произошла ошибка')
    }
  }

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary-600" />
          <p className="mt-4 text-gray-600">Проверка приглашения...</p>
        </div>
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md card p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Приглашение недействительно</h1>
          <p className="mt-2 text-gray-600">{error}</p>
          <a href="/auth/signin" className="mt-6 inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
            Войти в аккаунт
          </a>
        </div>
      </div>
    )
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md card p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Добро пожаловать!</h1>
          <p className="mt-2 text-gray-600">Приглашение принято. Перенаправляем в личный кабинет...</p>
          <Loader2 className="w-8 h-8 animate-spin mx-auto mt-6 text-primary-600" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-primary-100 rounded-full flex items-center justify-center">
            <Mail className="w-8 h-8 text-primary-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Принять приглашение</h1>
          <p className="mt-2 text-gray-600">
            Вас пригласили в проект <span className="font-medium">{invitation?.projectTitle || 'Client Portal'}</span>
          </p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="name" className="label">
                Ваше имя
              </label>
              <input
                id="name"
                {...register('name')}
                className={cn('input', errors.name && 'input-error')}
                placeholder="Иван Иванов"
                autoFocus
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
            </div>

            <div>
              <label htmlFor="password" className="label">
                Пароль (минимум 8 символов)
              </label>
              <input
                id="password"
                type="password"
                {...register('password')}
                className={cn('input', errors.password && 'input-error')}
                placeholder="••••••••"
              />
              {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>}
            </div>

            {password && (
              <div>
                <label htmlFor="confirmPassword" className="label">
                  Подтвердите пароль
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  {...register('confirmPassword')}
                  className={cn('input', errors.confirmPassword && 'input-error')}
                  placeholder="••••••••"
                />
                {errors.confirmPassword && <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Принять приглашение
                </>
              ) : (
                'Принять приглашение'
              )}
            </button>
          </form>

<p className="mt-6 text-center text-sm text-gray-600">
            Уже есть доступ?{' '}
            <a href="/auth/signin" className="text-primary-600 hover:underline font-medium">
              Войти
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50 px-4"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary-600" /></div>}>
      <AcceptInvitationContent />
    </Suspense>
  )
}