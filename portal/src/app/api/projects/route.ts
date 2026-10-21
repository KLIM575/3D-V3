import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createProjectSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  clientId: z.string().optional(),
  managerId: z.string().optional(),
  developerId: z.string().optional(),
  budget: z.number().positive().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})

const updateProjectSchema = createProjectSchema.partial()

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    const where: any = {}

    // Role-based filtering
    if (session.user.role === 'CLIENT') {
      where.clientId = session.user.id
    } else if (session.user.role === 'MANAGER') {
      where.managerId = session.user.id
    } else if (session.user.role === 'DEVELOPER') {
      where.developerId = session.user.id
    }

    if (status) {
      where.status = status
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
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
          _count: { select: { messages: true, files: true, invoices: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.project.count({ where }),
    ])

    return NextResponse.json({
      projects,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get projects error:', error)
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const data = createProjectSchema.parse(body)

    const clientId = data.clientId || session.user.id

    const project = await prisma.project.create({
      data: {
        title: data.title,
        description: data.description,
        clientId,
        managerId: data.managerId,
        developerId: data.developerId,
        budget: data.budget,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        status: 'DRAFT',
      },
      include: {
        client: { select: { id: true, name: true, email: true, image: true } },
        manager: { select: { id: true, name: true, email: true, image: true } },
        developer: { select: { id: true, name: true, email: true, image: true } },
        stages: {
          include: { tasks: true },
          orderBy: { order: 'asc' },
        },
      },
    })

    // Create default stages
    const defaultStages = [
      { type: 'SPECIFICATION', title: 'Техническое задание', order: 0 },
      { type: 'DESIGN', title: 'Дизайн', order: 1 },
      { type: 'DEVELOPMENT', title: 'Вёрстка / Разработка', order: 2 },
      { type: 'TESTING', title: 'Тестирование', order: 3 },
      { type: 'DEPLOYMENT', title: 'Развёртывание', order: 4 },
      { type: 'SUPPORT', title: 'Техподдержка', order: 5 },
    ]

    await prisma.stage.createMany({
      data: defaultStages.map((stage) => ({
        projectId: project.id,
        type: stage.type as any,
        title: stage.title,
        order: stage.order,
        status: 'PENDING',
      })),
    })

    // Fetch project with stages
    const projectWithStages = await prisma.project.findUnique({
      where: { id: project.id },
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

    return NextResponse.json(projectWithStages, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    console.error('Create project error:', error)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}