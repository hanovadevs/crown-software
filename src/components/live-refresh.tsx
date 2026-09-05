"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export function LiveRefresh() {
  const router = useRouter();
  const retryCount = useRef(0);

  useEffect(() => {
    let events: EventSource | null = null;
    let timer: NodeJS.Timeout | null = null;
    let unmounted = false;

    const connect = () => {
      if (unmounted) return;
      try {
        events = new EventSource("/api/events");

        events.addEventListener("update", () => {
          retryCount.current = 0;
          router.refresh();
        });

        events.onerror = () => {
          if (events) {
            events.close();
            events = null;
          }
          if (unmounted) return;
          // Exponential backoff
          retryCount.current += 1;
          if (retryCount.current > 6) {
            // Back off completely after 6 failures to protect the connection pool
            return;
          }
          const delay = Math.min(1000 * Math.pow(2, retryCount.current), 30000);
          timer = setTimeout(connect, delay);
        };
      } catch {
        // EventSource not supported
      }
    };

    connect();

    return () => {
      unmounted = true;
      if (timer) clearTimeout(timer);
      if (events) {
        events.close();
      }
    };
  }, [router]);

  return null;
}
