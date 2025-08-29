# Setup and usage

## Quick start

1. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env and add OPENAI_API_KEY if you want API mode
   ```

2. **Install MCP dependencies**
   ```bash
   cd mcp/
   npm i
   cd ..
   ```
   Requires Node 20+

3. **Verify MCP tools**
   In Claude Code, confirm these tools appear:
   - `agent-templates:templates.list`
   - `agent-templates:templates.get`
   - `agent-templates:templates.render`
   - `codex-bridge:codex_dispatch_sub`
   - `codex-bridge:codex_dispatch_api`
   - `codex-bridge:codex_dispatch_auto`

## Mint a new agent

1. List available templates:
   ```
   Call agent-templates:templates.list
   ```

2. Render and write agent:
   ```
   Call agent-templates:templates.render
   name: "ui-80s"
   params: { "framework": "react", "css": "tailwind" }
   slug: "ui-80s"
   
   Write output to .claude/agents/ui-80s.md
   ```

3. Agent appears immediately in picker (no restart needed)

## Test codex bridge

Smoke test with minimal file block:
```
Call codex-bridge:codex_dispatch_auto
prompt: "Print a hello world Python script as a file block:
/hello.py
```
print('Hello, World!')
```"
```

Expected output format:
```
/hello.py
```python
print('Hello, World!')
```
```

## File block format

Codex must output files in this exact format:
```
/path/from/repo/root.ext
```
file contents here
```
```

## Workflow

- **History**: Agents write `/history/history(YYMMDDHHMMSS).md` before changes
- **Staging**: Files go to `.staging/<id>/`, never directly to repo
- **QC**: Reads from staging, runs checks, emits PASS/FAIL
- **Apply**: Only CC(O) applies staged files and commits
- **Finish**: After QC PASS, run the `finish-and-commit` command to apply changes and commit