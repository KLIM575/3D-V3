import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

const acceptInvitationSchema = z.object({
  token: z.string(),
  name: z.string().min(1).max(100).optional(),
  password: z.string().min(8).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 })
    }

    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: { project: { select: { id: true, title: true } } },
    })

    if (!invitation) {
      return NextResponse.json({ error: 'Invalid invitation token' }, { status: 404 })
    }

    if (invitation.acceptedAt) {
      return NextResponse.json({ error: 'Invitation already accepted' }, { status: 400 })
    }

    if (invitation.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Invitation expired' }, { status: 400 })
    }

    return NextResponse.json({
      email: invitation.email,
      role: invitation.role,
      project: invitation.project,
    })
  } catch (error) {
    console.error('Check invitation error:', error)
    return NextResponse.json({ error: 'Failed to check invitation' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = acceptInvitationSchema.parse(body)

    const invitation = await prisma.invitation.findUnique({
      where: { token: data.token },
      include: { project: { select: { id: true, title: true } } },
    })

    if (!invitation) {
      return NextResponse.json({ error: 'Invalid invitation token' }, { status: 404 })
    }

    if (invitation.acceptedAt) {
      return NextResponse.json({ error: 'Invitation already accepted' }, { status: 400 })
    }

    if (invitation.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Invitation expired' }, { status: 400 })
    }

    // Check if user is already logged in
    const session = await getServerSession(authOptions)
    let user = session?.user ? await prisma.user.findUnique({ where: { id: session.user.id } }) : null

    if (!user) {
      // Create new user or find existing by email
      user = await prisma.user.findUnique({ where: { email: invitation.email } })

      if (!user) {
        const passwordHash = data.password ? await bcrypt.hash(data.password, 12) : null
        user = await prisma.user.create({
          data: {
            email: invitation.email,
            name: data.name || invitation.email.split('@')[0],
            passwordHash,
            role: invitation.role,
            emailVerified: new Date(),
          },
        })
      } else if (invitation.role !== 'CLIENT' && user.role === 'CLIENT') {
        // Upgrade role if needed
        user = await prisma.user.update({
          where: { id: user.id },
          data: { role: invitation.role },
        })
      }
    }

    // Accept invitation
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date(), recipientId: user.id },
    })

    // If project invitation, add user to project
    if (invitation.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: invitation.projectId },
      })

      if (project) {
        const updateData: any = {}
        if (invitation.role === 'CLIENT' && !project.clientId) updateData.clientId = user.id
        if (invitation.role === 'MANAGER' && !project.managerId) updateData.managerId = user.id
        if (invitation.role === 'DEVELOPER' && !project.developerId) updateData.developerId = user.id

        if (Object.keys(updateData).length > 0) {
          await prisma.project.update({
            where: { id: invitation.projectId },
            data: updateData,
          })
        }
      }
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      project: invitation.project,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    console.error('Accept invitation error:', error)
    return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 })
  }
}