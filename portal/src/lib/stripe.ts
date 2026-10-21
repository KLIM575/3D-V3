import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-04-10',
  typescript: true,
})

export async function createPaymentIntent(
  amount: number,
  currency: string,
  metadata: Record<string, string>
) {
  return stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // Stripe uses cents/kopecks
    currency: currency.toLowerCase(),
    metadata,
    automatic_payment_methods: { enabled: true },
  })
}

export async function createCheckoutSession(
  amount: number,
  currency: string,
  successUrl: string,
  cancelUrl: string,
  metadata: Record<string, string>
) {
  return stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: currency.toLowerCase(),
          product_data: {
            name: metadata.description || 'Payment',
            description: metadata.projectTitle,
          },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata,
  })
}

export async function createCustomer(email: string, name: string, metadata: Record<string, string>) {
  return stripe.customers.create({
    email,
    name,
    metadata,
  })
}

export function constructWebhookEvent(payload: string | Buffer, signature: string) {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  )
}