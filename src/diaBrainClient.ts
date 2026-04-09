export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface DIABrainResponse {
  result: string;
  chatHistoryId?: string;
}

interface TokenCache {
  accessToken: string | null;
  expiresAt: number;
}

let tokenCache: TokenCache = {
  accessToken: null,
  expiresAt: 0,
};

async function getOAuth2AccessToken(): Promise<{
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}> {
  const params = new URLSearchParams();
  params.append("client_id", process.env.CLIENT_ID ?? "");
  params.append("scope", process.env.SCOPE ?? "");
  params.append("client_secret", process.env.CLIENT_SECRET ?? "");
  params.append("grant_type", process.env.GRANT_TYPE ?? "");

  const response = await fetch(process.env.URL_TOKEN ?? "", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  const tokenData = await response.json();

  if (!tokenData.access_token) {
    throw new Error("No access token received in response");
  }

  return {
    accessToken: tokenData.access_token,
    tokenType: tokenData.token_type || "Bearer",
    expiresIn: tokenData.expires_in,
  };
}

async function getTokenCached(): Promise<string> {
  const now = Date.now();

  if (tokenCache.accessToken && now < tokenCache.expiresAt - 60_000) {
    return tokenCache.accessToken;
  }

  const token = await getOAuth2AccessToken();

  tokenCache = {
    accessToken: token.accessToken,
    expiresAt: now + token.expiresIn * 1000,
  };

  return token.accessToken;
}

async function createHistory(brainId: string, token: string): Promise<string> {
  const url = `${process.env.DIA_HISTORY}/${brainId}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 200) {
    const historyId = await response.text();
    if (historyId) {
      return historyId;
    }
    throw new Error("Empty history ID received");
  }

  const errorText = await response.text();
  throw new Error(`Failed to create history: ${response.status} - ${errorText}`);
}

export async function callDIABrain(
  messages: ChatMessage[],
  chatHistoryId?: string
): Promise<DIABrainResponse> {
  const brainId = process.env.BRAIN_ID?.replace(/"/g, "").trim();
  const endpoint = process.env.DIA_CHAT_RAG;

  if (!brainId) throw new Error("BRAIN_ID is not configured in .env");
  if (!endpoint) throw new Error("DIA_CHAT_RAG is not configured in .env");

  console.log(`[DIA Brain] → ${endpoint}`);

  const token = await getTokenCached();

  if (!chatHistoryId) {
    chatHistoryId = await createHistory(brainId, token);
    console.log(`[DIA Brain] Created history: ${chatHistoryId}`);
  }

  const systemMessage = messages.find((m) => m.role === "system")?.content ?? "";
  const userMessage = messages.filter((m) => m.role === "user").pop()?.content ?? "";

  const body = {
    prompt: userMessage,
    customMessageBehaviour: systemMessage,
    knowledgeBaseId: brainId,
    chatHistoryId: chatHistoryId,
    useGptKnowledge: true,
  };

  const t0 = Date.now();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (response.status === 200) {
    const chat = await response.json();
    if (chat.result) {
      console.log(`[DIA Brain] ✓ OK  ${Date.now() - t0}ms`);
      return {
        result: chat.result,
        chatHistoryId: chatHistoryId,
      };
    }
    throw new Error("DIA Brain response was empty or malformed");
  }

  const errorText = await response.text();
  console.error(`[DIA Brain] ✗ HTTP ${response.status}: ${errorText}`);
  throw new Error(`DIA Brain API error ${response.status}: ${errorText}`);
}
