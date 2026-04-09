import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

/**
 * Recursively search for the first folder whose name matches "mcp-abap-abap-adt-api-main"
 * starting from common roots (Desktop, Documents, source/repos, Projects, C:\, etc.)
 */
const TARGET = "mcp-abap-abap-adt-api-main";
const MAX_DEPTH = 5;            // how deep to go under each root
const MAX_ENTRIES = 200;        // limit per directory to stay fast

async function findFolder(startDir, depth = 0) {
  if (depth > MAX_DEPTH) return null;
  try {
    const entries = await fs.readdir(startDir, { withFileTypes: true });
    for (const entry of entries.slice(0, MAX_ENTRIES)) {
      if (entry.isDirectory()) {
        const full = path.join(startDir, entry.name);
        if (entry.name.toLowerCase() === TARGET.toLowerCase()) return full;
        const found = await findFolder(full, depth + 1);
        if (found) return found;
      }
    }
  } catch {
    // ignore permission errors
  }
  return null;
}

export async function findMCPrepo() {
  const home = os.homedir();
  const candidates = [
    path.join(home, "Desktop"),
    path.join(home, "Documents"),
    path.join(home, "source", "repos"),
    path.join(home, "Projects"),
    home,
    "C:\\",  // add more drives if needed, e.g. "D:\\"
  ];

  for (const root of candidates) {
    const found = await findFolder(root);
    if (found) {
      console.log("✅ MCP folder found:", found);
      return found;
    }
  }

  console.warn("❌ Could not find folder", TARGET);
  return null;
}


