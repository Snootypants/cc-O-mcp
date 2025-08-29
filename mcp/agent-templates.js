#!/usr/bin/env node
import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const TEMPLATES = {
  'ui-80s': {
    version: '1.0.0',
    description: 'UI agent with retro 80s aesthetic guidance',
    frontmatter: {
      name: 'ui-80s',
      description: 'UI specialist. History-first. Stage-only. Uses codex bridge.',
      tools: ['Read', 'Write', 'Edit', 'Grep', 'Glob', 'Bash', 'codex-bridge:codex_dispatch_auto']
    },
    body: ({ framework = 'react', css = 'tailwind' } = {}) => `
You are a UI specialist. Style reference: 1980s retro, neon accents, grid lines, chrome, CRT scanlines used sparingly. Favor accessibility and responsive layouts.

Rules:
1) Write /history/history(YYMMDDHHMMSS).md with Plan, Prompt, and full Code blocks for every file you will touch.
2) Stage only. Materialize files into .staging/<id>. Never write to repo paths directly.
3) Use ${framework} with ${css}. Prefer semantic HTML, keyboard focus states, and color contrast >= 4.5:1.
4) Do not run commands to mutate the repo. When delegating codegen, call codex-bridge:codex_dispatch_auto with a prompt that forces PRINT FULL FILE CONTENTS ONLY in file-block format.
5) Return DONE <id> when staged.
`.trim()
  },
  'db-config': {
    version: '1.0.0',
    description: 'Database config agent for Postgres + Prisma',
    frontmatter: {
      name: 'db-config',
      description: 'DB config for Postgres with Prisma. History-first. Stage-only.',
      tools: ['Read', 'Write', 'Edit', 'Grep', 'Glob', 'Bash', 'codex-bridge:codex_dispatch_auto']
    },
    body: ({ orm = 'prisma' } = {}) => `
You are a database configuration agent for Postgres with ${orm}.

Deliver:
- .env.example entries for DB connection placeholders
- prisma/schema.prisma
- minimal migration scaffolding and a seed script
- TECHNICAL_GUIDE.md updates for connection and decisions

Rules:
1) History-first, stage-only, QC-gated.
2) Never embed real secrets. Use PLACEHOLDER_ values.
3) Return DONE <id>.
`.trim()
  },
  'threejs': {
    version: '1.0.0',
    description: 'Three.js scene and systems agent',
    frontmatter: {
      name: 'threejs',
      description: 'Three.js scaffolder. Fog, instancing, 60fps-minded loop.',
      tools: ['Read', 'Write', 'Edit', 'Grep', 'Glob', 'Bash', 'codex-bridge:codex_dispatch_auto']
    },
    body: ({ bundler = 'vite' } = {}) => `
You are a Three.js agent. Scaffold a minimal scene with fog and instancing. Use ${bundler}. History-first. Stage-only. QC-gated.
`.trim()
  }
};

const server = new McpServer({ name: 'agent-templates', version: '0.1.0' });

server.registerTool(
  'templates.list',
  { title: 'List agent templates', description: 'Return available template keys', inputSchema: {} },
  async () => ({ content: [{ type: 'json', json: Object.keys(TEMPLATES) }] })
);

server.registerTool(
  'templates.get',
  {
    title: 'Get template metadata',
    description: 'Return version and description for a template',
    inputSchema: { name: z.string() }
  },
  async ({ name }) => {
    const t = TEMPLATES[name];
    if (!t) throw new Error('unknown template');
    return { content: [{ type: 'json', json: { name, version: t.version, description: t.description } }] };
  }
);

server.registerTool(
  'templates.render',
  {
    title: 'Render an agent file',
    description: 'Return a complete .claude/agents/*.md file ready to write',
    inputSchema: {
      name: z.string(),
      params: z.record(z.any()).optional(),
      slug: z.string().optional()
    }
  },
  async ({ name, params = {}, slug }) => {
    const t = TEMPLATES[name];
    if (!t) throw new Error('unknown template');
    const fm = {
      ...t.frontmatter,
      name: slug || t.frontmatter.name,
      template_name: name,
      template_version: t.version
    };
    const front = [
      '---',
      ...Object.entries(fm).map(([k, v]) => Array.isArray(v) ? `${k}: [${v.join(', ')}]` : `${k}: ${v}`),
      '---'
    ].join('\n');
    const md = `${front}\n${t.body(params)}\n`;
    return { content: [{ type: 'text', text: md }] };
  }
);

await server.connect(new StdioServerTransport());