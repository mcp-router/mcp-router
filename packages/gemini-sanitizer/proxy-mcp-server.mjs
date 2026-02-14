#!/usr/bin/env node

/**
 * MCP Sanitizer Proxy Server
 * 
 * Acts as a middleware between Gemini CLI and MCP Router
 * - Receives requests from Gemini CLI
 * - Forwards to MCP Router
 * - Sanitizes tool names in both directions
 */

import { MCPToolSanitizer } from './dist/index.js';
import { spawn } from 'child_process';
import { writeFileSync, appendFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sanitizer = new MCPToolSanitizer();
const LOG_FILE = join(__dirname, 'mcp-server.log');

writeFileSync(LOG_FILE, '');

function log(message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  appendFileSync(LOG_FILE, line);
  console.error(line.trim());
}

log('MCP Sanitizer Proxy starting...');

log('Spawning MCP Router CLI...');

const MCPR_TOKEN = process.env.MCPR_TOKEN;
if (MCPR_TOKEN) {
  log(`Found MCPR_TOKEN: ${MCPR_TOKEN.substring(0, 10)}...`);
} else {
  log('No MCPR_TOKEN in environment');
}

const mcpRouter = spawn('npx', ['-y', '@mcp_router/cli@latest', 'connect'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: true,
  env: {
    ...process.env,
    MCPR_TOKEN: MCPR_TOKEN || ''
  }
});

let mcpRouterReady = false;
let pendingRequests = [];

let mcpRouterBuffer = '';

mcpRouter.stdout.on('data', (chunk) => {
  mcpRouterBuffer += chunk.toString();

  const lines = mcpRouterBuffer.split('\n');
  mcpRouterBuffer = lines.pop() || '';

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const message = JSON.parse(line);
      handleMCPRouterResponse(message);
    } catch (error) {
      log(`Non-JSON from MCP Router: ${line.substring(0, 100)}`);
    }
  }
});

mcpRouter.stderr.on('data', (chunk) => {
  const msg = chunk.toString().trim();
  if (msg && !msg.includes('npm warn')) {
    log(`MCP Router stderr: ${msg}`);
  }
});

mcpRouter.on('error', (error) => {
  log(`MCP Router error: ${error.message}`);
  process.exit(1);
});

mcpRouter.on('close', (code) => {
  log(`MCP Router closed with code ${code}`);
  process.exit(1);
});

function handleMCPRouterResponse(message) {
  const { id, result, error, method } = message;

  log(`MCP Router response: ${method || `id:${id}`}`);

  if (result && result.serverInfo) {
    mcpRouterReady = true;
    log(`MCP Router ready: ${result.serverInfo.name}`);

    if (pendingRequests.length > 0) {
      log(`Processing ${pendingRequests.length} pending requests`);
      pendingRequests.forEach(req => sendToMCPRouter(req));
      pendingRequests = [];
    }
  }

  if (result && result.tools) {
    log(`Sanitizing ${result.tools.length} tools...`);

    result.tools.forEach((tool, i) => {
      log(`  [${i}] "${tool.name}"`);
    });

    try {
      const sanitized = sanitizer.sanitizeTools(result.tools);

      let fixedCount = 0;
      sanitized.forEach(tool => {
        if (tool.originalName !== tool.sanitizedName) {
          fixedCount++;
          log(`  "${tool.originalName}" → "${tool.sanitizedName}"`);
        }
      });

      log(`Fixed ${fixedCount} out of ${result.tools.length} tools`);

      const mcpTools = sanitized.map(tool => ({
        name: tool.sanitizedName,
        description: tool.description,
        inputSchema: tool.sanitizedSchema
      }));

      log(`FULL SANITIZED TOOL LIST DUMP START`);
      log(JSON.stringify(mcpTools, null, 2));
      log(`FULL SANITIZED TOOL LIST DUMP END`);
   
      const response = {
        jsonrpc: '2.0',
        id: id,
        result: { tools: mcpTools }
      };

      process.stdout.write(JSON.stringify(response) + '\n');
      log(`Sent ${mcpTools.length} sanitized tools to Gemini CLI`);
      return;
    } catch (error) {
      log(`Sanitization error: ${error.message}`);
    }
  }

  process.stdout.write(JSON.stringify(message) + '\n');
}

function sendToMCPRouter(request) {
  const { method, params } = request;

  if (method === 'tools/call' && params && params.name) {
    const originalName = sanitizer.getOriginalName(params.name);
    if (originalName) {
      log(`Mapping "${params.name}" → "${originalName}"`);
      request.params.name = originalName;
    }
  }

  mcpRouter.stdin.write(JSON.stringify(request) + '\n');
  log(`Sent to MCP Router: ${method} (id: ${request.id})`);
}

process.stdin.setEncoding('utf-8');
process.stdin.resume();

let geminiBuffer = '';

process.stdin.on('data', (chunk) => {
  geminiBuffer += chunk;
  log(`Received ${chunk.length} bytes from Gemini CLI`);

  const lines = geminiBuffer.split('\n');
  geminiBuffer = lines.pop() || '';

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const request = JSON.parse(line);
      const { method, id } = request;

      log(`Gemini CLI request: ${method} (id: ${id})`);

      if (!mcpRouterReady && method !== 'initialize') {
        log(`Queuing request until MCP Router ready`);
        pendingRequests.push(request);
        return;
      }

      sendToMCPRouter(request);

    } catch (error) {
      log(`Error processing Gemini CLI message: ${error.message}`);
    }
  }
});

process.stdin.on('error', (error) => {
  log(`Stdin error: ${error.message}`);
});

process.stdin.on('end', () => {
  log('Gemini CLI disconnected');
  mcpRouter.kill();
  process.exit(0);
});

log('Proxy server ready! Waiting for Gemini CLI...');
