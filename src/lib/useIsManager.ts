"use client";

import { useEffect, useState } from "react";

/** UI-only role gate (the Cores enforce the real permission from x-ei-actor-role). */
export function useIsManager(): boolean {
  const [isManager, setIsManager] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? (res.json() as Promise<{ staff?: { role?: string } | null }>) : null))
      .then((me) => {
        if (alive) setIsManager(me?.staff?.role === "manager");
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return isManager;
}
