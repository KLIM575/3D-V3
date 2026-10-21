import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const requestSchema = z.object({
  email: z.string().email(),
  message: z.string().min(10).max(500),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = requestSchema.parse(body)

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    })

    if (existingUser) {
      return NextResponse.json({ error: 'Пользователь с таким email уже зарегистрирован' }, { status: 400 })
    }

    // Check for existing pending request
    const existingRequest = await prisma.invitation.findFirst({
      where: {
        email: data.email,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    })

    if (existingRequest) {
      return NextResponse.json({ error: 'Запрос уже отправлен, ожидайте ответа' }, { status: 400 })
    }

    // Create invitation request (without sender - it's a self-request)
    // In production, you might want to notify admins via email/Slack
    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

    await prisma.invitation.create({
      data: {
        email: data.email,
        token,
        role: 'CLIENT',
        senderId: 'system', // This would need a system user or nullable senderId
        expiresAt,
        // Store the message in metadata or a separate field
      },
    })

    // In production, send notification to admins:
    // await notifyAdmins(data.email, data.message)

    console.log(`Access request from ${data.email}: ${data.message}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    console.error('Request access error:', error)
    return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 })
  }
}