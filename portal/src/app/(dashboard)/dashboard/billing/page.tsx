'use client'

import { useState, useEffect, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { CreditCard, Loader2, CheckCircle, AlertCircle, Clock, XCircle, DollarSign, Download, RefreshCw, MoreVertical } from 'lucide-react'
import { cn, formatCurrency, formatDate, getStatusLabel, getStatusColor } from '@/lib/utils'

interface Invoice {
  id: string
  number: string
  amount: number
  currency: string
  status: string
  provider: string
  providerId: string | null
  description: string | null
  dueDate: string | null
  paidAt: string | null
  createdAt: string
  payments: Payment[]
  project: { title: string }
}

interface Payment {
  id: string
  amount: number
  currency: string
  provider: string
  providerId: string
  status: string
  createdAt: string
}

function BillingContent() {
  const params = useParams()
  const projectId = params.projectId as string
  const searchParams = useSearchParams()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [payingInvoice, setPayingInvoice] = useState<string | null>(null)
  const success = searchParams.get('success')
  const canceled = searchParams.get('canceled')

  useEffect(() => {
    if (success) {
      alert('Оплата прошла успешно!')
    }
    if (canceled) {
      alert('Оплата отменена')
    }
  }, [success, canceled])

  const fetchInvoices = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/invoices`)
      if (res.ok) {
        const data = await res.json()
        setInvoices(data)
      }
    } catch (error) {
      console.error('Failed to fetch invoices:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchInvoices()
  }, [projectId])

  const handlePay = async (invoice: Invoice) => {
    setPayingInvoice(invoice.id)
    try {
      const res = await fetch(`/api/invoices/${invoice.id}?action=create_checkout_session`, {
        method: 'POST',
      })
      if (res.ok) {
        const data = await res.json()
        if (data.url) {
          window.location.href = data.url
        }
      } else {
        const error = await res.json()
        alert(error.error || 'Ошибка при создании платежа')
      }
    } catch (error) {
      console.error('Payment error:', error)
      alert('Произошла ошибка при оплате')
    } finally {
      setPayingInvoice(null)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PAID':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'OVERDUE':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      case 'SENT':
        return <Clock className="w-5 h-5 text-blue-500" />
      case 'CANCELLED':
        return <XCircle className="w-5 h-5 text-gray-500" />
      case 'REFUNDED':
        return <RefreshCw className="w-5 h-5 text-orange-500" />
      default:
        return <DollarSign className="w-5 h-5 text-gray-500" />
    }
  }

  const isOverdue = (dueDate: string | null, status: string) => {
    if (!dueDate || status === 'PAID') return false
    return new Date(dueDate) < new Date()
  }

  if (isLoading) {
    return (
      <div className="card p-8 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary-600" />
      </div>
    )
  }

  const totalAmount = invoices.reduce((sum, inv) => sum + Number(inv.amount), 0)
  const paidAmount = invoices.filter((inv) => inv.status === 'PAID').reduce((sum, inv) => sum + Number(inv.amount), 0)
  const pendingAmount = invoices.filter((inv) => inv.status !== 'PAID' && inv.status !== 'CANCELLED').reduce((sum, inv) => sum + Number(inv.amount), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Биллинг</h1>
          <p className="text-gray-600">Управляйте счетами и платежами</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Всего к оплате" value={formatCurrency(totalAmount)} icon={<DollarSign className="w-6 h-6" />} color="blue" />
        <StatCard title="Оплачено" value={formatCurrency(paidAmount)} icon={<CheckCircle className="w-6 h-6" />} color="green" />
        <StatCard title="Ожидает оплаты" value={formatCurrency(pendingAmount)} icon={<Clock className="w-6 h-6" />} color="yellow" />
      </div>

      {/* Invoices list */}
      <div className="card divide-y divide-gray-100">
        <div className="px-6 py-4 bg-gray-50 font-medium text-gray-900">
          Счета ({invoices.length})
        </div>

        {invoices.length === 0 ? (
          <div className="p-12 text-center">
            <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-lg font-medium text-gray-900">Счетов пока нет</h3>
            <p className="mt-1 text-gray-500">Счета появятся здесь после выставления менеджером</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {invoices.map((invoice) => (
              <InvoiceRow
                key={invoice.id}
                invoice={invoice}
                onPay={handlePay}
                paying={payingInvoice === invoice.id}
                isOverdue={isOverdue(invoice.dueDate, invoice.status)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ title, value, icon, color }: { title: string; value: string; icon: React.ReactNode; color: string }) {
  const colors = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={cn('p-3 rounded-xl', colors[color as keyof typeof colors] || 'bg-gray-500')}>
          {icon}
        </div>
      </div>
    </div>
  )
}

function InvoiceRow({ invoice, onPay, paying, isOverdue }: { invoice: Invoice; onPay: (invoice: Invoice) => void; paying: boolean; isOverdue: boolean }) {
  const [showDetails, setShowDetails] = useState(false)

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-800',
    SENT: 'bg-blue-100 text-blue-800',
    PAID: 'bg-green-100 text-green-800',
    OVERDUE: 'bg-red-100 text-red-800',
    CANCELLED: 'bg-gray-100 text-gray-600',
    REFUNDED: 'bg-orange-100 text-orange-800',
  }

  return (
    <div className="p-4 hover:bg-gray-50 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-gray-100 rounded-lg">
            <DollarSign className="w-5 h-5 text-gray-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900">{invoice.number}</span>
              <span className={cn('badge', statusColors[invoice.status])}>
                {getStatusLabel(invoice.status)}
              </span>
              {isOverdue && (
                <span className="badge bg-red-100 text-red-700">Просрочен</span>
              )}
            </div>
            <p className="text-sm text-gray-500">{invoice.project.title} • {formatDate(invoice.createdAt)}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right sm:hidden">
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(invoice.amount)}</p>
          </div>

          <div className="hidden sm:block text-right w-32">
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(invoice.amount)}</p>
          </div>

          {invoice.dueDate && (
            <div className="hidden sm:block text-right w-32">
              <p className="text-sm text-gray-500">Срок оплаты</p>
              <p className={cn('font-medium', isOverdue && 'text-red-600')}>
                {formatDate(invoice.dueDate)}
              </p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {['DRAFT', 'SENT', 'OVERDUE'].includes(invoice.status) && (
              <button
                onClick={() => onPay(invoice)}
                disabled={paying}
                className="btn-primary text-sm"
              >
                {paying ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Оплатить'
                )}
              </button>
            )}

            {invoice.status === 'PAID' && (
              <a
                href={`/api/invoices/${invoice.id}/download`}
                className="btn-outline p-2"
              >
                <Download className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      </div>

      {showDetails && (
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
          {invoice.description && (
            <p className="text-sm text-gray-600">{invoice.description}</p>
          )}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Валюта</p>
              <p className="font-medium">{invoice.currency}</p>
            </div>
            <div>
              <p className="text-gray-500">Провайдер</p>
              <p className="font-medium capitalize">{invoice.provider.toLowerCase()}</p>
            </div>
            {invoice.paidAt && (
              <div>
                <p className="text-gray-500">Дата оплаты</p>
                <p className="font-medium">{formatDate(invoice.paidAt)}</p>
              </div>
            )}
            {invoice.providerId && (
              <div>
                <p className="text-gray-500">ID транзакции</p>
                <p className="font-medium text-xs">{invoice.providerId}</p>
              </div>
            )}
          </div>

          {invoice.payments.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-900 mb-2">Платежи</p>
              <div className="space-y-2">
                {invoice.payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">{formatCurrency(payment.amount)}</p>
                      <p className="text-xs text-gray-500">{formatDate(payment.createdAt)}</p>
                    </div>
                    <span className={cn('badge text-xs', payment.status === 'succeeded' && 'bg-green-100 text-green-700')}>
                      {payment.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="card p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary-600" /></div>}>
      <BillingContent />
    </Suspense>
  )
}