#!/usr/bin/env node
/**
 * Compare the T-Line slash-command UI against the actual SuperAgent CLI command
 * source. This is a source-code parity inventory, not a claim that the HTTP
 * bridge can execute a particular CLI command.
 *
 * Usage: node scripts/audit-superagent-parity.cjs [--check]
 * Source override: TLINE_SUPERAGENT_SOURCE_DIR=<path-to-superagent>
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const sourceRoot = path.resolve(
  process.env.TLINE_SUPERAGENT_SOURCE_DIR || path.join(root, "..", "superagent")
);
const commandDir = path.join(sourceRoot, "src", "core", "commands");
const target = path.join(root, "frontend", "src", "generated", "superagentCliCatalog.json");
const uiSource = path.join(root, "frontend", "src", "components", "SuperAgentCommands.ts");
if (!fs.existsSync(commandDir)) {
  console.error("SuperAgent command sources unavailable: " + commandDir);
  process.exitCode = 2;
} else {
  const records = new Map();
  const commandFiles = fs.readdirSync(commandDir).filter(n => n.endsWith(".ts") && !n.endsWith(".test.ts")).sort();
  for (const file of commandFiles) {
    const body = fs.readFileSync(path.join(commandDir, file), "utf8");
    // This scan is intentionally conservative: only static name/description
    // pairs assigned within command object definitions. Dynamic plugin slash
    // commands are not inferred and must be assessed separately.
    const matches = body.matchAll(/\bname:\s*["']([a-z][a-z0-9-]*)["']/g);
    for (const match of matches) {
      const name = match[1].toLowerCase();
      if (records.has(name)) continue;
      const near = body.slice(match.index, match.index + 1200);
      const desc = near.match(/\bdescription:\s*["'`]([^"'\r\n`]{1,180})["'`]/);
      records.set(name, {
        command: "/" + name,
        description: desc ? desc[1] : "SuperAgent CLI command",
        sourceFile: "src/core/commands/" + file
      });
    }
  }
  const ui = fs.readFileSync(uiSource, "utf8");
  const uiCommands = new Set(
    [...ui.matchAll(/\bcommand:\s*['"](\/[a-z][a-z0-9-]*)['"]/gi)]
      .map(m => m[1].toLowerCase())
  );
  const commands = [...records.values()].sort((a, b) => a.command.localeCompare(b.command))
    .map(c => ({ ...c, tlineHandler: uiCommands.has(c.command) ? "local-ui-handler" : "cli-only" }));
  const data = {
    generatedFrom: "SuperAgent src/core/commands/*.ts",
    warning: "Source inventory only; local UI handlers are not proven equivalent to CLI behavior. CLI-only commands are not executable through the T-Line slash-command bridge.",
    commands
  };
  const json = JSON.stringify(data, null, 2) + "\n";
  if (process.argv.includes("--check")) {
    if (!fs.existsSync(target) || fs.readFileSync(target, "utf8") !== json) {
      console.error("T-Line command parity catalog is outdated; run node scripts/audit-superagent-parity.cjs");
      process.exitCode = 1;
    } else console.log("T-Line CLI command parity catalog is up to date.");
  } else {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, json);
  }
  const missing = commands.filter(c => c.tlineHandler === "cli-only");
  console.log("SuperAgent CLI source commands:", commands.length);
  console.log("T-Line local handlers found:", commands.length - missing.length);
  console.log("Missing T-Line command handlers:", missing.length);
  console.log("CLI-only:", missing.map(c => c.command).join(", "));
}
