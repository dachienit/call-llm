#!/usr/bin/env node
// backend/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import chalk from "chalk";
import { ask } from "../src/ask.js";
import { fileURLToPath } from "url";
import { dirname } from 'path';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { setGlobalDispatcher, ProxyAgent } from "undici";

const __filename = import.meta.url ? fileURLToPath(import.meta.url) : (typeof __filename !== 'undefined' ? __filename : process.cwd());
const __dirname = dirname(__filename);

// When running in pkg, process.cwd() is the directory where the executable is running.
// We want to look for .env there.
const envPath = process.pkg ? path.join(process.cwd(), '.env') : path.join(__dirname, '../.env');
console.log('Loading .env from:', envPath);
dotenv.config({ path: envPath });

process.env.NODE_NO_WARNINGS = 1;

//sessionStorage.removeItem("historyID");

async function main() {
  // Setup Express server
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Serve static files from frontend directory
  // In pkg, assets defined in package.json are included in the snapshot.
  // We need to ensure we point to the correct location.
  // If bundled with esbuild, __dirname might be inside the bundle.
  // If using pkg, we might want to keep frontend external or internal.
  // Let's try to look for it relative to the executable first (external), then internal.

  let frontendPath;
  if (process.pkg) {
    // Try external 'frontend' folder next to exe
    const externalFrontend = path.join(process.cwd(), 'frontend');
    if (fs.existsSync(externalFrontend)) {
      frontendPath = externalFrontend;
      console.log('Serving frontend from external folder:', frontendPath);
    } else {
      // Fallback to internal snapshot if included
      frontendPath = path.join(__dirname, '../frontend');
      console.log('Serving frontend from internal snapshot:', frontendPath);
    }
  } else {
    frontendPath = path.join(__dirname, '../frontend');
  }
  app.use(express.static(frontendPath));

  // API endpoint to get Windows username
  app.get('/api/userinfo', (req, res) => {
    try {
      // Get username from environment variable (Windows: USERNAME, Linux/Mac: USER)
      // Or use os.userInfo() which works cross-platform
      let username = '';

      if (process.platform === 'win32') {
        // Windows
        username = process.env.USERNAME || '';
        if (!username) {
          try {
            username = os.userInfo().username || '';
          } catch (err) {
            console.error('Error getting user info:', err);
          }
        }
      } else {
        // Linux/Mac
        username = process.env.USER || '';
        if (!username) {
          try {
            username = os.userInfo().username || '';
          } catch (err) {
            console.error('Error getting user info:', err);
          }
        }
      }

      console.log(`[API] Returning username: ${username}`);
      res.json({ username: username || '' });
    } catch (error) {
      console.error('Error in /api/userinfo:', error);
      res.status(500).json({ error: 'Internal server error', message: error.message });
    }

  });

  // API endpoint for chat
  // API endpoint to refresh token
  app.post('/api/refresh-token', async (req, res) => {
    try {
      console.log('[API] Refreshing token...');
      //global.token = await getOAuth2AccessToken();
      console.log('[API] Token refreshed successfully');
      res.json({ success: true, expiresIn: global.token.expiresIn });
    } catch (error) {
      console.error('[API] Error refreshing token:', error);
      res.status(500).json({ error: 'Failed to refresh token', message: error.message });
    }
  });

  app.post('/api/chat', async (req, res) => {
    try {
      const { message, env, option, reLoad, objectType, objectName, error, historyID } = req.body;

      // If option is present, message can be empty (e.g. @refactor might not need text if it uses context or just returns a template)
      // If option is NOT present, message is required.
      if (!option && (!message || typeof message !== 'string')) {
        return res.status(400).json({ error: 'Message is required and must be a string' });
      }

      // Call the ask function
      const { output: response, historyID: hisID } = await ask(option, message, env, objectType, objectName, error, historyID);

      res.json({ reply: response, hisID });
    } catch (error) {
      console.error('Error in /api/chat:', error);
      res.status(500).json({ error: 'Internal server error', message: error.message });
    }
  });

  // Skills APIs
  const docsPath = path.join(__dirname, '../docs');

  // List skills
  app.get('/api/skills', (req, res) => {
    try {
      if (!fs.existsSync(docsPath)) {
        return res.json([]);
      }
      const files = fs.readdirSync(docsPath).filter(file => {
        return fs.statSync(path.join(docsPath, file)).isFile();
      });
      res.json(files);
    } catch (error) {
      console.error('Error listing skills:', error);
      res.status(500).json({ error: 'Failed to list skills' });
    }
  });

  // Read skill
  app.get('/api/skills/:filename', (req, res) => {
    try {
      const filename = req.params.filename;
      const filePath = path.join(docsPath, filename);

      console.log('[DEBUG] Read Skill:', { filename, docsPath, filePath });

      // Basic security check to prevent directory traversal
      if (!filePath.startsWith(docsPath)) {
        console.error('[DEBUG] Access denied:', filePath);
        return res.status(403).json({ error: 'Access denied' });
      }

      if (!fs.existsSync(filePath)) {
        console.error('[DEBUG] File not found:', filePath);
        return res.status(404).json({ error: 'File not found' });
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      res.json({ content });
    } catch (error) {
      console.error('Error reading skill:', error);
      res.status(500).json({ error: 'Failed to read skill' });
    }
  });

  // Update skill
  app.post('/api/skills/:filename', (req, res) => {
    try {
      const filename = req.params.filename;
      const { content } = req.body;
      const filePath = path.join(docsPath, filename);

      // Basic security check
      if (!filePath.startsWith(docsPath)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
      }

      fs.writeFileSync(filePath, content, 'utf-8');
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating skill:', error);
      res.status(500).json({ error: 'Failed to update skill' });
    }
  });

  // Start server
  app.listen(PORT, () => {
    console.log(chalk.green(`Server is running on http://localhost:${PORT}`));
    console.log(chalk.blue(`Frontend is available at http://localhost:${PORT}`));
  });
}

main();

