export {};

declare global {
  interface Window {
    ebbinghausDesktop?: {
      platform: string;
      controlWindow(action: "minimize" | "maximize" | "close"): void;
      setTitleBarTheme(theme: { color: string; symbolColor: string }): void;
      setWindowPreferences(preferences: {
        launchAtLogin: boolean;
        closeBehavior: "quit" | "tray";
      }): Promise<{ launchAtLogin: boolean }>;
      exportMarkdown(payload: {
        defaultFileName: string;
        content: string;
      }): Promise<{ canceled: true } | { canceled: false; filePath: string }>;
      getDataLocation(): Promise<string>;
      exportBackup(payload: {
        defaultFileName: string;
        content: string;
      }): Promise<{ canceled: true } | { canceled: false; filePath: string }>;
      importBackup(): Promise<{ canceled: true } | { canceled: false; content: string }>;
    };
  }
}
