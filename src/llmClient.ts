import { setGlobalDispatcher, ProxyAgent } from "undici";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  choices: Array<{
    message: ChatMessage;
    finish_reason: string;
    index: number;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
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
    console.log(`✓ Proxy: ${process.env.PROX} (user: ${process.env.AGENT_USER})`);
  }
  
  proxyInitialized = true;
}

/**
 * Call LLM using native fetch().
 * Proxy is handled via undici setGlobalDispatcher before the first call.
 * Auth uses "genaiplatform-farm-subscription-key" header (same as package/src/llm.js).
 */
export async function callLLM(messages: ChatMessage[]): Promise<LLMResponse> {
  setupProxy();
  const endpoint = process.env.LLM_GPT_5NANO_CHAT;
  const apiKey   = process.env.LLM_API_KEY?.replace(/"/g, "").trim();
  const model    = process.env.MODEL?.replace(/"/g, "").trim() ?? "gpt-5-nano-2025-08-07";

  if (!endpoint) throw new Error("LLM_GPT_5NANO_CHAT is not configured in .env");
  if (!apiKey)   throw new Error("LLM_API_KEY is not configured in .env");

  console.log(`[LLM] → ${endpoint}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    const t0 = Date.now();
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "genaiplatform-farm-subscription-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, messages }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[LLM] ✗ HTTP ${response.status}: ${errorText}`);
      throw new Error(`LLM API error ${response.status}: ${errorText}`);
    }

    const data = await response.json() as LLMResponse;
    console.log(`[LLM] ✓ OK  ${Date.now() - t0}ms  (${data.usage?.total_tokens ?? "?"} tokens)`);
    return data;

  } catch (err: unknown) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("LLM request timed out after 30s. Check proxy connectivity.");
    }
    throw err;
  }
}
