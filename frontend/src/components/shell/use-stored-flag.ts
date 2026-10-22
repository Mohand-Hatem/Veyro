import { useSyncExternalStore } from "react";

/** A boolean kept in localStorage (device preference). Server and first client render use `false`, so hydration matches. */
export function useStoredFlag(key: string): [boolean, (v: boolean) => void] {
  const event = `flag:${key}`;
  const subscribe = (cb: () => void) => {
    window.addEventListener("storage", cb);
    window.addEventListener(event, cb);
    return () => {
      window.removeEventListener("storage", cb);
      window.removeEventListener(event, cb);
    };
  };
  const read = () => {
    try {
      return localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  };
  const value = useSyncExternalStore(subscribe, read, () => false);
  const set = (v: boolean) => {
    try {
      localStorage.setItem(key, v ? "1" : "0");
    } catch {
      /* storage unavailable: the flag just will not persist */
    }
    window.dispatchEvent(new Event(event));
  };
  return [value, set];
}
