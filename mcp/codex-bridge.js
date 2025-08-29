#!/usr/bin/env node
import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { spawn } from 'node:child_process';
import { execSync } from 'node:child_process';

// Strip ANSI escape codes from strings
function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

// Check if codex binary exists on PATH
function checkCodexExists() {
  try {
    execSync('which codex', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Parse file blocks from output
function parseFileBlocks(output) {
  const blocks = [];
  const lines = output.split('\n');
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i];
    // Look for path pattern: starts with / and has file extension
    if (line.startsWith('/') && line.match(/\.\w+$/)) {
      const path = line.trim();
      let content = [];
      i++;
      
      // Skip separator lines like ---
      while (i < lines.length && lines[i].match(/^-+$/)) {
        i++;
      }
      
      // Collect content until we hit another path or triple backticks
      let inFence = false;
      while (i < lines.length) {
        const currentLine = lines[i];
        if (currentLine.startsWith('```')) {
          if (!inFence) {
            inFence = true;
            i++;
            continue;
          } else {
            // End of this block
            i++;
            break;
          }
        }
        if (!inFence && currentLine.startsWith('/') && currentLine.match(/\.\w+$/)) {
          // Start of next file block
          break;
        }
        if (inFence || (!currentLine.startsWith('/') || !currentLine.match(/\.\w+$/))) {
          content.push(currentLine);
        }
        i++;
      }
      
      if (content.length > 0) {
        blocks.push({ path, content: content.join('\n') });
      }
    } else {
      i++;
    }
  }
  
  return blocks;
}

function runCodexExec(promptText, mode = 'auto') {
  return new Promise(resolve => {
    // Check if codex exists first
    if (!checkCodexExists()) {
      resolve({ 
        code: 2, 
        out: '', 
        err: 'codex binary not found on PATH. Please install Codex CLI first.' 
      });
      return;
    }

    const env = { ...process.env };
    
    if (mode === 'sub') {
      delete env.OPENAI_API_KEY; // force subscription path if logged in
    }
    
    if (mode === 'api') {
      if (!env.OPENAI_API_KEY) {
        resolve({ 
          code: 2, 
          out: '', 
          err: 'OPENAI_API_KEY not set for API mode. Please set it in .env file.' 
        });
        return;
      }
    }
    
    // Ensure prompt enforces file-block output format
    const enforcedPrompt = `${promptText}

IMPORTANT: You MUST output your response in this exact format:
/path/to/file.ext
\`\`\`
full file contents here
\`\`\`

Output ONLY file blocks. No explanations, no comments outside of code blocks. Each file must start with its absolute path from repo root, followed by triple backticks, the complete file contents, then closing triple backticks.`;
    
    const child = spawn('codex', ['exec', enforcedPrompt], { 
      env, 
      stdio: ['ignore', 'pipe', 'pipe'] 
    });
    
    let out = '', err = '';
    child.stdout.on('data', d => out += d.toString());
    child.stderr.on('data', d => err += stripAnsi(d.toString()));
    child.on('close', code => resolve({ code, out, err }));
    child.on('error', e => resolve({ code: -1, out: '', err: String(e) }));
  });
}

const server = new McpServer({ name: 'codex-bridge', version: '0.2.0' });

function register(name, fixedMode) {
  server.registerTool(
    name,
    {
      title: `Dispatch Codex (${fixedMode})`,
      description: `Run Codex CLI in ${fixedMode} mode and return stdout. Returns file blocks in format: /path/to/file followed by content in fences.`,
      inputSchema: { prompt: z.string() }
    },
    async ({ prompt }) => {
      const res = await runCodexExec(prompt, fixedMode);
      if (res.code !== 0) {
        throw new Error(res.err || `codex exec exit ${res.code}`);
      }
      
      // Validate output contains at least one file block
      const blocks = parseFileBlocks(res.out);
      if (blocks.length === 0) {
        throw new Error('Codex output does not contain valid file blocks. Expected format: /path/to/file followed by content in triple backticks.');
      }
      
      return { content: [{ type: 'text', text: res.out }] };
    }
  );
}

register('codex_dispatch_sub', 'sub');
register('codex_dispatch_api', 'api');

server.registerTool(
  'codex_dispatch_auto',
  {
    title: 'Dispatch Codex (auto failover)',
    description: 'Try subscription first, then API on error. Returns file blocks in format: /path/to/file followed by content in fences.',
    inputSchema: { prompt: z.string() }
  },
  async ({ prompt }) => {
    let res = await runCodexExec(prompt, 'sub');
    if (res.code !== 0) {
      res = await runCodexExec(prompt, 'api');
      if (res.code !== 0) {
        throw new Error(res.err || 'codex exec failed in sub and api modes');
      }
    }
    
    // Validate output contains at least one file block
    const blocks = parseFileBlocks(res.out);
    if (blocks.length === 0) {
      throw new Error('Codex output does not contain valid file blocks. Expected format: /path/to/file followed by content in triple backticks.');
    }
    
    return { content: [{ type: 'text', text: res.out }] };
  }
);

await server.connect(new StdioServerTransport());