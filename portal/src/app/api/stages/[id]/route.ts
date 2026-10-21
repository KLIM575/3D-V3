import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateStageSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED']).optional(),
  order: z.number().int().optional(),
  startDate: z.string().datetime().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
})

const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional().nullable(),
})

const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  order: z.number().int().optional(),
  completed: z.boolean().optional(),
})

async function checkStageAccess(stageId: string, userId: string, userRole: string) {
  const stage = await prisma.stage.findUnique({
    where: { id: stageId },
    include: { project: { select: { clientId: true, managerId: true, developerId: true } } },
  })

  if (!stage) return false

  if (userRole === 'ADMIN') return true
  if (userRole === 'CLIENT' && stage.project.clientId === userId) return true
  if (userRole === 'MANAGER' && stage.project.managerId === userId) return true
  if (userRole === 'DEVELOPER' && stage.project.developerId === userId) return true

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
    const hasAccess = await checkStageAccess(id, session.user.id, session.user.role)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const stage = await prisma.stage.findUnique({
      where: { id },
      include: {
        tasks: { orderBy: { order: 'asc' } },
        project: {
          select: {
            id: true,
            title: true,
            clientId: true,
            managerId: true,
            developerId: true,
          },
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
      },
    })

    if (!stage) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 })
    }

    return NextResponse.json(stage)
  } catch (error) {
    console.error('Get stage error:', error)
    return NextResponse.json({ error: 'Failed to fetch stage' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || !['ADMIN', 'MANAGER', 'DEVELOPER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const hasAccess = await checkStageAccess(id, session.user.id, session.user.role)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const data = updateStageSchema.parse(body)

    const updateData: any = { ...data }
    if (data.startDate) updateData.startDate = new Date(data.startDate)
    if (data.dueDate) updateData.dueDate = new Date(data.dueDate)
    if (data.status === 'COMPLETED' && !updateData.completedAt) {
      updateData.completedAt = new Date()
    }

    const stage = await prisma.stage.update({
      where: { id },
      data: updateData,
      include: { tasks: { orderBy: { order: 'asc' } } },
    })

    return NextResponse.json(stage)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    console.error('Update stage error:', error)
    return NextResponse.json({ error: 'Failed to update stage' }, { status: 500 })
  }
}

export async function POST(
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
    const data = createTaskSchema.parse(body)

    const maxOrder = await prisma.task.aggregate({
      where: { stageId: id },
      _max: { order: true },
    })

    const task = await prisma.task.create({
      data: {
        stageId: id,
        title: data.title,
        description: data.description,
        order: (maxOrder._max.order || -1) + 1,
      },
    })

    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    console.error('Create task error:', error)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}