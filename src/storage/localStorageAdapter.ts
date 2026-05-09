import { createEmptyAppData, migrateAppData, type StorageAdapter } from "./storageAdapter";

const STORAGE_KEY = "ebbinghaus-desktop-planner:data";

export class LocalStorageAdapter implements StorageAdapter {
  load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyAppData();

    try {
      return migrateAppData(JSON.parse(raw));
    } catch {
      return createEmptyAppData();
    }
  }

  save(data: ReturnType<typeof createEmptyAppData>) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}
