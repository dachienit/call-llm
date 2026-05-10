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

/** Write SSE data and explicitly flush if Express supports it */
function writeToken(res: ExpressResponse, content: string): void {
  res.write(`data: ${JSON.stringify({ content })}\n\n`);
  // Express with compression disabled will flush automatically,
  // but we can coerce flushing via the underlying socket
  if (typeof (res as any).flush === "function") {
    (res as any).flush();
  }
}

/** Small async delay */
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Simulate token-by-token streaming for a full content string.
 * Splits by word+trailing-space so the typewriter effect feels natural.
 * TOKEN_DELAY_MS controls speed (default 18ms ≈ 55 tokens/sec).
 */
async function simulateStream(
  content: string,
  res: ExpressResponse,
  tokenDelayMs = 18
): Promise<void> {
  // Tokenize: split on word boundaries keeping trailing whitespace
  const tokens = content.match(/[^\s]*\s*/g) ?? [content];
  for (const token of tokens) {
    if (!token) continue;
    writeToken(res, token);
    await delay(tokenDelayMs);
  }
}

/**
 * Call LLM with streaming enabled.
 *
 * Two modes are handled automatically:
 *  1. True SSE (content-type: text/event-stream) — forward deltas in real-time.
 *     If the API gateway buffers them all, each delta is still forwarded
 *     individually with a small delay so the browser renders them one by one.
 *  2. Full JSON response (stream: true ignored by gateway) — simulate streaming
 *     word-by-word with a configurable delay.
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

  console.log(`[LLM Stream] → ${endpoint} (model: ${model})`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);

  const t0 = Date.now();

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "genaiplatform-farm-subscription-key": apiKey,
        "Content-Type": "application/json",
        Accept: "text/event-stream, application/json",
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

    const contentType = response.headers.get("content-type") ?? "";
    console.log(`[LLM Stream] Content-Type: ${contentType}`);

    if (!response.body) {
      res.write(`data: ${JSON.stringify({ error: "No response body" })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    // ── Case 1: True SSE stream ──────────────────────────────────────────────
    if (contentType.includes("text/event-stream")) {
      console.log("[LLM Stream] Mode: SSE");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let totalContent = "";
      let chunkCount = 0;
      let tokenCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunkCount++;
        buffer += decoder.decode(value, { stream: true });

        // Split on \r\n or \n, keep incomplete trailing line in buffer
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed === "data: [DONE]") {
            // Don't forward yet — we'll send a single DONE at the very end
            continue;
          }

          if (trimmed.startsWith("data: ")) {
            const jsonStr = trimmed.slice(6);
            try {
              const chunk = JSON.parse(jsonStr);
              const delta: string | undefined = chunk.choices?.[0]?.delta?.content;
              if (delta !== undefined && delta !== null && delta !== "") {
                totalContent += delta;
                tokenCount++;
                // Forward each delta individually — browser renders immediately
                writeToken(res, delta);
                // Small inter-token delay so tokens appear sequentially in the UI
                // even when the entire SSE stream arrives in one TCP burst
                await delay(15);
              }
            } catch {
              /* skip malformed JSON */
            }
          }
        }
      }

      console.log(
        `[LLM Stream] ✓ SSE  ${Date.now() - t0}ms  ` +
          `${totalContent.length} chars | ${tokenCount} tokens | ${chunkCount} TCP chunks`
      );

      // Edge case: API said SSE but delivered nothing — parse leftover buffer as JSON
      if (!totalContent && buffer.trim()) {
        try {
          const fallback = JSON.parse(buffer.trim());
          const content: string = fallback.choices?.[0]?.message?.content ?? "";
          if (content) {
            console.log("[LLM Stream] SSE fallback → simulate stream");
            await simulateStream(content, res);
          }
        } catch {
          /* ignore */
        }
      }
    }
    // ── Case 2: Full JSON (stream: true was ignored by gateway) ─────────────
    else {
      console.log("[LLM Stream] Mode: full JSON → simulate stream");
      const fullText = await response.text();

      try {
        const data = JSON.parse(fullText);
        const content: string = data.choices?.[0]?.message?.content ?? "";

        if (!content) {
          res.write(`data: ${JSON.stringify({ error: "Empty response from LLM" })}\n\n`);
        } else {
          console.log(`[LLM Stream] Simulating stream for ${content.length} chars`);
          await simulateStream(content, res);
        }
      } catch {
        console.error("[LLM Stream] Cannot parse JSON:", fullText.slice(0, 300));
        res.write(`data: ${JSON.stringify({ error: "Could not parse LLM response" })}\n\n`);
      }

      console.log(`[LLM Stream] ✓ JSON  ${Date.now() - t0}ms`);
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err: unknown) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      res.write(`data: ${JSON.stringify({ error: "LLM request timed out after 90s." })}\n\n`);
    } else {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[LLM Stream] Error:", message);
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    }
    res.write("data: [DONE]\n\n");
    res.end();
  }
}
