import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  dialog,
  ipcMain,
  nativeImage,
  protocol,
  shell,
} from "electron";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGE_SCHEME = "mnemo-image";
const ALLOWED_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp"]);
const ALLOWED_IMAGE_MIME = new Map<string, string>([
  ["image/png", ".png"],
  ["image/jpeg", ".jpg"],
  ["image/jpg", ".jpg"],
  ["image/gif", ".gif"],
  ["image/webp", ".webp"],
  ["image/svg+xml", ".svg"],
  ["image/bmp", ".bmp"],
]);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let closeBehavior: "quit" | "tray" = "quit";
let isQuitting = false;
let hasUnsavedChanges = false;

if (app.isPackaged) {
  app.setPath("userData", path.resolve(process.resourcesPath, "..", "user-data"));
}

// Single-instance lock: if another Mnemo process is already running, this
// new process exits immediately and the existing one gets a "second-instance"
// event so it can surface its window.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) {
      createWindow();
      return;
    }
    if (mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
  });
}

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

protocol.registerSchemesAsPrivileged([
  {
    scheme: IMAGE_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP: true },
  },
]);

function getImagesDir() {
  return path.join(app.getPath("userData"), "images");
}

function safeImageName(name: string) {
  // Only allow file names that look like "<hex>.<ext>" to block path traversal.
  return /^[0-9a-f]{16,64}\.[a-z0-9]{2,5}$/.test(name);
}

const MIME_BY_EXT = new Map<string, string>([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".svg", "image/svg+xml"],
  [".bmp", "image/bmp"],
]);

function registerImageProtocol() {
  const imagesDir = getImagesDir();
  fsSync.mkdirSync(imagesDir, { recursive: true });

  protocol.handle(IMAGE_SCHEME, async (request) => {
    try {
      const url = new URL(request.url);
      const host = decodeURIComponent(url.hostname || "");
      const rest = decodeURIComponent(url.pathname || "");
      const fileName = (host + rest).replace(/^\/+|\/+$/g, "");
      if (!safeImageName(fileName)) {
        return new Response("Not Found", { status: 404 });
      }
      const absolute = path.join(imagesDir, fileName);
      if (!absolute.startsWith(imagesDir)) {
        return new Response("Forbidden", { status: 403 });
      }
      const buffer = await fs.readFile(absolute);
      const ext = path.extname(fileName).toLowerCase();
      const contentType = MIME_BY_EXT.get(ext) ?? "application/octet-stream";
      return new Response(buffer, {
        status: 200,
        headers: {
          "content-type": contentType,
          "cache-control": "no-cache",
        },
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return new Response("Not Found", { status: 404 });
      }
      console.error("Failed to resolve image request:", error);
      return new Response("Internal Error", { status: 500 });
    }
  });
}

function getWindowStatePath() {
  return path.join(app.getPath("userData"), "window-state.json");
}

function loadWindowState() {
  try {
    const raw = fsSync.readFileSync(getWindowStatePath(), "utf8");
    const state = JSON.parse(raw) as Partial<{
      width: number;
      height: number;
      x: number;
      y: number;
      paperColor: string;
      inkColor: string;
      surfaceColor: string;
    }>;

    if (Number.isFinite(state.width) && Number.isFinite(state.height)) {
      return state;
    }
  } catch {
    return null;
  }

  return null;
}

function saveWindowState(window: BrowserWindow) {
  if (window.isMinimized() || window.isMaximized()) return;

  try {
    fsSync.mkdirSync(app.getPath("userData"), { recursive: true });
    const bounds = window.getBounds();
    const previous = loadWindowState();
    const next = {
      ...bounds,
      paperColor: previous?.paperColor,
      inkColor: previous?.inkColor,
      surfaceColor: previous?.surfaceColor,
    };
    fsSync.writeFileSync(getWindowStatePath(), JSON.stringify(next, null, 2));
  } catch {
    // Window state is a convenience; failures should not affect the app.
  }
}

function saveThemeColors(colors: { paper: string; ink: string; surface: string }) {
  try {
    fsSync.mkdirSync(app.getPath("userData"), { recursive: true });
    const previous = loadWindowState() ?? {};
    const next = {
      ...previous,
      paperColor: colors.paper,
      inkColor: colors.ink,
      surfaceColor: colors.surface,
    };
    fsSync.writeFileSync(getWindowStatePath(), JSON.stringify(next, null, 2));
  } catch {
    // Theme persistence is best-effort.
  }
}

function getIconPath() {
  return path.join(__dirname, "..", "assets", "icon.png");
}

function createTrayIcon() {
  const iconPath = getIconPath();
  if (fsSync.existsSync(iconPath)) {
    return nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  }
  return nativeImage.createEmpty();
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }

  mainWindow.show();
  mainWindow.focus();
}

function ensureTray() {
  if (tray) return tray;

  tray = new Tray(createTrayIcon());
  tray.setToolTip("Mnemo");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "打开 Mnemo", click: showMainWindow },
      { type: "separator" },
      {
        label: "退出",
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on("click", showMainWindow);
  return tray;
}

function createWindow() {
  const windowState = loadWindowState();
  const initialPaper =
    windowState?.paperColor && HEX_COLOR_RE.test(windowState.paperColor)
      ? windowState.paperColor
      : "#F2F3F5";
  const initialSurface =
    windowState?.surfaceColor && HEX_COLOR_RE.test(windowState.surfaceColor)
      ? windowState.surfaceColor
      : "#FAFBFC";
  const initialInk =
    windowState?.inkColor && HEX_COLOR_RE.test(windowState.inkColor)
      ? windowState.inkColor
      : "#2A2E32";

  mainWindow = new BrowserWindow({
    width: windowState?.width ?? 1240,
    height: windowState?.height ?? 800,
    x: windowState?.x,
    y: windowState?.y,
    minWidth: 1240,
    minHeight: 800,
    title: "Mnemo",
    icon: getIconPath(),
    show: false,
    backgroundColor: initialPaper,
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: initialSurface,
      symbolColor: initialInk,
      height: 35,
    },
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (!windowState) mainWindow.center();
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
  mainWindow.on("resize", () => mainWindow && saveWindowState(mainWindow));
  mainWindow.on("move", () => mainWindow && saveWindowState(mainWindow));
  mainWindow.on("close", (event) => {
    if (!mainWindow) return;
    saveWindowState(mainWindow);

    if (hasUnsavedChanges && !isQuitting) {
      event.preventDefault();
      mainWindow.webContents.send("app:confirm-close");
      return;
    }

    if (closeBehavior === "tray" && !isQuitting) {
      event.preventDefault();
      ensureTray();
      mainWindow.hide();
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl).catch((error) => {
      console.error("Failed to load dev server:", error);
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html")).catch((error) => {
      console.error("Failed to load packaged renderer:", error);
    });
  }
}

ipcMain.on("window:control", (event, action: "minimize" | "maximize" | "close") => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) return;

  if (action === "minimize") window.minimize();
  if (action === "maximize") {
    if (window.isMaximized()) window.unmaximize();
    else window.maximize();
  }
  if (action === "close") window.close();
});

ipcMain.on(
  "window:titlebar-theme",
  (
    event,
    theme: { color: string; symbolColor: string; paper?: string },
  ) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return;

    window.setTitleBarOverlay({
      color: theme.color,
      symbolColor: theme.symbolColor,
      height: 35,
    });

    // Persist the colors so the next launch can paint them before React loads.
    if (
      HEX_COLOR_RE.test(theme.color) &&
      HEX_COLOR_RE.test(theme.symbolColor) &&
      (!theme.paper || HEX_COLOR_RE.test(theme.paper))
    ) {
      saveThemeColors({
        paper: theme.paper ?? theme.color,
        surface: theme.color,
        ink: theme.symbolColor,
      });
    }
  },
);

ipcMain.handle(
  "window:preferences",
  (_event, preferences: { launchAtLogin: boolean; closeBehavior: "quit" | "tray" }) => {
    closeBehavior = preferences.closeBehavior === "tray" ? "tray" : "quit";
    if (closeBehavior === "tray") ensureTray();
    if (closeBehavior === "quit" && tray) {
      tray.destroy();
      tray = null;
    }

    app.setLoginItemSettings({
      openAtLogin: preferences.launchAtLogin,
      path: process.execPath,
    });

    return { launchAtLogin: app.getLoginItemSettings().openAtLogin };
  },
);

ipcMain.on("app:set-dirty-state", (_event, dirty: boolean) => {
  hasUnsavedChanges = Boolean(dirty);
});

ipcMain.on("app:confirm-close-result", (_event, choice: "discard" | "cancel") => {
  if (!mainWindow) return;
  if (choice === "cancel") return;
  // "discard" proceeds with the close; the renderer is responsible for
  // flushing any pending writes before sending this response.
  hasUnsavedChanges = false;
  if (closeBehavior === "tray" && !isQuitting) {
    ensureTray();
    mainWindow.hide();
  } else {
    isQuitting = true;
    mainWindow.destroy();
  }
});

ipcMain.handle("data:get-location", () => app.getPath("userData"));

function getStatePath() {
  return path.join(app.getPath("userData"), "state.json");
}

function getBackupsDir() {
  return path.join(app.getPath("userData"), "backups");
}

async function writeStateAtomic(content: string) {
  // Write to a sibling `.tmp` file, fsync, then rename. This survives a
  // mid-write crash: either the original state.json is intact or the new one
  // replaces it atomically.
  const statePath = getStatePath();
  const tmpPath = `${statePath}.tmp`;
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  // `wx` refuses to overwrite so any leftover tmp from a previous crash is
  // cleared first.
  await fs.rm(tmpPath, { force: true });
  const handle = await fs.open(tmpPath, "wx");
  try {
    await handle.writeFile(content, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fs.rename(tmpPath, statePath);
}

function writeStateAtomicSync(content: string) {
  // Synchronous variant used during window close to guarantee a pending save
  // lands on disk before the renderer is destroyed. Same atomic pattern.
  const statePath = getStatePath();
  const tmpPath = `${statePath}.tmp`;
  fsSync.mkdirSync(path.dirname(statePath), { recursive: true });
  try {
    fsSync.rmSync(tmpPath, { force: true });
  } catch {
    // ignore
  }
  const fd = fsSync.openSync(tmpPath, "wx");
  try {
    fsSync.writeFileSync(fd, content, "utf8");
    fsSync.fsyncSync(fd);
  } finally {
    fsSync.closeSync(fd);
  }
  fsSync.renameSync(tmpPath, statePath);
}

async function rollingBackup(content: string, max = 7) {
  const dir = getBackupsDir();
  await fs.mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = path.join(dir, `state-${stamp}.json`);
  await fs.writeFile(target, content, "utf8");

  // Keep only the newest `max` auto backups; files outside the pattern are
  // left untouched in case the user put something there.
  try {
    const entries = await fs.readdir(dir);
    const mine = entries
      .filter((name) => /^state-.+\.json$/.test(name))
      .sort()
      .reverse();
    for (const stale of mine.slice(max)) {
      await fs.rm(path.join(dir, stale), { force: true });
    }
  } catch (error) {
    console.warn("Failed to rotate state backups:", error);
  }
}

ipcMain.handle("data:read-state", async (): Promise<{ content: string | null }> => {
  try {
    const content = await fs.readFile(getStatePath(), "utf8");
    // Opportunistic rolling backup: once per 24h we snapshot state.json into
    // backups/ so a corrupted save or accidental clear is recoverable. We key
    // off the file's own mtime to avoid needing another state blob.
    void maybeRollingBackup(content).catch((error) =>
      console.warn("maybeRollingBackup failed:", error),
    );
    return { content };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { content: null };
    console.error("Failed to read state file:", error);
    throw error;
  }
});

async function maybeRollingBackup(currentContent: string) {
  const dir = getBackupsDir();
  const minIntervalMs = 24 * 60 * 60 * 1000;

  let last: number | null = null;
  try {
    const entries = await fs.readdir(dir);
    for (const name of entries) {
      if (!/^state-.+\.json$/.test(name)) continue;
      const full = path.join(dir, name);
      const stat = await fs.stat(full);
      const ts = stat.mtimeMs;
      if (last === null || ts > last) last = ts;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("Failed to inspect backups dir:", error);
    }
  }

  if (last !== null && Date.now() - last < minIntervalMs) return;
  await rollingBackup(currentContent).catch((error) =>
    console.warn("rollingBackup failed:", error),
  );
}

ipcMain.handle(
  "data:write-state",
  async (_event, payload: { content: string; backup?: boolean }) => {
    if (typeof payload?.content !== "string") throw new Error("invalid-state-payload");
    await writeStateAtomic(payload.content);
    if (payload.backup) {
      // Fire-and-forget; a rollover failure should not block the write.
      rollingBackup(payload.content).catch((error) =>
        console.warn("rollingBackup failed:", error),
      );
    }
    return { ok: true as const };
  },
);

// Synchronous sibling used by the close-confirm path so the final flush lands
// before the window is destroyed. The renderer only calls this when shutting
// down; regular mutations go through the async handler above.
ipcMain.on("data:write-state-sync", (event, payload: { content: string }) => {
  try {
    if (typeof payload?.content === "string") {
      writeStateAtomicSync(payload.content);
    }
    event.returnValue = { ok: true };
  } catch (error) {
    console.error("Sync state write failed:", error);
    event.returnValue = { ok: false };
  }
});

ipcMain.handle("data:export-backup", async (_event, payload: { defaultFileName: string; content: string }) => {
  const result = await dialog.showSaveDialog({
    title: "备份 Mnemo 数据",
    defaultPath: payload.defaultFileName,
    filters: [
      { name: "Mnemo Backup", extensions: ["json"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });

  if (result.canceled || !result.filePath) return { canceled: true as const };

  await fs.writeFile(result.filePath, payload.content, "utf8");
  return { canceled: false as const, filePath: result.filePath };
});

ipcMain.handle("data:import-backup", async () => {
  const result = await dialog.showOpenDialog({
    title: "恢复 Mnemo 数据",
    properties: ["openFile"],
    filters: [
      { name: "Mnemo Backup", extensions: ["json"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) return { canceled: true as const };

  const content = await fs.readFile(result.filePaths[0], "utf8");
  return { canceled: false as const, content };
});

ipcMain.handle(
  "notebook:save-image",
  async (
    _event,
    payload: { data: ArrayBuffer | Uint8Array; mimeType: string; suggestedName?: string },
  ): Promise<{ url: string; fileName: string } | { error: string }> => {
    try {
      const mime = (payload.mimeType || "").toLowerCase();
      const extFromMime = ALLOWED_IMAGE_MIME.get(mime);
      const suggestedExt = (payload.suggestedName ?? "").toLowerCase().match(/\.[a-z0-9]{2,5}$/)?.[0];
      const ext =
        extFromMime ??
        (suggestedExt && ALLOWED_IMAGE_EXTENSIONS.has(suggestedExt) ? suggestedExt : null);
      if (!ext) return { error: "unsupported-image-type" };

      const buffer = Buffer.from(payload.data as ArrayBuffer);
      if (buffer.byteLength === 0) return { error: "empty-image" };
      if (buffer.byteLength > 20 * 1024 * 1024) return { error: "image-too-large" };

      const imagesDir = getImagesDir();
      await fs.mkdir(imagesDir, { recursive: true });

      const fileName = `${crypto.randomUUID().replace(/-/g, "")}${ext}`;
      await fs.writeFile(path.join(imagesDir, fileName), buffer);

      return { url: `${IMAGE_SCHEME}://${fileName}`, fileName };
    } catch (error) {
      console.error("Failed to save image:", error);
      return { error: "save-failed" };
    }
  },
);

ipcMain.handle(
  "notebook:read-images",
  async (
    _event,
    fileNames: string[],
  ): Promise<Record<string, string>> => {
    const imagesDir = getImagesDir();
    const result: Record<string, string> = {};
    if (!Array.isArray(fileNames)) return result;

    await Promise.all(
      fileNames.map(async (rawName) => {
        const fileName = String(rawName ?? "");
        if (!safeImageName(fileName)) return;
        const absolute = path.join(imagesDir, fileName);
        if (!absolute.startsWith(imagesDir)) return;
        try {
          const buffer = await fs.readFile(absolute);
          result[fileName] = buffer.toString("base64");
        } catch {
          // skip missing images quietly so backup still succeeds
        }
      }),
    );

    return result;
  },
);

ipcMain.handle(
  "notebook:write-images",
  async (
    _event,
    bundle: Record<string, string>,
  ): Promise<{ written: number }> => {
    if (!bundle || typeof bundle !== "object") return { written: 0 };

    const imagesDir = getImagesDir();
    await fs.mkdir(imagesDir, { recursive: true });
    let written = 0;

    for (const [fileName, base64] of Object.entries(bundle)) {
      if (!safeImageName(fileName) || typeof base64 !== "string") continue;
      const absolute = path.join(imagesDir, fileName);
      if (!absolute.startsWith(imagesDir)) continue;
      if (base64.length > 40 * 1024 * 1024) continue; // hard cap ~30MB raw per image

      try {
        const buffer = Buffer.from(base64, "base64");
        if (buffer.byteLength === 0 || buffer.byteLength > 20 * 1024 * 1024) continue;
        await fs.writeFile(absolute, buffer);
        written += 1;
      } catch (error) {
        console.warn(`Failed to restore image ${fileName}:`, error);
      }
    }

    return { written };
  },
);

ipcMain.handle(
  "notebook:prune-images",
  async (_event, keepNames: string[]): Promise<{ removed: number }> => {
    // Deletes image files inside userData/images that are not in `keepNames`.
    // Used after restoring a backup or clearing data so orphaned blobs do not
    // accumulate indefinitely. Only files whose names pass safeImageName are
    // considered — anything else is left alone.
    const imagesDir = getImagesDir();
    let removed = 0;
    const keep = new Set(Array.isArray(keepNames) ? keepNames.filter(safeImageName) : []);

    let entries: string[] = [];
    try {
      entries = await fs.readdir(imagesDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { removed: 0 };
      console.warn("Failed to list images dir for prune:", error);
      return { removed: 0 };
    }

    await Promise.all(
      entries.map(async (name) => {
        if (!safeImageName(name) || keep.has(name)) return;
        const absolute = path.join(imagesDir, name);
        if (!absolute.startsWith(imagesDir)) return;
        try {
          await fs.unlink(absolute);
          removed += 1;
        } catch (error) {
          // ENOENT races are harmless; log anything else.
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
            console.warn(`Failed to prune image ${name}:`, error);
          }
        }
      }),
    );

    return { removed };
  },
);

ipcMain.handle(
  "notebook:export-markdown",
  async (
    _event,
    payload: {
      defaultFileName: string;
      content: string;
      images?: Record<string, string>;
    },
  ) => {
    const result = await dialog.showSaveDialog({
      title: "导出笔记",
      defaultPath: payload.defaultFileName,
      filters: [
        { name: "Markdown", extensions: ["md"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (result.canceled || !result.filePath) {
      return { canceled: true as const };
    }

    await fs.writeFile(result.filePath, payload.content, "utf8");

    let assetsWritten = 0;
    if (payload.images && Object.keys(payload.images).length > 0) {
      const dir = path.dirname(result.filePath);
      const base = path.basename(result.filePath, path.extname(result.filePath));
      const assetsDir = path.join(dir, `${base}-assets`);
      try {
        await fs.mkdir(assetsDir, { recursive: true });
        for (const [fileName, base64] of Object.entries(payload.images)) {
          if (!safeImageName(fileName) || typeof base64 !== "string") continue;
          const absolute = path.join(assetsDir, fileName);
          if (!absolute.startsWith(assetsDir)) continue;
          if (base64.length > 40 * 1024 * 1024) continue;
          try {
            const buffer = Buffer.from(base64, "base64");
            if (buffer.byteLength === 0 || buffer.byteLength > 20 * 1024 * 1024) continue;
            await fs.writeFile(absolute, buffer);
            assetsWritten += 1;
          } catch (error) {
            console.warn(`Failed to write export asset ${fileName}:`, error);
          }
        }
      } catch (error) {
        console.warn("Failed to create export assets directory:", error);
      }
    }

    return { canceled: false as const, filePath: result.filePath, assetsWritten };
  },
);

app.whenReady().then(() => {
  registerImageProtocol();
  Menu.setApplicationMenu(null);
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  if (closeBehavior !== "tray" && process.platform !== "darwin") app.quit();
});
