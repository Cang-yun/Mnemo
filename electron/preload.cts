import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("ebbinghausDesktop", {
  platform: process.platform,
  controlWindow: (action: "minimize" | "maximize" | "close") => {
    ipcRenderer.send("window:control", action);
  },
  setTitleBarTheme: (theme: { color: string; symbolColor: string }) => {
    ipcRenderer.send("window:titlebar-theme", theme);
  },
  setWindowPreferences: (preferences: {
    launchAtLogin: boolean;
    closeBehavior: "quit" | "tray";
  }) => ipcRenderer.invoke("window:preferences", preferences),
  exportMarkdown: (payload: { defaultFileName: string; content: string }) =>
    ipcRenderer.invoke("notebook:export-markdown", payload),
  getDataLocation: () => ipcRenderer.invoke("data:get-location"),
  exportBackup: (payload: { defaultFileName: string; content: string }) =>
    ipcRenderer.invoke("data:export-backup", payload),
  importBackup: () => ipcRenderer.invoke("data:import-backup"),
});
