#!/usr/bin/env node
/**
 * Synchronize LICENSE file on commit.
 * Reads optional settings from .env:
 *   LICENSE_TYPE=MIT   # or blank/none to skip
 *   LICENSE_HOLDER=Your Name
 *   LICENSE_YEAR=2025
 *
 * If LICENSE_TYPE=MIT, writes/updates ./LICENSE with MIT text.
 * Exits 0 always and prints a short status message to stdout.
 */

const fs = require("fs");
const path = require("path");

function loadDotEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith("#")) continue;
    const m = /^([^=]+)=(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1].trim();
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = val;
  }
}

function mitText(year, holder) {
  return `MIT License

Copyright (c) ${year} ${holder}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;
}

(function main() {
  loadDotEnv();
  const type = String(process.env.LICENSE_TYPE || "").trim().toUpperCase();
  if (!type || type === "NONE") {
    process.stdout.write("license_sync: no license changes (LICENSE_TYPE not set)\n");
    process.exit(0);
  }
  const year = String(process.env.LICENSE_YEAR || new Date().getFullYear());
  const holder = String(process.env.LICENSE_HOLDER || "Your Name");
  const target = path.join(process.cwd(), "LICENSE");

  let desired = "";
  if (type === "MIT") desired = mitText(year, holder);
  else {
    process.stdout.write(`license_sync: unsupported LICENSE_TYPE=${type}\n`);
    process.exit(0);
  }

  let current = "";
  if (fs.existsSync(target)) current = fs.readFileSync(target, "utf8");
  if (current !== desired) {
    fs.writeFileSync(target, desired, "utf8");
    process.stdout.write(`license_sync: wrote LICENSE (${type})\n`);
  } else {
    process.stdout.write("license_sync: LICENSE already up to date\n");
  }
  process.exit(0);
})();