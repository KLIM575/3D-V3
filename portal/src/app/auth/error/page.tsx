'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { AlertCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'

function AuthErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  const errorMessages: Record<string, { title: string; description: string }> = {
    Configuration: {
      title: 'Ошибка конфигурации',
      description: 'Проблема с настройками аутентификации. Обратитесь к администратору.',
    },
    AccessDenied: {
      title: 'Доступ запрещён',
      description: 'У вас нет прав для доступа к этой странице.',
    },
    Verification: {
      title: 'Ошибка верификации',
      description: 'Ссылка для входа недействительна или устарела. Запросите новую.',
    },
    OAuthSignin: {
      title: 'Ошибка OAuth',
      description: 'Не удалось войти через внешний провайдер. Попробуйте снова.',
    },
    OAuthCallback: {
      title: 'Ошибка callback',
      description: 'Ошибка при возврате от провайдера. Попробуйте войти снова.',
    },
    OAuthCreateAccount: {
      title: 'Ошибка создания аккаунта',
      description: 'Не удалось создать аккаунт через OAuth. Попробуйте войти с паролем.',
    },
    EmailCreateAccount: {
      title: 'Ошибка создания аккаунта',
      description: 'Не удалось создать аккаунт по email. Попробуйте снова.',
    },
    Callback: {
      title: 'Ошибка обратного вызова',
      description: 'Ошибка при обработке ответа от сервера аутентификации.',
    },
    EmailSignin: {
      title: 'Ошибка отправки email',
      description: 'Не удалось отправить магическую ссылку. Проверьте email и попробуйте снова.',
    },
    CredentialsSignin: {
      title: 'Неверные учётные данные',
      description: 'Проверьте email и пароль и попробуйте снова.',
    },
    SessionRequired: {
      title: 'Требуется вход',
      description: 'Для доступа к этой странице необходимо войти в систему.',
    },
    Default: {
      title: 'Ошибка аутентификации',
      description: 'Произошла неизвестная ошибка. Попробуйте снова или обратитесь в поддержку.',
    },
  }

  const { title, description } = errorMessages[error || 'Default'] || errorMessages.Default

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md card p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="mt-2 text-gray-600">{description}</p>

        <div className="mt-6 flex gap-3">
          <Link
            href="/auth/signin"
            className="btn-primary flex-1"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Попробовать снова
          </Link>
          <Link
            href="/"
            className="btn-secondary flex-1"
          >
            На главную
          </Link>
        </div>

        {error && (
          <details className="mt-6 text-left">
            <summary className="text-sm text-gray-500 cursor-pointer">Детали ошибки</summary>
            <pre className="mt-2 p-3 bg-gray-100 rounded text-xs text-gray-600 overflow-auto">
              {error}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50 px-4"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary-600" /></div>}>
      <AuthErrorContent />
    </Suspense>
  )
}