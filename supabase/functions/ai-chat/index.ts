import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://esm.sh/openai@4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

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

  try {
    const { message, history = [], sessionId } = await req.json();

    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get embedding for the user's message
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: message,
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Vector search for relevant content (RAG)
    const { data: matches, error: matchError } = await supabase.rpc("match_content", {
      query_embedding: queryEmbedding,
      match_threshold: 0.65,
      match_count: 6,
    });

    if (matchError) {
      console.error("Vector search error:", matchError);
    }

    // Build context from matches
    const contextText = matches?.map((m) => m.content_text).join("\n\n") || "";

    // Also fetch latest published content as fallback context
    const [{ data: projects }, { data: services }, { data: skills }] = await Promise.all([
      supabase.from("projects").select("title, category, client, description, tags").eq("published", true).limit(10),
      supabase.from("services").select("name, description, features").eq("published", true).limit(10),
      supabase.from("skills").select("name, level, category").limit(15),
    ]);

    const fallbackContext = [
      projects?.map(p => `Project: ${p.title} (${p.category}) - Client: ${p.client} - ${p.description} - Tags: ${p.tags?.join(", ")}`).join("\n"),
      services?.map(s => `Service: ${s.name} - ${s.description} - Features: ${s.features?.join(", ")}`).join("\n"),
      skills?.map(s => `Skill: ${s.name} (${s.level}) - ${s.category}`).join("\n"),
    ].filter(Boolean).join("\n\n");

    const fullContext = contextText || fallbackContext;

    const systemPrompt = `Ты — AI-ассистент портфолио Клима Душкина (KLIM DUSHKIN DESIGN).
Архитектор, дизайнер, разработчик. Создаёт иммерсивные 3D-сайты, интерактивные инсталляции, WebGL-опыты.

КОНТЕКСТ О ПРОЕКТАХ И УСЛУГАХ:
${fullContext}

ПРАВИЛА:
- Отвечай кратко, по делу, на русском (если вопрос на русском) или английском
- Будь дружелюбным, но профессиональным
- Если не знаешь точного ответа — предложи связаться напрямую: hello@klimdushkin.design или +7 (914) 200-81-18
- Не выдумывай проекты или услуги, которых нет в контексте
- Можно спрашивать уточняющие вопросы`;

    // Prepare messages for OpenAI
    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...history.slice(-10).map((h: any) => ({
        role: h.role === "user" ? "user" as const : "assistant" as const,
        content: h.content,
      })),
      { role: "user" as const, content: message },
    ];

    // Stream response from OpenAI
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 800,
    });

    // Return SSE stream
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          controller.close();
        } catch (error) {
          console.error("Stream error:", error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Stream error" })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("AI Chat error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});