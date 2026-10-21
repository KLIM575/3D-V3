'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Mail, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

const requestSchema = z.object({
  email: z.string().email('Неверный формат email'),
  message: z.string().min(10, 'Опишите, зачем вам нужен доступ (минимум 10 символов)').max(500),
})

type RequestForm = z.infer<typeof requestSchema>

export default function RequestAccessPage() {
  const [step, setStep] = useState<'form' | 'success' | 'error'>('form')
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<RequestForm>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      email: '',
      message: '',
    },
  })

  const onSubmit = async (data: RequestForm) => {
    try {
      const res = await fetch('/api/auth/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (res.ok) {
        setStep('success')
        reset()
      } else {
        const err = await res.json()
        setStep('error')
        setError(err.error || 'Ошибка при отправке запроса')
      }
    } catch {
      setStep('error')
      setError('Произошла ошибка. Попробуйте снова.')
    }
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md card p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Запрос отправлен!</h1>
          <p className="mt-2 text-gray-600">
            Мы рассмотрим вашу заявку и отправим приглашение на email, если она будет одобрена.
          </p>
          <Link href="/auth/signin" className="mt-6 inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Вернуться к входу
          </Link>
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
          <h1 className="text-2xl font-bold text-gray-900">Ошибка</h1>
          <p className="mt-2 text-gray-600">{error}</p>
          <button
            onClick={() => setStep('form')}
            className="mt-6 inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Попробовать снова
          </button>
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
          <h1 className="text-2xl font-bold text-gray-900">Запросить доступ</h1>
          <p className="mt-2 text-gray-600">
            Заполните форму, и администратор рассмотрит вашу заявку
          </p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="email" className="label">
                Email
              </label>
              <input
                id="email"
                type="email"
                {...register('email')}
                className={cn('input', errors.email && 'input-error')}
                placeholder="you@example.com"
                autoFocus
              />
              {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
            </div>

            <div>
              <label htmlFor="message" className="label">
                Зачем вам нужен доступ?
              </label>
              <textarea
                id="message"
                {...register('message')}
                rows={4}
                className={cn('input', errors.message && 'input-error')}
                placeholder="Например: Я клиент студии, хочу следить за прогрессом своего проекта..."
              />
              {errors.message && <p className="mt-1 text-sm text-red-600">{errors.message.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Отправить запрос
                </>
              ) : (
                'Отправить запрос'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            Уже есть доступ?{' '}
            <Link href="/auth/signin" className="text-primary-600 hover:underline font-medium">
              Войти
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}