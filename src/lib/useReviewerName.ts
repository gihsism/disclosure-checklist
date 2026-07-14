"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "disclosure.reviewerName";

/**
 * Remembers the reviewer's name across sign-offs and sessions (per browser).
 *
 * Sign-off is per checklist item, so without this the reviewer would retype
 * their name on every approval. The name is set once and reused everywhere:
 * approvals fall back to it, and typing a name anywhere updates the default.
 */
export function useReviewerName(): [string, (name: string) => void] {
  const [name, setName] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setName(stored);
    } catch {
      // localStorage unavailable (private mode / SSR) — fall back to in-memory.
    }
  }, []);

  const update = useCallback((value: string) => {
    setName(value);
    try {
      if (value.trim()) {
        localStorage.setItem(STORAGE_KEY, value);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Ignore persistence failures — the name still works for this session.
    }
  }, []);

  return [name, update];
}
