import { app, BrowserWindow, Menu, Tray, dialog, ipcMain, nativeImage, shell } from "electron";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let closeBehavior: "quit" | "tray" = "quit";
let isQuitting = false;

if (app.isPackaged) {
  app.setPath("userData", path.resolve(process.resourcesPath, "..", "user-data"));
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
    fsSync.writeFileSync(getWindowStatePath(), JSON.stringify(window.getBounds(), null, 2));
  } catch {
    // Window state is a convenience; failures should not affect the app.
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
  mainWindow = new BrowserWindow({
    width: windowState?.width ?? 1240,
    height: windowState?.height ?? 800,
    x: windowState?.x,
    y: windowState?.y,
    minWidth: 1240,
    minHeight: 800,
    title: "Mnemo",
    icon: getIconPath(),
    backgroundColor: "#F2F3F5",
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#FAFBFC",
      symbolColor: "#2A2E32",
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
  mainWindow.show();
  mainWindow.focus();
  mainWindow.on("resize", () => mainWindow && saveWindowState(mainWindow));
  mainWindow.on("move", () => mainWindow && saveWindowState(mainWindow));
  mainWindow.on("close", (event) => {
    if (!mainWindow) return;
    saveWindowState(mainWindow);

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
  (event, theme: { color: string; symbolColor: string }) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return;

    window.setTitleBarOverlay({
      color: theme.color,
      symbolColor: theme.symbolColor,
      height: 35,
    });
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

ipcMain.handle("data:get-location", () => app.getPath("userData"));

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
  "notebook:export-markdown",
  async (_event, payload: { defaultFileName: string; content: string }) => {
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
    return { canceled: false as const, filePath: result.filePath };
  },
);

app.whenReady().then(() => {
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
