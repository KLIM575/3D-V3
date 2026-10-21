import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  order: z.number().int().optional(),
  completed: z.boolean().optional(),
})

async function checkTaskAccess(taskId: string, userId: string, userRole: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { stage: { include: { project: { select: { clientId: true, managerId: true, developerId: true } } } } },
  })

  if (!task) return false

  if (userRole === 'ADMIN') return true
  if (userRole === 'CLIENT' && task.stage.project.clientId === userId) return true
  if (userRole === 'MANAGER' && task.stage.project.managerId === userId) return true
  if (userRole === 'DEVELOPER' && task.stage.project.developerId === userId) return true

  return false
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const hasAccess = await checkTaskAccess(id, session.user.id, session.user.role)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const data = updateTaskSchema.parse(body)

    const updateData: any = { ...data }
    if (data.completed === true && !updateData.completedAt) {
      updateData.completedAt = new Date()
    } else if (data.completed === false) {
      updateData.completedAt = null
    }

    const task = await prisma.task.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(task)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    console.error('Update task error:', error)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const hasAccess = await checkTaskAccess(id, session.user.id, session.user.role)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.task.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete task error:', error)
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
  }
}