import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { stripe, constructWebhookEvent } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const headersList = await headers()
    const signature = headersList.get('stripe-signature')

    if (!signature) {
      return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
    }

    let event
    try {
      event = constructWebhookEvent(body, signature)
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object
        await handlePaymentSuccess(paymentIntent)
        break
      }
      case 'checkout.session.completed': {
        const session = event.data.object
        await handleCheckoutSuccess(session)
        break
      }
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object
        await handlePaymentFailed(paymentIntent)
        break
      }
      case 'charge.refunded': {
        const charge = event.data.object
        await handleRefund(charge)
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}

async function handlePaymentSuccess(paymentIntent: any) {
  const invoiceId = paymentIntent.metadata.invoiceId
  if (!invoiceId) return

  await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } })
    if (!invoice) return

    await tx.payment.create({
      data: {
        invoiceId,
        amount: Number(invoice.amount),
        currency: invoice.currency,
        provider: 'STRIPE',
        providerId: paymentIntent.id,
        status: 'succeeded',
        metadata: paymentIntent.metadata,
      },
    })

    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        providerId: paymentIntent.id,
      },
    })

    // Create system message in project
    await tx.message.create({
      data: {
        projectId: invoice.projectId,
        authorId: invoice.clientId,
        content: `Счёт №${invoice.number} на сумму ${Number(invoice.amount).toLocaleString()} ${invoice.currency} оплачен.`,
        type: 'SYSTEM',
        metadata: { invoiceId, paymentIntentId: paymentIntent.id },
      },
    })
  })
}

async function handleCheckoutSuccess(session: any) {
  const invoiceId = session.metadata?.invoiceId
  if (!invoiceId) return

  await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } })
    if (!invoice) return

    await tx.payment.create({
      data: {
        invoiceId,
        amount: Number(invoice.amount),
        currency: invoice.currency,
        provider: 'STRIPE',
        providerId: session.payment_intent as string,
        status: 'succeeded',
        metadata: session.metadata,
      },
    })

    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        providerId: session.payment_intent as string,
      },
    })

    await tx.message.create({
      data: {
        projectId: invoice.projectId,
        authorId: invoice.clientId,
        content: `Счёт №${invoice.number} на сумму ${Number(invoice.amount).toLocaleString()} ${invoice.currency} оплачен через Stripe Checkout.`,
        type: 'SYSTEM',
        metadata: { invoiceId, sessionId: session.id },
      },
    })
  })
}

async function handlePaymentFailed(paymentIntent: any) {
  const invoiceId = paymentIntent.metadata.invoiceId
  if (!invoiceId) return

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: 'OVERDUE' },
  })

  await prisma.message.create({
    data: {
      projectId: paymentIntent.metadata.projectId,
      authorId: paymentIntent.metadata.clientId || 'system',
      content: `Оплата счёта №${paymentIntent.metadata.invoiceNumber} не удалась. Пожалуйста, попробуйте снова.`,
      type: 'SYSTEM',
      metadata: { invoiceId, paymentIntentId: paymentIntent.id },
    },
  })
}

async function handleRefund(charge: any) {
  const invoiceId = charge.metadata?.invoiceId
  if (!invoiceId) return

  await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } })
    if (!invoice) return

    await tx.payment.create({
      data: {
        invoiceId,
        amount: Number(invoice.amount),
        currency: invoice.currency,
        provider: 'STRIPE',
        providerId: charge.id,
        status: 'refunded',
        metadata: charge.metadata,
      },
    })

    await tx.invoice.update({
      where: { id: invoiceId },
      data: { status: 'REFUNDED' },
    })

    await tx.message.create({
      data: {
        projectId: invoice.projectId,
        authorId: invoice.clientId,
        content: `Возврат средств по счёту №${invoice.number} выполнен.`,
        type: 'SYSTEM',
        metadata: { invoiceId, chargeId: charge.id },
      },
    })
  })
}