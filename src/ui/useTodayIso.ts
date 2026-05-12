import { useEffect, useState } from "react";
import { todayIso } from "../domain/date";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
// After a timer fires we wait a tiny bit and reconcile with wall-clock time.
// This guards against timer drift caused by sleep/suspend resumes that often
// fire the timeout a few ms late and could otherwise observe the previous day.
const DRIFT_GUARD_MS = 250;

function millisecondsUntilNextMidnight(now = new Date()) {
  const next = new Date(now);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() + 1);
  const delay = next.getTime() - now.getTime();
  // Clamp to a sane range: never schedule in the past, and cap at 24h to
  // recover if the system clock jumped backwards.
  if (!Number.isFinite(delay) || delay <= 0) return DRIFT_GUARD_MS;
  return Math.min(delay, MS_PER_DAY);
}

/**
 * Returns the current local ISO date and keeps it fresh across midnight
 * rollovers, sleep/resume and tab visibility changes.
 *
 * Consumers that derive "today" from state (e.g. the schedule store) should
 * read this hook so their memoized views re-run when the day flips, even if
 * no user input or other state change has happened.
 */
export function useTodayIso() {
  const [today, setToday] = useState(() => todayIso());

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const reconcile = () => {
      if (cancelled) return;
      const next = todayIso();
      setToday((previous) => (previous === next ? previous : next));
    };

    const scheduleNext = () => {
      if (cancelled) return;
      if (timeoutId !== null) clearTimeout(timeoutId);
      const delay = millisecondsUntilNextMidnight();
      timeoutId = setTimeout(() => {
        // Give the clock a brief moment to cross midnight before sampling —
        // some platforms fire setTimeout a few ms early.
        setTimeout(() => {
          reconcile();
          scheduleNext();
        }, DRIFT_GUARD_MS);
      }, delay);
    };

    const handleVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      reconcile();
      scheduleNext();
    };

    const handleFocus = () => {
      reconcile();
      scheduleNext();
    };

    scheduleNext();

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibility);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("focus", handleFocus);
    }

    return () => {
      cancelled = true;
      if (timeoutId !== null) clearTimeout(timeoutId);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibility);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", handleFocus);
      }
    };
  }, []);

  return today;
}
