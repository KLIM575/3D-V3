import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { randomUUID } from 'crypto'

const createInvitationSchema = z.object({
  email: z.string().email(),
  role: z.enum(['CLIENT', 'MANAGER', 'DEVELOPER']).default('CLIENT'),
  projectId: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    const where: any = { senderId: session.user.id }
    if (projectId) where.projectId = projectId

    const invitations = await prisma.invitation.findMany({
      where,
      include: {
        project: { select: { id: true, title: true } },
        recipient: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(invitations)
  } catch (error) {
    console.error('Get invitations error:', error)
    return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const data = createInvitationSchema.parse(body)

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    })

    // Check if invitation already exists
    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        email: data.email,
        projectId: data.projectId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    })

    if (existingInvitation) {
      return NextResponse.json({ error: 'Invitation already sent' }, { status: 400 })
    }

    const token = randomUUID()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    const invitation = await prisma.invitation.create({
      data: {
        email: data.email,
        token,
        role: data.role,
        projectId: data.projectId,
        senderId: session.user.id,
        recipientId: existingUser?.id,
        expiresAt,
      },
      include: {
        project: { select: { id: true, title: true } },
        sender: { select: { id: true, name: true, email: true } },
      },
    })

    // Send invitation email
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/accept-invitation?token=${token}`
    console.log(`Invitation sent to ${data.email}: ${inviteUrl}`)

    // In production, send actual email:
    // await sendInvitationEmail(data.email, inviteUrl, invitation.project?.title)

    return NextResponse.json(invitation, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    console.error('Create invitation error:', error)
    return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 })
  }
}