Looks solid. You hit the PRD. I see:

* `.mcp.json` registers both servers with `mcp/agent-templates.js` and `mcp/codex-bridge.js`.&#x20;
* `whereToPutThis.md` has the quick start + smoke test.&#x20;
* `/mcp/package.json` pins Node ≥20 and start scripts.&#x20;
* `codex-bridge.js` does PATH check, ANSI strip, and auto sub→API.&#x20;
* `agent-templates.js` exposes the three templates.&#x20;

### Tighten two things (apply now)

1. **Require fenced blocks in parsing** (right now a non-fenced blob can slip through).
   Replace `parseFileBlocks` in `/mcp/codex-bridge.js` with this whole function:

````js
function parseFileBlocks(output) {
  const blocks = [];
  const re = /^\/[^\s]+\.\w+\s*\n```[^\n]*\n([\s\S]*?)\n```/gm;
  let m;
  while ((m = re.exec(output)) !== null) {
    const headerEnd = output.indexOf("\n", m.index);
    const path = output.slice(m.index, headerEnd).trim();
    const content = m[1].replace(/\r\n/g, "\n");
    blocks.push({ path, content });
  }
  return blocks;
}
````

2. **Make PATH check cross-platform.** Swap `which` for a *portable* probe:

```js
function checkCodexExists() {
  try {
    if (process.platform === "win32") {
      execSync("where codex", { stdio: "ignore" });
    } else {
      execSync("command -v codex", { stdio: "ignore" });
    }
    return true;
  } catch {
    return false;
  }
}
```

### Quick end-to-end smoke for CC(O)

* `agent-templates:templates.list` → confirm 3 keys.&#x20;
* `agent-templates:templates.render` with `{ name: "ui-80s", params: { framework:"react", css:"tailwind" }, slug:"ui-80s" }` → write to `.claude/agents/ui-80s.md` (should appear immediately).&#x20;
* `codex-bridge:codex_dispatch_auto` with this exact prompt (triple-backtick format):

```
Print a single file block:
/hello.py
```

print("hello")

```
```

`codex-bridge` must return one fenced block; your parser should accept it.&#x20;

### Next small adds (nice-to-have)

* Final whole-repo QC gate (`qc_full`) before apply/commit.
* Add `.locks/` and `tasks/done/` to `.gitignore` (you already ignore `.env`, `.staging/`, `node_modules/`).&#x20;


