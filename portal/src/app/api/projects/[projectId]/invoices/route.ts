import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { generateInvoiceNumber } from '@/lib/utils'
import { createPaymentIntent } from '@/lib/stripe'

const createInvoiceSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().default('RUB'),
  description: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  stageId: z.string().optional(),
})

async function checkProjectAccess(projectId: string, userId: string, userRole: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { clientId: true, managerId: true, developerId: true },
  })

  if (!project) return false

  if (userRole === 'ADMIN') return true
  if (userRole === 'CLIENT' && project.clientId === userId) return true
  if (userRole === 'MANAGER' && project.managerId === userId) return true
  if (userRole === 'DEVELOPER' && project.developerId === userId) return true

  return false
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { projectId } = await params
    const hasAccess = await checkProjectAccess(projectId, session.user.id, session.user.role)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const invoices = await prisma.invoice.findMany({
      where: { projectId },
      include: {
        payments: true,
        project: { select: { title: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(invoices)
  } catch (error) {
    console.error('Get invoices error:', error)
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { projectId } = await params
    const body = await request.json()
    const data = createInvoiceSchema.parse(body)

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { client: { select: { id: true, email: true, name: true } } },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const invoice = await prisma.invoice.create({
      data: {
        projectId,
        clientId: project.clientId,
        number: generateInvoiceNumber(),
        amount: data.amount,
        currency: data.currency,
        description: data.description,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        status: 'DRAFT',
        provider: 'STRIPE',
      },
      include: { payments: true },
    })

    return NextResponse.json(invoice, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    console.error('Create invoice error:', error)
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 })
  }
}