import { setGlobalDispatcher, ProxyAgent } from "undici";
import { Response as ExpressResponse } from "express";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

let proxyInitialized = false;

function setupProxy(): void {
  if (proxyInitialized) return;

  if (process.env.PROX) {
    const dispatcher = new ProxyAgent({
      uri: new URL(process.env.PROX).toString(),
      token: `Basic ${Buffer.from(`${process.env.AGENT_USER}:${process.env.AGENT_PWD}`).toString("base64")}`,
    });
    setGlobalDispatcher(dispatcher);
    console.log(`✓ Proxy (stream): ${process.env.PROX} (user: ${process.env.AGENT_USER})`);
  }

  proxyInitialized = true;
}

/**
 * Call LLM with streaming enabled.
 * Pipes Server-Sent Events (SSE) directly to the Express response.
 */
export async function callLLMStream(
  messages: ChatMessage[],
  res: ExpressResponse
): Promise<void> {
  setupProxy();
  const endpoint = process.env.LLM_GPT_5NANO_CHAT;
  const apiKey = process.env.LLM_API_KEY?.replace(/"/g, "").trim();
  const model = process.env.MODEL?.replace(/"/g, "").trim() ?? "gpt-5-nano-2025-08-07";

  if (!endpoint) throw new Error("LLM_GPT_5NANO_CHAT is not configured in .env");
  if (!apiKey) throw new Error("LLM_API_KEY is not configured in .env");

  console.log(`[LLM Stream] → ${endpoint}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);

  const t0 = Date.now();

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "genaiplatform-farm-subscription-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, messages, stream: true }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[LLM Stream] ✗ HTTP ${response.status}: ${errorText}`);
      res.write(`data: ${JSON.stringify({ error: `LLM API error ${response.status}: ${errorText}` })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    if (!response.body) {
      res.write(`data: ${JSON.stringify({ error: "No response body" })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    // Read the stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let totalContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE lines from buffer
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // Keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed === "data: [DONE]") {
          // Forward the DONE signal
          res.write("data: [DONE]\n\n");
          continue;
        }

        if (trimmed.startsWith("data: ")) {
          const jsonStr = trimmed.slice(6);
          try {
            const chunk = JSON.parse(jsonStr);
            const delta = chunk.choices?.[0]?.delta?.content;
            if (delta) {
              totalContent += delta;
              // Forward the chunk to client
              res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
            }
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }
    }

    // If the API didn't use SSE format (returned full JSON), handle that
    if (!totalContent && buffer) {
      try {
        const fullResponse = JSON.parse(buffer);
        const content = fullResponse.choices?.[0]?.message?.content;
        if (content) {
          // Simulate streaming by sending the full content
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
          totalContent = content;
        }
      } catch {
        // Not JSON either, just forward what we have
      }
    }

    console.log(`[LLM Stream] ✓ OK  ${Date.now() - t0}ms  (${totalContent.length} chars)`);
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err: unknown) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      res.write(`data: ${JSON.stringify({ error: "LLM request timed out after 60s." })}\n\n`);
    } else {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    }
    res.write("data: [DONE]\n\n");
    res.end();
  }
}
