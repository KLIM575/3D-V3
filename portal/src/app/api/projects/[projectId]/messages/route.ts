import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createMessageSchema = z.object({
  content: z.string().min(1),
  stageId: z.string().optional(),
  type: z.enum(['TEXT', 'FILE', 'SYSTEM']).default('TEXT'),
  metadata: z.any().optional(),
})

const createCommentSchema = z.object({
  content: z.string().min(1),
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

    const { searchParams } = new URL(request.url)
    const stageId = searchParams.get('stageId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: any = { projectId }
    if (stageId) where.stageId = stageId

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        include: {
          author: { select: { id: true, name: true, email: true, image: true, role: true } },
          comments: {
            include: {
              author: { select: { id: true, name: true, email: true, image: true, role: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.message.count({ where }),
    ])

    return NextResponse.json({
      messages: messages.reverse(),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get messages error:', error)
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }
}

export async function POST(
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

    const body = await request.json()
    const data = createMessageSchema.parse(body)

    if (data.stageId) {
      const stage = await prisma.stage.findUnique({
        where: { id: data.stageId },
        select: { projectId: true },
      })
      if (!stage || stage.projectId !== projectId) {
        return NextResponse.json({ error: 'Invalid stage' }, { status: 400 })
      }
    }

    const message = await prisma.message.create({
      data: {
        projectId,
        stageId: data.stageId,
        authorId: session.user.id,
        content: data.content,
        type: data.type,
        metadata: data.metadata,
      },
      include: {
        author: { select: { id: true, name: true, email: true, image: true, role: true } },
        comments: {
          include: {
            author: { select: { id: true, name: true, email: true, image: true, role: true } },
          },
        },
      },
    })

    return NextResponse.json(message, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    console.error('Create message error:', error)
    return NextResponse.json({ error: 'Failed to create message' }, { status: 500 })
  }
}