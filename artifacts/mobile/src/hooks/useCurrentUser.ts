import { useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ParticipantSlot = 'A' | 'B';

export interface CurrentUser {
  slot: ParticipantSlot;
  name: string;
  pin: string;
}

const STORAGE_KEY = "tracker.user";

let currentUser: CurrentUser | null = null;
const subscribers = new Set<(u: CurrentUser | null) => void>();

function notify() {
  for (const fn of subscribers) fn(currentUser);
}

// Initial load
AsyncStorage.getItem(STORAGE_KEY).then(raw => {
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      currentUser = parsed;
      notify();
    } catch {}
  }
});

export function setCurrentUser(user: CurrentUser | null): void {
  currentUser = user;
  if (user) {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } else {
    AsyncStorage.removeItem(STORAGE_KEY);
  }
  notify();
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
