import * as dotenv from "dotenv";
dotenv.config();

import express, { Request, Response } from "express";
import cors from "cors";
import path from "path";
import { callLLM, ChatMessage } from "./llmClient";
import { callLLMStream } from "./llmStreamClient";
import { callDIABrain } from "./diaBrainClient";

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(cors());
app.use(express.json());

// Static files - use __dirname for reliable path resolution
const publicPath = path.join(__dirname, "../public");
console.log(`✓ Static files: ${publicPath}`);
app.use(express.static(publicPath));

// Fallback route for SPA / index.html
app.get("/", (_req: Request, res: Response) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

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

// Streaming SSE endpoint for LLM Farm
app.post("/api/chat-stream", async (req: Request, res: Response) => {
  const { messages } = req.body as { messages: ChatMessage[] };

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages array is required" });
    return;
  }

  const systemPrompt = process.env.SYSTEM_MESSAGE?.replace(/"/g, "").trim();
  const hasSystem = messages.some((m) => m.role === "system");
  const finalMessages: ChatMessage[] = systemPrompt && !hasSystem
    ? [{ role: "system", content: systemPrompt }, ...messages]
    : messages;

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  try {
    await callLLMStream(finalMessages, res);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Chat Stream Error]", message);
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
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

// Streaming SSE endpoint for DIA Brain (simulated stream)
app.post("/api/chat-DIA-stream", async (req: Request, res: Response) => {
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

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  try {
    const result = await callDIABrain(finalMessages, chatHistoryId);

    // Send chatHistoryId first
    if (result.chatHistoryId) {
      res.write(`data: ${JSON.stringify({ chatHistoryId: result.chatHistoryId })}\n\n`);
    }

    // Simulate streaming: send content in small chunks
    const content = result.result;
    const chunkSize = 3; // characters per chunk
    for (let i = 0; i < content.length; i += chunkSize) {
      const chunk = content.slice(i, i + chunkSize);
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      // Small delay to create typewriter effect
      await new Promise((resolve) => setTimeout(resolve, 15));
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[DIA Brain Stream Error]", message);
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`✓ Server started on http://localhost:${PORT}`);
  console.log(`✓ Model: ${process.env.MODEL}`);
  console.log(`✓ LLM Host: ${process.env.LLM_HOST}`);
  console.log(`✓ DIA Brain: ${process.env.DIA_HOST}`);
});
