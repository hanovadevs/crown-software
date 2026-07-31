"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function LiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    const events = new EventSource("/api/events");
    const refresh = () => router.refresh();
    events.addEventListener("update", refresh);
    return () => {
      events.removeEventListener("update", refresh);
      events.close();
    };
  }, [router]);

  return null;
}
