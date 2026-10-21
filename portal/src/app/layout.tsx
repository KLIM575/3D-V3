import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Client Portal | Личный кабинет клиента',
  description: 'Функциональный личный кабинет для управления проектами, чатом, файлами и биллингом',
  keywords: ['личный кабинет', 'управление проектами', 'Канбан', ' Биллинг', 'чат'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru" className={inter.variable}>
      <body className="min-h-screen bg-gray-50 font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}