import * as dotenv from "dotenv";
dotenv.config();

// Set up global proxy BEFORE any fetch calls (same pattern as package/bin/server.js)
import { setGlobalDispatcher, ProxyAgent } from "undici";

/* if (process.env.PROX) {
  const dispatcher = new ProxyAgent({
    uri: new URL(process.env.PROX).toString(),
    token: `Basic ${Buffer.from(`${process.env.AGENT_USER}:${process.env.AGENT_PWD}`).toString("base64")}`,
  });
  setGlobalDispatcher(dispatcher);
  console.log(`✓ Proxy: ${process.env.PROX} (user: ${process.env.AGENT_USER})`);
} */

import express, { Request, Response } from "express";
import cors from "cors";
import path from "path";
import { callLLM, ChatMessage } from "./llmClient";
import { callDIABrain } from "./diaBrainClient";

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(cors());
app.use(express.json());
//app.use(express.static(path.join(__dirname, "../public")));
const publicPath = path.join(process.cwd(), "public");
console.log(`✓ Static files: ${publicPath}`);
app.use(express.static(publicPath));

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", model: process.env.MODEL });
});

app.post("/api/chat", async (req: Request, res: Response) => {
  const { messages } = req.body as { messages: ChatMessage[] };

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages array is required" });
    return;
  }

  // Inject system message from env if not already present in messages
  const systemPrompt = process.env.SYSTEM_MESSAGE?.replace(/"/g, "").trim();
  const hasSystem = messages.some((m) => m.role === "system");
  const finalMessages: ChatMessage[] = systemPrompt && !hasSystem
    ? [{ role: "system", content: systemPrompt }, ...messages]
    : messages;

  try {
    const result = await callLLM(finalMessages);
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Chat Error]", message);
    res.status(500).json({ error: message });
  }
});

app.post("/api/chat-DIA", async (req: Request, res: Response) => {
  const { messages, chatHistoryId } = req.body as {
    messages: ChatMessage[];
    chatHistoryId?: string;
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages array is required" });
    return;
  }

  const systemPrompt = process.env.SYSTEM_MESSAGE?.replace(/"/g, "").trim();
  const hasSystem = messages.some((m) => m.role === "system");
  const finalMessages: ChatMessage[] =
    systemPrompt && !hasSystem
      ? [{ role: "system", content: systemPrompt }, ...messages]
      : messages;

  try {
    const result = await callDIABrain(finalMessages, chatHistoryId);
    res.json({
      choices: [
        {
          message: { role: "assistant", content: result.result },
          finish_reason: "stop",
          index: 0,
        },
      ],
      chatHistoryId: result.chatHistoryId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[DIA Brain Error]", message);
    res.status(500).json({ error: message });
  }
});

app.listen(PORT, () => {
  console.log(`✓ Server started on http://localhost:${PORT}`);
  console.log(`✓ Model: ${process.env.MODEL}`);
  console.log(`✓ LLM Host: ${process.env.LLM_HOST}`);
  console.log(`✓ DIA Brain: ${process.env.DIA_HOST}`);
});
