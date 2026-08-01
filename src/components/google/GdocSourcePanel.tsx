"use client";

import { useEffect, useState } from "react";
import { authClient, DRIVE_FILE_SCOPE } from "@/lib/auth-client";
import { loadPickerApi, openDocPicker } from "@/lib/google/picker-client";

export interface PickedDoc {
  id: string;
  name: string;
}

type LinkState = "loading" | "unlinked" | "linked";

/**
 * Google Doc source selection: connect Google Drive (incremental drive.file
 * scope via account linking), then pick a document with the Google Picker.
 */
export function GdocSourcePanel({
  googleEnabled,
  picked,
  onPick,
}: {
  googleEnabled: boolean;
  picked: PickedDoc | null;
  onPick: (doc: PickedDoc | null) => void;
}) {
  const [linkState, setLinkState] = useState<LinkState>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!googleEnabled) return;
    // Surface OAuth errors Better Auth appends to the callback URL.
    const oauthError = new URLSearchParams(window.location.search).get("error");
    if (oauthError) {
      setError(`Google linking failed: ${oauthError.replaceAll("_", " ")}`);
    }
    let cancelled = false;
    (async () => {
      try {
        const accounts = await authClient.listAccounts();
        if (cancelled) return;
        const google = (accounts.data ?? []).find(
          (a: { provider?: string; providerId?: string }) =>
            (a.providerId ?? a.provider) === "google"
        );
        const hasDrive = (
          google as { scopes?: string[] } | undefined
        )?.scopes?.some((s) => s.includes("drive.file"));
        setLinkState(google && hasDrive ? "linked" : "unlinked");
      } catch {
        if (!cancelled) setLinkState("unlinked");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [googleEnabled]);

  if (!googleEnabled) {
    return (
      <div className="border border-dashed border-void-border rounded-lg p-6 text-center text-sm text-ink-dim">
        Google integration is not configured on this server yet. Add the Google
        Cloud credentials to enable linking Docs, or upload a file instead.
      </div>
    );
  }

  async function connectDrive() {
    setBusy(true);
    setError(null);
    try {
      await authClient.linkSocial({
        provider: "google",
        scopes: [DRIVE_FILE_SCOPE],
        callbackURL: window.location.href,
      });
    } catch {
      setError("Could not start the Google connection. Try again.");
      setBusy(false);
    }
  }

  async function chooseDoc() {
    setBusy(true);
    setError(null);
    try {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
      const projectNumber = process.env.NEXT_PUBLIC_GOOGLE_PROJECT_NUMBER;
      if (!apiKey || !projectNumber) {
        setError(
          "The Google Picker isn't configured (missing API key or project number)."
        );
        return;
      }
      const token = await authClient.getAccessToken({ providerId: "google" });
      const accessToken = token.data?.accessToken;
      if (!accessToken) {
        setError("Couldn't get Google access. Try reconnecting your account.");
        setLinkState("unlinked");
        return;
      }
      await loadPickerApi();
      openDocPicker({
        accessToken,
        apiKey,
        projectNumber,
        onPicked: onPick,
      });
    } catch {
      setError("Something went wrong opening the Google Picker.");
    } finally {
      setBusy(false);
    }
  }

  if (picked) {
    return (
      <div className="border border-void-border rounded-lg p-4 flex items-center justify-between gap-3">
        <div className="text-sm">
          <p className="font-medium">{picked.name}</p>
          <p className="text-ink-dim text-xs">Google Doc linked</p>
        </div>
        <button
          type="button"
          className="btn-ghost text-xs px-3 py-1.5"
          onClick={() => onPick(null)}
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="border border-dashed border-void-border rounded-lg p-6 text-center space-y-3">
      {linkState === "loading" && (
        <p className="text-sm text-ink-dim">Checking your Google link...</p>
      )}

      {linkState === "unlinked" && (
        <>
          <p className="text-sm text-ink-dim">
            Connect Google Drive so the tome can read your journal document.
            You&apos;ll choose exactly which document to share — nothing else is
            accessible.
          </p>
          <button
            type="button"
            className="btn-arcane"
            disabled={busy}
            onClick={connectDrive}
          >
            {busy ? "Connecting..." : "Connect Google Drive"}
          </button>
        </>
      )}

      {linkState === "linked" && (
        <>
          <p className="text-sm text-ink-dim">
            Pick the Google Doc that holds your journal.
          </p>
          <button
            type="button"
            className="btn-arcane"
            disabled={busy}
            onClick={chooseDoc}
          >
            {busy ? "Opening Picker..." : "Choose a Google Doc"}
          </button>
        </>
      )}

      {error && (
        <p className="text-red-400 text-sm" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
