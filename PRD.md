PRD: Local MCP bridge and agent templates

Goal

Create a local-only MCP stack that lets CC(O) spawn domain agents on demand and delegate coding to Codex CLI with subscription-to-API failover. Ship defaults for agent templates and wire the tools so CC(O) can mint specialized agents into .claude/agents/ instantly. Secrets live in .env. The MCP code lives under /mcp/. A plain-English whereToPutThis.md sits at repo root.

Outcomes
	1.	Two MCP servers under /mcp/:
	•	agent-templates returns default agent specs and renders complete agent files.
	•	codex-bridge dispatches Codex CLI runs with sub/api/auto modes and returns stdout.
	2.	Project root .mcp.json registers both servers.
	3.	Project root .env.example for API key and mode.
	4.	Project root whereToPutThis.md with setup and usage.
	5.	.claude/agents/ seeded with coder.md and qc.md that enforce history-first, stage-only, QC-gated workflow and call MCP tools.

Folder structure

repo-root/
  .env.example
  .mcp.json
  whereToPutThis.md
  .claude/
    agents/
      coder.md
      qc.md
  mcp/
    package.json
    agent-templates.js
    codex-bridge.js

File specs to generate

/mcp/package.json

{
  "name": "local-mcp-stack",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.4.0",
    "dotenv": "^16.4.5",
    "zod": "^3.23.8"
  },
  "engines": { "node": ">=20.0.0" }
}

/mcp/agent-templates.js

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

/mcp/codex-bridge.js

#!/usr/bin/env node
import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { spawn } from 'node:child_process';

function runCodexExec(promptText, mode = 'auto') {
  return new Promise(resolve => {
    const env = { ...process.env };
    if (mode === 'sub') {
      delete env.OPENAI_API_KEY; // force subscription path if logged in
    }
    if (mode === 'api') {
      if (!env.OPENAI_API_KEY) {
        resolve({ code: 2, out: '', err: 'OPENAI_API_KEY not set for API mode' });
        return;
      }
    }
    const child = spawn('codex', ['exec', promptText], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', d => out += d.toString());
    child.stderr.on('data', d => err += d.toString());
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
      description: `Run Codex CLI in ${fixedMode} mode and return stdout`,
      inputSchema: { prompt: z.string() }
    },
    async ({ prompt }) => {
      const res = await runCodexExec(prompt, fixedMode);
      if (res.code !== 0) throw new Error(res.err || `codex exec exit ${res.code}`);
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
    description: 'Try subscription first, then API on error',
    inputSchema: { prompt: z.string() }
  },
  async ({ prompt }) => {
    let res = await runCodexExec(prompt, 'sub');
    if (res.code !== 0) {
      res = await runCodexExec(prompt, 'api');
      if (res.code !== 0) throw new Error(res.err || 'codex exec failed in sub and api');
    }
    return { content: [{ type: 'text', text: res.out }] };
  }
);

await server.connect(new StdioServerTransport());

/.mcp.json

{
  "mcpServers": {
    "agent-templates": {
      "command": "node",
      "args": ["mcp/agent-templates.js"]
    },
    "codex-bridge": {
      "command": "node",
      "args": ["mcp/codex-bridge.js"]
    }
  }
}

/.env.example

# Copy to .env and fill in your key if you want API mode available.
OPENAI_API_KEY=

# Optional default for your own scripts. MCP tools themselves choose mode per call.
CODEX_AUTH_MODE=auto

/whereToPutThis.md

# Setup and usage

1) Copy `.env.example` to `.env` and set `OPENAI_API_KEY` if you want API mode available. Leave it empty to prefer subscription mode.
2) Run `npm i` inside `/mcp/` to install MCP server deps. Node 20+ required.
3) Ensure `.mcp.json` is at repo root. Claude Code or Desktop will discover these servers and spawn them locally.
4) In Claude Code, confirm tools exist: `agent-templates:*` and `codex-bridge:*`.

Minting a new domain agent
1) Ask CC(O) to call `agent-templates:templates.list` to see options, then `agent-templates:templates.render` for the template you want. Example: name `ui-80s`, params `{ "framework": "react", "css": "tailwind" }`, slug `ui-80s`.
2) CC(O) writes the returned markdown to `.claude/agents/ui-80s.md`.
3) The agent is now available. CC(O) invokes it by name.

Dispatching codegen
- Ensure your prompts instruct Codex to print file blocks only, using this exact format:

/path/from/repo/root.ext

<entire file contents>
---
```


	•	Use codex-bridge:codex_dispatch_auto for automatic sub-to-API failover. Use codex_dispatch_sub or codex_dispatch_api to force a path.

History and staging
	•	Agents must write /history/history(YYMMDDHHMMSS).md before any mutation.
	•	Agents must stage into .staging/<id>/ and never write to repo files directly.
	•	QC reads from .staging/<id>/. CC(O) decides when to apply and commit.

Secrets
	•	Do not write keys into agent files. Keep them only in .env.

`/.claude/agents/coder.md`
```markdown
---
name: coder
description: Decompose tasks, call Codex via MCP, and stage files. History-first. Stage-only. QC-gated.
tools: [Read, Write, Edit, Grep, Glob, Bash, "codex-bridge:codex_dispatch_auto"]
---

You are the coder.

Before any edit:
1) Create /history/history(YYMMDDHHMMSS).md.
2) In that file write:
   - Plan: short outline and checklist.
   - Prompt: verbatim prompt sent to Codex.
   - Code: for every file to be changed, include its absolute repo path header, then full contents between fences:
     /src/file.ts
     ---
     <entire file>
     ---

Dispatch:
3) Call codex-bridge:codex_dispatch_auto with a clear, scoped prompt that forces PRINT FULL FILE CONTENTS ONLY in the exact file-block format above. Do not ask Codex to run commands or modify files.

Materialize:
4) Parse the returned blocks. Write them into .staging/<id>/ at their exact paths. Do not write to real repo files.
5) Append a "Files staged" checklist to the history file and return DONE <id>.

/.claude/agents/qc.md

---
name: qc
description: Quality control over staged outputs. Writes qc reports and signals PASS or FAIL.
tools: [Read, Write, Grep, Glob, Bash]
---

You are QC.

For a given <id>:
1) Inspect .staging/<id>/ and read /history/history(<id>).md.
2) If package.json exists in the staging tree, run:
   - npm ci --silent --no-audit --no-fund
3) If tsconfig.json exists, run a TypeScript compile with npx -y tsc -p .
4) If an ESLint config exists, run npx -y eslint .
5) If package scripts exist, run npm run --silent build and npm run --silent test.
6) Write /history/qc(<id>).md with:
   - Status: PASS or FAIL
   - Logs for each check in fenced blocks
   - Issues with file:line anchors
   - Required fixes checklist
7) Emit "QC_PASS <id>" or "QC_FAIL <id> :: <reason>". Do not apply files. CC(O) will decide on apply and commit.

Acceptance criteria
	1.	Claude Code lists two tool namespaces: agent-templates:* and codex-bridge:*.
	2.	Rendering ui-80s via agent-templates:templates.render and writing it to .claude/agents/ui-80s.md makes a new agent immediately available without restarting MCP.
	3.	Calling codex-bridge:codex_dispatch_auto with a prompt that requests file blocks returns stdout containing one or more correctly formatted file blocks.
	4.	coder agent writes a history file, stages files under .staging/<id>/, and never writes to repo files.
	5.	qc agent compiles and lints staged code when configs exist, writes history/qc(<id>).md, and emits PASS or FAIL.
	6.	Secrets are only present in .env. No keys appear in agent files or history.

Notes
	•	Node 20+ is required.
	•	Keep .env out of version control.
	•	CC(O) remains the only actor that applies staged files to the repo and commits.