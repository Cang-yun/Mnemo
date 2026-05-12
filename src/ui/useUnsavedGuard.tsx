import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { getDirtyRegistration } from "../storage/unsavedGuard";
import { UnsavedChangesDialog, type UnsavedChoice } from "./UnsavedChangesDialog";

interface GuardOptions {
  allowSave?: boolean;
}

interface GuardContextValue {
  runGuarded(action: () => void | Promise<void>, options?: GuardOptions): Promise<boolean>;
}

const GuardContext = createContext<GuardContextValue | null>(null);

interface PendingRequest {
  label: string;
  allowSave: boolean;
  resolve(choice: UnsavedChoice): void;
}

interface UnsavedGuardProviderProps {
  children: React.ReactNode;
}

export function UnsavedGuardProvider({ children }: UnsavedGuardProviderProps) {
  const [pending, setPending] = useState<PendingRequest | null>(null);
  const pendingRef = useRef<PendingRequest | null>(null);
  pendingRef.current = pending;

  const askUser = useCallback((label: string, allowSave: boolean) => {
    return new Promise<UnsavedChoice>((resolve) => {
      setPending({ label, allowSave, resolve });
    });
  }, []);

  const runGuarded = useCallback(
    async (action: () => void | Promise<void>, options?: GuardOptions) => {
      const dirty = getDirtyRegistration();
      if (!dirty) {
        await action();
        return true;
      }

      const allowSave = options?.allowSave !== false;
      const choice = await askUser(dirty.label, allowSave);
      setPending(null);

      if (choice === "cancel") return false;
      if (choice === "save" && allowSave) {
        dirty.flush();
        // Yield so the setState from flush() gets committed and the storage
        // write inside the updater runs before we continue.
        await new Promise((r) => setTimeout(r, 0));
      }
      if (choice === "discard") dirty.discard();

      await action();
      return true;
    },
    [askUser],
  );

  const value = useMemo<GuardContextValue>(() => ({ runGuarded }), [runGuarded]);

  function handleChoose(choice: UnsavedChoice) {
    const current = pendingRef.current;
    if (!current) return;
    current.resolve(choice);
    setPending(null);
  }

  return (
    <GuardContext.Provider value={value}>
      {children}
      <UnsavedChangesDialog
        open={pending !== null}
        label={pending?.label ?? ""}
        allowSave={pending?.allowSave ?? true}
        onChoose={handleChoose}
      />
    </GuardContext.Provider>
  );
}

export function useUnsavedGuard(): GuardContextValue {
  const ctx = useContext(GuardContext);
  if (!ctx) {
    return {
      async runGuarded(action) {
        await action();
        return true;
      },
    };
  }
  return ctx;
}
