// Lightweight registry that lets MarkdownEditor instances advertise whether
// they have unsaved changes, and lets the shell orchestrate "save / discard /
// cancel" before navigating away. The UI guarantees only one editor can be
// mounted with unsaved state at a time (KnowledgePanel allows only a single
// expanded item), so a single dirty registration is all we need to track.

export interface EditorRegistration {
  id: string;
  dirty: boolean;
  label: string;
  flush: () => void;
  discard: () => void;
}

type Listener = () => void;

const registrations = new Map<string, EditorRegistration>();
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) listener();
}

export function registerEditor(id: string, registration: Omit<EditorRegistration, "id">) {
  registrations.set(id, { id, ...registration });
  notify();
}

export function unregisterEditor(id: string) {
  if (registrations.delete(id)) notify();
}

export function updateEditor(id: string, patch: Partial<Omit<EditorRegistration, "id">>) {
  const current = registrations.get(id);
  if (!current) return;
  const next = { ...current, ...patch };
  registrations.set(id, next);
  notify();
}

export function getDirtyRegistration(): EditorRegistration | null {
  for (const reg of registrations.values()) {
    if (reg.dirty) return reg;
  }
  return null;
}

export function hasAnyDirty(): boolean {
  return getDirtyRegistration() !== null;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
