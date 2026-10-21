import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createCommentSchema = z.object({
  content: z.string().min(1),
})

async function checkMessageAccess(messageId: string, userId: string, userRole: string) {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { project: { select: { clientId: true, managerId: true, developerId: true } } },
  })

  if (!message) return false

  if (userRole === 'ADMIN') return true
  if (userRole === 'CLIENT' && message.project.clientId === userId) return true
  if (userRole === 'MANAGER' && message.project.managerId === userId) return true
  if (userRole === 'DEVELOPER' && message.project.developerId === userId) return true

  return false
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { messageId } = await params
    const hasAccess = await checkMessageAccess(messageId, session.user.id, session.user.role)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const data = createCommentSchema.parse(body)

    const comment = await prisma.comment.create({
      data: {
        messageId,
        authorId: session.user.id,
        content: data.content,
      },
      include: {
        author: { select: { id: true, name: true, email: true, image: true, role: true } },
      },
    })

    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    console.error('Create comment error:', error)
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 })
  }
}