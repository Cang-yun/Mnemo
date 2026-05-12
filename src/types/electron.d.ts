export {};

declare global {
  interface Window {
    ebbinghausDesktop?: {
      platform: string;
      controlWindow(action: "minimize" | "maximize" | "close"): void;
      setTitleBarTheme(theme: { color: string; symbolColor: string; paper?: string }): void;
      setWindowPreferences(preferences: {
        launchAtLogin: boolean;
        closeBehavior: "quit" | "tray";
      }): Promise<{ launchAtLogin: boolean }>;
      setDirtyState(dirty: boolean): void;
      onConfirmClose(listener: () => void): () => void;
      respondConfirmClose(choice: "discard" | "cancel"): void;
      exportMarkdown(payload: {
        defaultFileName: string;
        content: string;
        images?: Record<string, string>;
      }): Promise<
        | { canceled: true }
        | { canceled: false; filePath: string; assetsWritten?: number }
      >;
      saveImage(payload: {
        data: ArrayBuffer;
        mimeType: string;
        suggestedName?: string;
      }): Promise<{ url: string; fileName: string } | { error: string }>;
      readImages(fileNames: string[]): Promise<Record<string, string>>;
      writeImages(bundle: Record<string, string>): Promise<{ written: number }>;
      pruneImages(keepNames: string[]): Promise<{ removed: number }>;
      getDataLocation(): Promise<string>;
      readState(): Promise<{ content: string | null }>;
      writeState(payload: {
        content: string;
        backup?: boolean;
      }): Promise<{ ok: true }>;
      writeStateSync(content: string): { ok: boolean };
      exportBackup(payload: {
        defaultFileName: string;
        content: string;
      }): Promise<{ canceled: true } | { canceled: false; filePath: string }>;
      importBackup(): Promise<{ canceled: true } | { canceled: false; content: string }>;
      cloudTestConnection(config: {
        url: string;
        username: string;
        password: string;
      }): Promise<{ ok: true } | { ok: false; error: string }>;
      cloudFetchRemote(config: {
        url: string;
        username: string;
        password: string;
      }): Promise<
        | { ok: true; data: unknown }
        | { ok: false; error: string; notFound?: boolean }
      >;
      cloudUpload(payload: {
        url: string;
        username: string;
        password: string;
        content: string;
        images?: Record<string, string>;
      }): Promise<{ ok: true } | { ok: false; error: string }>;
      cloudRestore(config: {
        url: string;
        username: string;
        password: string;
      }): Promise<
        | { ok: true; content: string; images: Record<string, string> }
        | { ok: false; error: string }
      >;
    };
  }
}
