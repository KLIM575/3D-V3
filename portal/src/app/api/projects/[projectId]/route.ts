import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateProjectSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).optional(),
  managerId: z.string().optional().nullable(),
  developerId: z.string().optional().nullable(),
  budget: z.number().positive().optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
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

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        client: { select: { id: true, name: true, email: true, image: true } },
        manager: { select: { id: true, name: true, email: true, image: true } },
        developer: { select: { id: true, name: true, email: true, image: true } },
        stages: {
          include: {
            tasks: { orderBy: { order: 'asc' } },
          },
          orderBy: { order: 'asc' },
        },
        messages: {
          take: 50,
          orderBy: { createdAt: 'desc' },
          include: {
            author: { select: { id: true, name: true, email: true, image: true, role: true } },
            comments: {
              include: {
                author: { select: { id: true, name: true, email: true, image: true, role: true } },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
        files: {
          orderBy: { createdAt: 'desc' },
          include: {
            uploader: { select: { id: true, name: true, email: true, image: true } },
          },
        },
        invoices: {
          orderBy: { createdAt: 'desc' },
          include: { payments: true },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json(project)
  } catch (error) {
    console.error('Get project error:', error)
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 })
  }
}

export async function PUT(
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
    const data = updateProjectSchema.parse(body)

    const project = await prisma.project.update({
      where: { id: projectId },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
      include: {
        client: { select: { id: true, name: true, email: true, image: true } },
        manager: { select: { id: true, name: true, email: true, image: true } },
        developer: { select: { id: true, name: true, email: true, image: true } },
        stages: {
          include: { tasks: { orderBy: { order: 'asc' } } },
          orderBy: { order: 'asc' },
        },
      },
    })

    return NextResponse.json(project)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    console.error('Update project error:', error)
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { projectId } = await params
    await prisma.project.delete({ where: { id: projectId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete project error:', error)
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 })
  }
}