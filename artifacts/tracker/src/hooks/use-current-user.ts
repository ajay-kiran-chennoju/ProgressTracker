import { useState, useCallback } from "react";
import { ParticipantSlot } from "@workspace/api-client-react";

export interface CurrentUser {
  slot: ParticipantSlot;
  name: string;
}

export function useCurrentUser() {
  const [user, setUserState] = useState<CurrentUser | null>(() => {
    const stored = localStorage.getItem("tracker.user");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const setUser = useCallback((newUser: CurrentUser) => {
    localStorage.setItem("tracker.user", JSON.stringify(newUser));
    setUserState(newUser);
  }, []);

  const clearUser = useCallback(() => {
    localStorage.removeItem("tracker.user");
    setUserState(null);
  }, []);

  const rename = useCallback((newName: string) => {
    setUserState((prev) => {
      if (!prev) return null;
      const updated = { ...prev, name: newName };
      localStorage.setItem("tracker.user", JSON.stringify(updated));
      return updated;
    });
  }, []);

  return { user, setUser, clearUser, rename };
}
