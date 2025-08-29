# CC(O) MCP Stack - Local MCP Bridge & Agent Templates

A local-only Model Context Protocol (MCP) stack that enables Claude Code (CC) and Claude Desktop to spawn specialized domain agents on demand and delegate code generation to Codex CLI with automatic subscription-to-API failover.

## 🎯 Overview

This project provides:
- **Two MCP servers** for agent management and code generation
- **Agent template system** with pre-built specialized agents
- **Codex CLI bridge** with automatic failover between subscription and API modes
- **History-first, stage-only workflow** ensuring controlled code changes
- **Quality control gates** for automated validation

## 🚀 Quick Start

### Prerequisites

- **Node.js 20+** required
- **Codex CLI** installed (`npm install -g @codex/cli` or similar)
- **Claude Code** or **Claude Desktop** with MCP support
- Optional: OpenAI API key for API mode failover

### Installation

1. **Clone the repository**
   ```bash
   git clone git@github.com:Snootypants/cc-O-mcp.git
   cd cc-O-mcp
   ```

2. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env and add your OPENAI_API_KEY if you want API mode available
   ```

3. **Install dependencies**
   ```bash
   cd mcp/
   npm install
   cd ..
   ```

4. **Verify in Claude Code**
   
   The following MCP tools should appear:
   - `agent-templates:templates.list`
   - `agent-templates:templates.get`
   - `agent-templates:templates.render`
   - `codex-bridge:codex_dispatch_sub`
   - `codex-bridge:codex_dispatch_api`
   - `codex-bridge:codex_dispatch_auto`

## 📁 Project Structure

```
cc-O-mcp/
├── .env.example           # Environment variables template
├── .mcp.json             # MCP server registration
├── .gitignore            # Git ignore rules
├── whereToPutThis.md     # Quick reference guide
├── README.md             # This file
├── PRD.md                # Product Requirements Document
├── .claude/
│   └── agents/           # Agent definitions
│       ├── coder.md      # Main coding agent
│       ├── qc.md         # Quality control agent
│       └── ui-80s.md     # Example UI specialist agent
└── mcp/
    ├── package.json      # Node dependencies
    ├── agent-templates.js # Agent template MCP server
    └── codex-bridge.js   # Codex CLI bridge MCP server
```

## 🤖 Available Agent Templates

### Built-in Templates

1. **ui-80s** - UI specialist with retro 1980s aesthetic
   - React/Tailwind focused
   - Accessibility-first approach
   - Neon accents, grid lines, CRT effects

2. **db-config** - Database configuration for Postgres + Prisma
   - Schema generation
   - Migration scaffolding
   - Seed scripts

3. **threejs** - Three.js scene scaffolder
   - Fog and instancing setup
   - Performance-optimized render loop
   - Vite bundler integration

### Creating New Agents

1. **List available templates**
   ```
   Call agent-templates:templates.list
   ```

2. **Render an agent**
   ```
   Call agent-templates:templates.render
   name: "ui-80s"
   params: { "framework": "react", "css": "tailwind" }
   slug: "my-ui-agent"
   ```

3. **Write to agents directory**
   ```
   Write output to .claude/agents/my-ui-agent.md
   ```

The agent appears immediately in Claude's agent picker without restart.

## 🔧 MCP Servers

### agent-templates

Manages and renders agent templates.

**Tools:**
- `templates.list` - Get all available template keys
- `templates.get` - Get metadata for a specific template
- `templates.render` - Generate a complete agent file

**Local testing:**
```bash
cd mcp/
npm run start:templates
```

### codex-bridge

Interfaces with Codex CLI for code generation.

**Tools:**
- `codex_dispatch_sub` - Force subscription mode
- `codex_dispatch_api` - Force API mode (requires OPENAI_API_KEY)
- `codex_dispatch_auto` - Automatic failover (sub → api)

**Features:**
- Binary existence checking
- ANSI stripping from errors
- File-block format validation
- Automatic prompt enhancement

**Local testing:**
```bash
cd mcp/
npm run start:codex
```

## 📋 Workflow

### History-First Approach

All agents follow this workflow:

1. **Document changes** in `/history/history(YYMMDDHHMMSS).md`
2. **Stage files** in `.staging/<id>/` directory
3. **Quality control** validates staged files
4. **Manual apply** by user (CC/O decides when to commit)

### File Block Format

Codex outputs must follow this format:
```
/path/to/file.ext
```language
file contents here
```
```

### Quality Control Process

The QC agent:
1. Inspects staged files
2. Runs TypeScript compilation if applicable
3. Runs ESLint if configured
4. Executes build and test scripts
5. Writes report to `/history/qc(<id>).md`
6. Emits PASS or FAIL status

## 🔐 Security

- **Local-only operation** - No network calls except Codex CLI
- **Secrets isolation** - API keys only in `.env`, never in code
- **Staged changes** - Files staged before applying to repository
- **No auto-commits** - User controls all repository changes

## 🧪 Testing

### Acceptance Tests

Run the built-in validation:

1. **Test template listing**
   ```javascript
   // Should return ['ui-80s', 'db-config', 'threejs']
   agent-templates:templates.list
   ```

2. **Test agent rendering**
   ```javascript
   agent-templates:templates.render
   // Verify output includes frontmatter and body
   ```

3. **Test Codex bridge**
   ```javascript
   codex-bridge:codex_dispatch_auto
   // With prompt: "Print hello world Python script"
   // Should return file block format
   ```

## 📝 Configuration

### Environment Variables

`.env` file supports:
```bash
# OpenAI API key for Codex API mode
OPENAI_API_KEY=sk-...

# Default auth mode (auto/sub/api)
CODEX_AUTH_MODE=auto
```

### MCP Registration

`.mcp.json` registers both servers:
```json
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
```

## 🤝 Contributing

This is a local-only MCP stack designed for Claude Code integration. Contributions should maintain:

- History-first workflow
- Stage-only file operations
- Local-only execution (no external services)
- Security-first approach (no secrets in code)

## 📄 License

MIT License - See LICENSE file for details

## 🆘 Support

For issues or questions:
- Check `whereToPutThis.md` for quick reference
- Review the PRD.md for design decisions
- Open an issue on GitHub

## 🎭 Credits

Built for integration with:
- [Claude Code](https://claude.ai/code) by Anthropic
- [Model Context Protocol](https://modelcontextprotocol.io)
- [Codex CLI](https://github.com/codex/cli)

---

**Note:** This is a local development tool. Always review staged changes before applying them to your repository.