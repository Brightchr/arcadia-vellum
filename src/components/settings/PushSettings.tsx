"use client";

import { useEffect, useState } from "react";

type Status =
  | "loading"
  | "unsupported"
  | "server-off"
  | "denied"
  | "off"
  | "on";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const arr = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/**
 * Device notifications: enroll or remove THIS browser/device for push
 * (mentions, group invites, friend requests). Per-device by design — enable
 * it on your PC and your phone separately.
 */
export function PushSettings() {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        setStatus("unsupported");
        return;
      }
      const { key } = await fetch("/api/push")
        .then((r) => r.json())
        .catch(() => ({ key: null }));
      if (!key) {
        setStatus("server-off");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub && Notification.permission === "granted" ? "on" : "off");
    })();
  }, []);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      const { key } = await fetch("/api/push").then((r) => r.json());
      if (!key) {
        setStatus("server-off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        }));
      const res = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error("subscribe failed");
      setStatus("on");
    } catch {
      setError("Could not enable notifications on this device.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus("off");
    } catch {
      setError("Could not disable notifications.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel-arcane p-6 space-y-3">
      <h2 className="font-heading text-lg">Device Notifications</h2>
      <p className="text-sm text-ink-dim">
        Get alerted on this device when someone @mentions you, invites you to
        a group, or sends a friend request — even when Vellum isn&apos;t open.
        Enable it separately on each device you use.
      </p>
      {status === "loading" && (
        <p className="text-sm text-ink-dim">Checking this device…</p>
      )}
      {status === "unsupported" && (
        <p className="text-sm text-ink-dim italic">
          This browser doesn&apos;t support push notifications.
        </p>
      )}
      {status === "server-off" && (
        <p className="text-sm text-ink-dim italic">
          Push notifications aren&apos;t configured on this server yet.
        </p>
      )}
      {status === "denied" && (
        <p className="text-sm text-ink-dim italic">
          Notifications are blocked for this site — allow them in your
          browser&apos;s site settings, then come back here.
        </p>
      )}
      {status === "off" && (
        <button
          type="button"
          className="btn-arcane"
          disabled={busy}
          onClick={() => void enable()}
        >
          {busy ? "Enabling…" : "Enable on This Device"}
        </button>
      )}
      {status === "on" && (
        <div className="flex items-center gap-3">
          <p className="text-sm text-emerald-400">
            Notifications are on for this device.
          </p>
          <button
            type="button"
            className="btn-ghost text-xs px-3 py-1.5"
            disabled={busy}
            onClick={() => void disable()}
          >
            Turn Off
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </section>
  );
}
