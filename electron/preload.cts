import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("ebbinghausDesktop", {
  platform: process.platform,
  controlWindow: (action: "minimize" | "maximize" | "close") => {
    ipcRenderer.send("window:control", action);
  },
  setTitleBarTheme: (theme: { color: string; symbolColor: string; paper?: string }) => {
    ipcRenderer.send("window:titlebar-theme", theme);
  },
  setWindowPreferences: (preferences: {
    launchAtLogin: boolean;
    closeBehavior: "quit" | "tray";
  }) => ipcRenderer.invoke("window:preferences", preferences),
  setDirtyState: (dirty: boolean) => {
    ipcRenderer.send("app:set-dirty-state", dirty);
  },
  onConfirmClose: (listener: () => void) => {
    const handler = () => listener();
    ipcRenderer.on("app:confirm-close", handler);
    return () => ipcRenderer.removeListener("app:confirm-close", handler);
  },
  respondConfirmClose: (choice: "discard" | "cancel") => {
    ipcRenderer.send("app:confirm-close-result", choice);
  },
  exportMarkdown: (payload: {
    defaultFileName: string;
    content: string;
    images?: Record<string, string>;
  }) => ipcRenderer.invoke("notebook:export-markdown", payload),
  saveImage: (payload: { data: ArrayBuffer; mimeType: string; suggestedName?: string }) =>
    ipcRenderer.invoke("notebook:save-image", payload),
  readImages: (fileNames: string[]) => ipcRenderer.invoke("notebook:read-images", fileNames),
  writeImages: (bundle: Record<string, string>) =>
    ipcRenderer.invoke("notebook:write-images", bundle),
  pruneImages: (keepNames: string[]) =>
    ipcRenderer.invoke("notebook:prune-images", keepNames),
  getDataLocation: () => ipcRenderer.invoke("data:get-location"),
  readState: () => ipcRenderer.invoke("data:read-state"),
  writeState: (payload: { content: string; backup?: boolean }) =>
    ipcRenderer.invoke("data:write-state", payload),
  writeStateSync: (content: string) =>
    ipcRenderer.sendSync("data:write-state-sync", { content }),
  exportBackup: (payload: { defaultFileName: string; content: string }) =>
    ipcRenderer.invoke("data:export-backup", payload),
  importBackup: () => ipcRenderer.invoke("data:import-backup"),
});
