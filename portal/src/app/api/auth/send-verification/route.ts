import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { email, url, host } = await request.json()

    if (!email || !url) {
      return NextResponse.json({ error: 'Missing email or url' }, { status: 400 })
    }

    // In production, integrate with your email service (Resend, SendGrid, etc.)
    // For now, we'll log the magic link
    console.log(`Magic link for ${email}: ${url}`)

    // Example with Resend:
    // const resend = new Resend(process.env.RESEND_API_KEY)
    // await resend.emails.send({
    //   from: process.env.EMAIL_FROM!,
    //   to: email,
    //   subject: 'Вход в личный кабинет',
    //   html: `
    //     <p>Нажмите на ссылку для входа:</p>
    //     <a href="${url}">${url}</a>
    //     <p>Ссылка действительна 24 часа.</p>
    //   `,
    // })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Send verification error:', error)
    return NextResponse.json({ error: 'Failed to send verification email' }, { status: 500 })
  }
}