// web/lib/use-profile.ts
"use client";

import { useCallback, useEffect, useState } from "react";

import { api, ApiError, type Profile } from "./api";

// The visitor's Selgo profile. Opening a page that uses this creates the
// profile on first visit (there is no sign-up).
export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setProfile(await api.profile());
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Your profile could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { profile, setProfile, loading, error, refresh };
}
