import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { createPaymentIntent, createCheckoutSession } from '@/lib/stripe'

const updateInvoiceSchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED']).optional(),
  description: z.string().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
})

async function checkInvoiceAccess(invoiceId: string, userId: string, userRole: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { project: { select: { clientId: true, managerId: true, developerId: true } } },
  })

  if (!invoice) return false

  if (userRole === 'ADMIN') return true
  if (userRole === 'CLIENT' && invoice.project.clientId === userId) return true
  if (userRole === 'MANAGER' && invoice.project.managerId === userId) return true
  if (userRole === 'DEVELOPER' && invoice.project.developerId === userId) return true

  return false
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const hasAccess = await checkInvoiceAccess(id, session.user.id, session.user.role)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        payments: true,
        project: { select: { id: true, title: true, clientId: true } },
        client: { select: { id: true, name: true, email: true } },
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    return NextResponse.json(invoice)
  } catch (error) {
    console.error('Get invoice error:', error)
    return NextResponse.json({ error: 'Failed to fetch invoice' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const data = updateInvoiceSchema.parse(body)

    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        paidAt: data.status === 'PAID' ? new Date() : undefined,
      },
      include: { payments: true },
    })

    return NextResponse.json(invoice)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    console.error('Update invoice error:', error)
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    const hasAccess = await checkInvoiceAccess(id, session.user.id, session.user.role)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { project: { select: { title: true } }, client: { select: { email: true, name: true } } },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    if (action === 'create_payment_intent') {
      if (invoice.status !== 'DRAFT' && invoice.status !== 'SENT') {
        return NextResponse.json({ error: 'Invoice cannot be paid' }, { status: 400 })
      }

      const paymentIntent = await createPaymentIntent(
        Number(invoice.amount),
        invoice.currency,
        {
          invoiceId: invoice.id,
          invoiceNumber: invoice.number,
          projectId: invoice.projectId,
          projectTitle: invoice.project.title,
        }
      )

      await prisma.invoice.update({
        where: { id },
        data: { providerId: paymentIntent.id, status: 'SENT' },
      })

      return NextResponse.json({ clientSecret: paymentIntent.client_secret })
    }

    if (action === 'create_checkout_session') {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
      const session = await createCheckoutSession(
        Number(invoice.amount),
        invoice.currency,
        `${baseUrl}/dashboard/billing?success=true&invoice=${invoice.id}`,
        `${baseUrl}/dashboard/billing?canceled=true&invoice=${invoice.id}`,
        {
          invoiceId: invoice.id,
          invoiceNumber: invoice.number,
          projectId: invoice.projectId,
          projectTitle: invoice.project.title,
          description: invoice.description || '',
        }
      )

      await prisma.invoice.update({
        where: { id },
        data: { providerId: session.id, status: 'SENT' },
      })

      return NextResponse.json({ url: session.url })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Invoice action error:', error)
    return NextResponse.json({ error: 'Failed to process invoice action' }, { status: 500 })
  }
}