import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Simple in-memory rate limiting (per IP per minute)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5; // 5 requests per minute
const RATE_WINDOW = 60 * 1000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  
  if (record.count >= RATE_LIMIT) {
    return false;
  }
  
  record.count++;
  return true;
}

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

function hashIp(ip: string): string {
  // Simple hash for privacy
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    hash = ((hash << 5) - hash) + ip.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sanitizeInput(input: string): string {
  return input.trim().slice(0, 5000);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const clientIp = getClientIp(req);
  
  // Rate limiting
  if (!checkRateLimit(clientIp)) {
    return new Response(JSON.stringify({ error: "Too many requests. Please try again later." }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { name, email, subject, message, honeypot } = body;

    // Honeypot spam protection
    if (honeypot && honeypot.length > 0) {
      // Silently succeed but don't actually process
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validation
    const errors: string[] = [];
    
    if (!name || name.trim().length < 2) {
      errors.push("Имя должно содержать минимум 2 символа");
    }
    
    if (!email || !validateEmail(email)) {
      errors.push("Введите корректный email");
    }
    
    if (!message || message.trim().length < 10) {
      errors.push("Сообщение должно содержать минимум 10 символов");
    }
    
    if (subject && subject.length > 200) {
      errors.push("Тема слишком длинная");
    }

    if (errors.length > 0) {
      return new Response(JSON.stringify({ error: errors.join("; "), errors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sanitize inputs
    const cleanName = sanitizeInput(name);
    const cleanEmail = sanitizeInput(email);
    const cleanSubject = subject ? sanitizeInput(subject) : "Без темы";
    const cleanMessage = sanitizeInput(message);

    // Save to database
    const { error: dbError } = await supabase
      .from("contact_submissions")
      .insert({
        name: cleanName,
        email: cleanEmail,
        subject: cleanSubject,
        message: cleanMessage,
        ip_hash: hashIp(clientIp),
        user_agent: req.headers.get("user-agent") || "unknown",
        status: "new",
      });

    if (dbError) {
      console.error("Database error:", dbError);
      return new Response(JSON.stringify({ error: "Failed to save submission" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send notification email to admin
    const adminEmail = Deno.env.get("ADMIN_EMAIL") || "hello@klimdushkin.design";
    
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a2e; max-width: 600px; margin: 0 auto; padding: 20px; }
          .container { background: #fafafa; border-radius: 12px; padding: 32px; border: 1px solid #e0e0e0; }
          .header { border-bottom: 2px solid #00f0ff; padding-bottom: 16px; margin-bottom: 24px; }
          .title { color: #050507; font-size: 20px; font-weight: 700; margin: 0; }
          .subtitle { color: #666; font-size: 14px; margin: 4px 0 0; }
          .field { margin-bottom: 16px; }
          .label { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #666; margin-bottom: 4px; }
          .value { font-size: 15px; color: #1a1a2e; word-break: break-word; }
          .message-box { background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; white-space: pre-wrap; }
          .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #999; }
          .btn { display: inline-block; background: #00f0ff; color: #050507; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 class="title">Новая заявка с портфолио</h1>
            <p class="subtitle">${new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}</p>
          </div>
          <div class="field">
            <div class="label">Имя</div>
            <div class="value">${cleanName}</div>
          </div>
          <div class="field">
            <div class="label">Email</div>
            <div class="value"><a href="mailto:${cleanEmail}">${cleanEmail}</a></div>
          </div>
          <div class="field">
            <div class="label">Тема</div>
            <div class="value">${cleanSubject}</div>
          </div>
          <div class="field">
            <div class="label">Сообщение</div>
            <div class="message-box">${cleanMessage}</div>
          </div>
          <div class="footer">
            <p>IP hash: ${hashIp(clientIp)}</p>
            <p>Вы можете ответить напрямую на это письмо.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailText = `
Новая заявка с портфолио KLIM DUSHKIN DESIGN

Имя: ${cleanName}
Email: ${cleanEmail}
Тема: ${cleanSubject}

Сообщение:
${cleanMessage}

---
IP hash: ${hashIp(clientIp)}
Время: ${new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}
    `;

    // Send email via send-email function
    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          to: adminEmail,
          subject: `📬 Новая заявка: ${cleanSubject}`,
          html: emailHtml,
          text: emailText,
          replyTo: cleanEmail,
        }),
      });
    } catch (emailError) {
      console.error("Failed to send notification email:", emailError);
      // Don't fail the request if email fails
    }

    // Send auto-reply to user (optional)
    const autoReplyEnabled = Deno.env.get("AUTO_REPLY_ENABLED") === "true";
    if (autoReplyEnabled) {
      try {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            to: cleanEmail,
            subject: "Получили вашу заявку — KLIM DUSHKIN DESIGN",
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <style>
                  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a2e; max-width: 600px; margin: 0 auto; padding: 20px; }
                  .container { background: #050507; border-radius: 12px; padding: 32px; color: #fff; }
                  .logo { color: #00f0ff; font-size: 24px; font-weight: 800; letter-spacing: -1px; margin-bottom: 24px; }
                  .title { font-size: 20px; margin-bottom: 16px; }
                  .text { color: #ccc; margin-bottom: 16px; }
                  .cta { display: inline-block; background: #00f0ff; color: #050507; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 8px; }
                  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #222; font-size: 12px; color: #666; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="logo">KLIM <span>DUSHKIN</span></div>
                  <h1 class="title">Спасибо за обращение, ${cleanName}!</h1>
                  <p class="text">Получил вашу заявку на тему «${cleanSubject}». Обычно отвечаю в течение 24 часов в рабочее время.</p>
                  <p class="text">Пока ждёте ответ — можете посмотреть <a href="https://klimdushkin.design#page-work" style="color: #00f0ff;">проекты</a> или почитать <a href="https://klimdushkin.design#page-services" style="color: #00f0ff;">об услугах</a>.</p>
                  <a href="https://klimdushkin.design#page-contact" class="cta">Вернуться на сайт</a>
                  <div class="footer">
                    <p>KLIM DUSHKIN DESIGN — Иммерсивные цифровые опыты</p>
                    <p>hello@klimdushkin.design · +7 (914) 200-81-18</p>
                  </div>
                </div>
              </body>
              </html>
            `,
            text: `
Спасибо за обращение, ${cleanName}!

Получил вашу заявку на тему «${cleanSubject}». Обычно отвечаю в течение 24 часов в рабочее время.

Пока ждёте ответ — можете посмотреть проекты на klimdushkin.design#page-work или почитать об услугах на klimdushkin.design#page-services.

---
KLIM DUSHKIN DESIGN
hello@klimdushkin.design · +7 (914) 200-81-18
            `,
          }),
        });
      } catch (autoReplyError) {
        console.error("Failed to send auto-reply:", autoReplyError);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Contact form error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});