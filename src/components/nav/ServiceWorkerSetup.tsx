"use client";

import { useEffect } from "react";

/**
 * Registers the service worker (push receiver + PWA installability) and, if
 * this device already granted notification permission, quietly re-syncs its
 * push subscription so a cleared browser store re-enrolls itself.
 */
export function ServiceWorkerSetup() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        if (
          !("PushManager" in window) ||
          Notification.permission !== "granted"
        ) {
          return;
        }
        const existing = await reg.pushManager.getSubscription();
        if (existing) {
          await fetch("/api/push", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(existing.toJSON()),
          });
        }
      } catch {
        // Push is progressive enhancement — never break the page over it.
      }
    })();
  }, []);

  return null;
}
