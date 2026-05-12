// Electron-side runner for the legacy storage migration script.
//
// Boots a hidden BrowserWindow pointed at the given userData directory, reads
// the Mnemo payload out of localStorage, writes it to state.json (with atomic
// tmp + rename), and exits. Uses only the plain Electron + Node APIs so it
// works regardless of the app's own TypeScript build output.

const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");

const LEGACY_KEYS = [
  "ebbinghaus-desktop-planner:data",
  "mnemo:state",
];

function resolveUserDataDir() {
  const override = process.env.MNEMO_MIGRATE_USERDATA;
  if (override) {
    return path.resolve(override);
  }
  // Default: the same userData Electron would pick for this app.
  return app.getPath("userData");
}

async function readFileOrNull(file) {
  try {
    return await fsp.readFile(file, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    throw error;
  }
}

async function atomicWrite(target, content) {
  const tmp = `${target}.tmp`;
  await fsp.mkdir(path.dirname(target), { recursive: true });
  await fsp.rm(tmp, { force: true });
  const handle = await fsp.open(tmp, "wx");
  try {
    await handle.writeFile(content, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fsp.rename(tmp, target);
}

async function run() {
  const userDataDir = resolveUserDataDir();
  app.setPath("userData", userDataDir);
  console.log(`[mnemo-migrate] userData: ${userDataDir}`);

  await app.whenReady();

  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load an empty data URL so we get a renderer with access to the origin's
  // localStorage without needing any on-disk HTML.
  await win.loadURL("data:text/html,<!doctype html><title>mnemo-migrate</title>");

  const probe = await win.webContents.executeJavaScript(
    `(() => {
      const keys = ${JSON.stringify(LEGACY_KEYS)};
      for (const key of keys) {
        const raw = localStorage.getItem(key);
        if (raw) return { key, raw };
      }
      return null;
    })()`,
    true,
  );

  if (!probe) {
    console.log("[mnemo-migrate] No legacy localStorage payload found. Nothing to migrate.");
    win.destroy();
    app.quit();
    return;
  }

  console.log(`[mnemo-migrate] Found legacy payload under "${probe.key}" (${probe.raw.length} chars).`);

  let parsed;
  try {
    parsed = JSON.parse(probe.raw);
  } catch (error) {
    console.error("[mnemo-migrate] Legacy payload is not valid JSON; aborting.");
    win.destroy();
    app.exit(2);
    return;
  }

  const statePath = path.join(userDataDir, "state.json");
  const existing = await readFileOrNull(statePath);
  if (existing) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backup = path.join(userDataDir, `state.json.pre-migration-${stamp}`);
    await fsp.writeFile(backup, existing, "utf8");
    console.log(`[mnemo-migrate] Existing state.json backed up to ${backup}`);
  }

  const serialized = JSON.stringify(parsed);
  await atomicWrite(statePath, serialized);
  console.log(`[mnemo-migrate] Wrote ${serialized.length} chars to ${statePath}`);

  // Drop the legacy key so a future run won't duplicate work.
  await win.webContents.executeJavaScript(
    `localStorage.removeItem(${JSON.stringify(probe.key)})`,
    true,
  );
  console.log(`[mnemo-migrate] Cleared legacy key "${probe.key}".`);

  win.destroy();
  app.quit();
}

run().catch((error) => {
  console.error("[mnemo-migrate] Failed:", error);
  if (fs.existsSync) {
    // best effort; errors already logged
  }
  app.exit(1);
});
