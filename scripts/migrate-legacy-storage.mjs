#!/usr/bin/env node
/**
 * One-shot legacy storage migration for Mnemo.
 *
 * This script reads the pre-file-storage data that older Mnemo builds kept in
 * Chromium's localStorage and writes it to the new `state.json` file that the
 * app now uses. It does NOT touch localStorage of the running app — run it
 * only when Mnemo is closed.
 *
 * Usage (from the project root):
 *
 *   node scripts/migrate-legacy-storage.mjs
 *       Uses Electron's default userData dir for this project.
 *
 *   node scripts/migrate-legacy-storage.mjs --userData "C:\\path\\to\\Mnemo"
 *       Uses a custom userData directory (e.g. the portable `user-data`
 *       folder that ships next to the packaged Mnemo.exe).
 *
 * The script boots a minimal, invisible Electron window pointed at the same
 * userData directory the app uses. That way the renderer can read the legacy
 * key out of localStorage via the usual Web API. The extracted payload is
 * written atomically to <userData>/state.json. A backup of any existing
 * state.json is saved to <userData>/state.json.pre-migration-<timestamp>.
 */

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

function parseArgs(argv) {
  const args = { userData: null };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === "--userData" || value === "--user-data") {
      args.userData = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function resolveElectronBinary() {
  // `electron` exports the path to the platform binary when required.
  try {
    return require("electron");
  } catch (error) {
    console.error("Could not locate the electron binary. Run `npm install` first.");
    throw error;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const electronBin = resolveElectronBinary();
  const runnerScript = path.join(__dirname, "migrate-legacy-storage.runner.cjs");

  const env = { ...process.env };
  if (args.userData) env.MNEMO_MIGRATE_USERDATA = path.resolve(args.userData);

  const child = spawn(electronBin, [runnerScript], {
    stdio: "inherit",
    env,
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
