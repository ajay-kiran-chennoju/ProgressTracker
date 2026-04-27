import { useEffect, useState, useCallback } from "react";
import { ParticipantSlot } from "@workspace/api-client-react";

export interface CurrentUser {
  slot: ParticipantSlot;
  name: string;
  pin: string;
}

const STORAGE_KEY = "tracker.user";

function readFromStorage(): CurrentUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.slot === "string" && typeof parsed.name === "string") {
      return {
        slot: parsed.slot,
        name: parsed.name,
        pin: typeof parsed.pin === "string" ? parsed.pin : "",
      };
    }
  } catch {}
  return null;
}

let currentUser: CurrentUser | null = readFromStorage();
const subscribers = new Set<(u: CurrentUser | null) => void>();

function notify() {
  for (const fn of subscribers) fn(currentUser);
}

export function setCurrentUser(user: CurrentUser | null): void {
  currentUser = user;
  if (user) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
  notify();
}

export function getCurrentUser(): CurrentUser | null {
  return currentUser;
}

export function useCurrentUser() {
  const [user, setUserState] = useState<CurrentUser | null>(currentUser);

  useEffect(() => {
    const sub = (u: CurrentUser | null) => setUserState(u);
    subscribers.add(sub);
    setUserState(currentUser);
    return () => {
      subscribers.delete(sub);
    };
  }, []);

  const setUser = useCallback((newUser: CurrentUser) => {
    setCurrentUser(newUser);
  }, []);

  const clearUser = useCallback(() => {
    setCurrentUser(null);
  }, []);

  const rename = useCallback((newName: string) => {
    if (!currentUser) return;
    setCurrentUser({ ...currentUser, name: newName });
  }, []);

  const updatePin = useCallback((newPin: string) => {
    if (!currentUser) return;
    setCurrentUser({ ...currentUser, pin: newPin });
  }, []);

  return { user, setUser, clearUser, rename, updatePin };
}
