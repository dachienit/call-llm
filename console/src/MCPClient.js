import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";

export class MCPClient {
  constructor({ repoDir, command = "node", args = ["dist/index.js"] }) {
    this.repoDir = path.resolve(repoDir);
    this.command = command;
    this.args = args;
    this.pending = new Map();
  }

  start() {
    this.proc = spawn(this.command, this.args, {
      cwd: this.repoDir,
      stdio: ["pipe", "pipe", "inherit"],
    });
    this.proc.stdout.on("data", (buf) => {
      const lines = buf.toString().split("\n").filter(Boolean);
      for (const line of lines) {
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }
        const cb = this.pending.get(msg.id);
        if (cb) { this.pending.delete(msg.id); cb(msg); }
      }
    });
    process.on("exit", () => this.stop());
  }

  stop() {
    if (this.proc) { try { this.proc.kill(); } catch {} }
  }

  rpc(method, params = {}) {
    const id = randomUUID();
    const req = { jsonrpc: "2.0", id, method, params };
    this.proc.stdin.write(JSON.stringify(req) + "\n");
    return new Promise((resolve) => this.pending.set(id, resolve));
  }

  async initialize() {
    return this.rpc("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
    });
  }

  listTools() { return this.rpc("tools/list", {}); }

  async callTool(name, args = {}, meta) {
    const send = () => this.rpc("tools/call", { name, arguments: args, _meta: meta });
    let res = await send();
    if (res?.error && /Session timed out/i.test(res.error.message || "")) {
      await this.callTool("login", {}); // re-login once
      res = await send();
    }
    if (res?.error) throw new Error(res.error.message || "Tool call failed");
    return res.result ?? res;
  }
}
