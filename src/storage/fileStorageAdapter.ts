import { createEmptyAppData, migrateAppData } from "./storageAdapter";
import type { AppData } from "../domain/types";

/**
 * Persists AppData to `<userData>/state.json` via Electron IPC.
 *
 * Unlike the old localStorage adapter there is no ~10MB cap, and writes are
 * atomic (tmp + rename in the main process). Legacy localStorage data from
 * previous versions is not touched here — users who upgrade from a pre-file
 * build should run the standalone migration script shipped alongside the app
 * (see scripts/migrate-legacy-storage.mjs) before their first launch.
 */
export class FileStorageAdapter {
  private readonly api = window.ebbinghausDesktop;

  async load(): Promise<AppData> {
    if (!this.api?.readState) {
      // Browser (no Electron) fallback: keep dev mode without IPC usable by
      // reading the localStorage mirror written by save().
      return this.loadFromBrowserMirror();
    }

    try {
      const { content } = await this.api.readState();
      if (typeof content === "string" && content.length > 0) {
        return migrateAppData(JSON.parse(content));
      }
    } catch (error) {
      console.error("Failed to read state.json:", error);
    }

    return createEmptyAppData();
  }

  async save(data: AppData): Promise<void> {
    const serialized = JSON.stringify(data);
    if (!this.api?.writeState) {
      // Browser fallback: mirror to localStorage so `npm run dev` keeps
      // working. Desktop users never hit this path.
      localStorage.setItem(BROWSER_MIRROR_KEY, serialized);
      return;
    }

    await this.api.writeState({ content: serialized });
  }

  /**
   * Synchronous flush used only from the close-confirm path. Returns true if
   * the state was safely written. No-op (returns true) in the browser fallback
   * because there is no window destruction to race against.
   */
  saveSync(data: AppData): boolean {
    if (!this.api?.writeStateSync) {
      try {
        localStorage.setItem(BROWSER_MIRROR_KEY, JSON.stringify(data));
        return true;
      } catch {
        return false;
      }
    }
    try {
      const result = this.api.writeStateSync(JSON.stringify(data));
      return Boolean(result?.ok);
    } catch (error) {
      console.error("Sync save failed:", error);
      return false;
    }
  }

  private loadFromBrowserMirror(): AppData {
    try {
      const raw = localStorage.getItem(BROWSER_MIRROR_KEY);
      if (!raw) return createEmptyAppData();
      return migrateAppData(JSON.parse(raw));
    } catch {
      return createEmptyAppData();
    }
  }
}

const BROWSER_MIRROR_KEY = "mnemo:state";
