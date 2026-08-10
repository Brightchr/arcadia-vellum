"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  customThemeCss,
  parseThemeConfig,
  STARTER_THEME_CONFIG,
  type CustomThemeConfig,
} from "@/lib/theme-css";
import {
  AMBIENCE_PRESETS,
  THEME_FONTS,
  THEME_ORNAMENTS,
  THEME_TEXTURES,
} from "@/lib/theme-assets";
import { TomeAmbience } from "@/components/book/TomeAmbience";
import { ThemePreview } from "@/components/wizard/ThemePreview";

interface ThemeRow {
  id: string;
  name: string;
  config: string;
}

const PREVIEW_CLASS = "theme-live-preview";

function ColorField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-ink-dim">{label}</span>
      <input
        type="color"
        className="h-8 w-12 shrink-0 rounded border border-void-border bg-transparent cursor-pointer"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function FontField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-ink-dim">{label}</span>
      <select
        className="input-arcane !w-36 !py-1.5 text-sm"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {THEME_FONTS.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextureField({
  label,
  value,
  imageId,
  onChange,
  onUpload,
  onClearImage,
  disabled,
}: {
  label: string;
  value: string;
  imageId: string | null | undefined;
  onChange: (v: string) => void;
  onUpload: (f: File) => void;
  onClearImage: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span className="text-ink-dim">{label}</span>
      <div className="flex items-center gap-2">
        {imageId ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/avatars/${imageId}`}
              alt="Custom texture"
              className="h-8 w-8 rounded border border-void-border object-cover"
            />
            <button
              type="button"
              className="btn-ghost text-xs px-2 py-1"
              disabled={disabled}
              onClick={onClearImage}
            >
              ⨯ custom
            </button>
          </>
        ) : (
          <>
            <select
              className="input-arcane !w-36 !py-1.5 text-sm"
              value={value}
              disabled={disabled}
              onChange={(e) => onChange(e.target.value)}
            >
              {THEME_TEXTURES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <label
              className="btn-ghost text-xs px-2 py-1 cursor-pointer"
              title="Upload a tiling texture image (semi-transparent PNGs tint best)"
            >
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={disabled}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUpload(f);
                  e.target.value = "";
                }}
              />
              Upload
            </label>
          </>
        )}
      </div>
    </div>
  );
}

export function ThemeBuilder({ initialThemes }: { initialThemes: ThemeRow[] }) {
  const router = useRouter();
  const [themes, setThemes] = useState(initialThemes);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialThemes[0]?.id ?? null
  );
  const [name, setName] = useState(initialThemes[0]?.name ?? "My Theme");
  const [config, setConfig] = useState<CustomThemeConfig>(() =>
    initialThemes[0]
      ? (parseThemeConfig(initialThemes[0].config) ?? STARTER_THEME_CONFIG)
      : STARTER_THEME_CONFIG
  );
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const css = useMemo(() => customThemeCss(PREVIEW_CLASS, config), [config]);

  function set<K extends keyof CustomThemeConfig>(
    key: K,
    value: CustomThemeConfig[K]
  ) {
    setConfig((c) => ({ ...c, [key]: value }));
    setDirty(true);
    setNotice(null);
  }

  function open(row: ThemeRow | null) {
    if (dirty && !window.confirm("Discard unsaved changes to this theme?")) {
      return;
    }
    setError(null);
    setNotice(null);
    setDirty(false);
    if (row) {
      setSelectedId(row.id);
      setName(row.name);
      setConfig(parseThemeConfig(row.config) ?? STARTER_THEME_CONFIG);
    } else {
      setSelectedId(null);
      setName(`My Theme ${themes.length + 1}`);
      setConfig(STARTER_THEME_CONFIG);
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(
        selectedId ? `/api/themes/${selectedId}` : "/api/themes",
        {
          method: selectedId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, config }),
        }
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Could not save the theme.");
        return;
      }
      const saved = body.theme as ThemeRow;
      setThemes((list) => {
        const i = list.findIndex((t) => t.id === saved.id);
        if (i === -1) return [...list, saved];
        const next = [...list];
        next[i] = saved;
        return next;
      });
      setSelectedId(saved.id);
      setDirty(false);
      setNotice("Theme saved.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!selectedId) return;
    if (
      !window.confirm(
        `Delete "${name}"? Tomes wearing it fall back to the default theme.`
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/themes/${selectedId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setError("Could not delete the theme.");
        return;
      }
      const remaining = themes.filter((t) => t.id !== selectedId);
      setThemes(remaining);
      setDirty(false);
      if (remaining[0]) {
        setSelectedId(remaining[0].id);
        setName(remaining[0].name);
        setConfig(parseThemeConfig(remaining[0].config) ?? STARTER_THEME_CONFIG);
      } else {
        setSelectedId(null);
        setName("My Theme");
        setConfig(STARTER_THEME_CONFIG);
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function uploadTexture(
    file: File,
    key: "pageTextureImageId" | "coverTextureImageId"
  ) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch("/api/themes/texture", {
        method: "POST",
        body: form,
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Texture upload failed.");
        return;
      }
      set(key, body.id as string);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
      {/* Live preview — first on mobile so changes are always in view */}
      <div className="order-1 lg:order-2 lg:sticky lg:top-6 self-start min-w-0">
        <style dangerouslySetInnerHTML={{ __html: css }} />
        <div
          className={`${PREVIEW_CLASS} tome-scene relative overflow-hidden rounded-xl border border-void-border p-4 sm:p-6`}
        >
          <TomeAmbience />
          <div className="relative z-10 grid gap-4 sm:grid-cols-[minmax(0,11rem)_1fr] items-center">
            <div className="aspect-[7/10] w-full max-w-44 mx-auto sm:mx-0">
              <div className="tome-cover rounded-md overflow-hidden">
                <div className="tome-cover-ornament tome-cover-ornament--front" />
                <h1 className="tome-cover-title !text-xl">{name || "Your Theme"}</h1>
                <hr className="tome-cover-rule" />
                <p className="tome-cover-subtitle !text-[0.65rem]">
                  A living preview
                </p>
                <p className="tome-cover-author !bottom-8 !text-[0.65rem]">
                  Eveline Veyr
                </p>
              </div>
            </div>
            <ThemePreview themeId="live-preview" sampleName="Eveline" />
          </div>
        </div>
        <p className="text-xs text-ink-dim mt-2">
          The backdrop, drifting glyphs, and rising motes are the ambience —
          pick a different scene below.
        </p>
      </div>

      {/* Controls */}
      <div className="order-2 lg:order-1 space-y-4 min-w-0">
        {(notice || error) && (
          <p
            className={`text-sm ${error ? "text-red-400" : "text-ember"}`}
            role="status"
          >
            {error ?? notice}
          </p>
        )}

        <section className="panel-arcane p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="input-arcane flex-1 !w-auto min-w-0 !py-1.5 text-sm"
              value={selectedId ?? "__new"}
              disabled={busy}
              onChange={(e) => {
                const id = e.target.value;
                open(id === "__new" ? null : themes.find((t) => t.id === id) ?? null);
              }}
            >
              {themes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
              <option value="__new">+ New theme…</option>
            </select>
            {selectedId && (
              <button
                type="button"
                className="btn-ghost text-xs px-2.5 py-1.5 !text-red-400 hover:!border-red-400"
                disabled={busy}
                onClick={() => void remove()}
              >
                Delete
              </button>
            )}
          </div>
          <div>
            <label htmlFor="theme-name" className="block text-xs mb-1 text-ink-dim">
              Theme name
            </label>
            <input
              id="theme-name"
              className="input-arcane"
              value={name}
              maxLength={60}
              disabled={busy}
              onChange={(e) => {
                setName(e.target.value);
                setDirty(true);
              }}
            />
          </div>
        </section>

        <section className="panel-arcane p-4 sm:p-5 space-y-3">
          <h2 className="font-heading text-sm">Pages</h2>
          <ColorField label="Paper" value={config.pageBg} disabled={busy} onChange={(v) => set("pageBg", v)} />
          <ColorField label="Ink (body text)" value={config.ink} disabled={busy} onChange={(v) => set("ink", v)} />
          <ColorField label="Headings" value={config.accent} disabled={busy} onChange={(v) => set("accent", v)} />
          <ColorField label="Accents" value={config.accent2} disabled={busy} onChange={(v) => set("accent2", v)} />
          <FontField label="Heading font" value={config.headingFont} disabled={busy} onChange={(v) => set("headingFont", v)} />
          <FontField label="Body font" value={config.bodyFont} disabled={busy} onChange={(v) => set("bodyFont", v)} />
          <TextureField
            label="Paper texture"
            value={config.pageTexture}
            imageId={config.pageTextureImageId}
            disabled={busy}
            onChange={(v) => set("pageTexture", v)}
            onUpload={(f) => void uploadTexture(f, "pageTextureImageId")}
            onClearImage={() => set("pageTextureImageId", null)}
          />
        </section>

        <section className="panel-arcane p-4 sm:p-5 space-y-3">
          <h2 className="font-heading text-sm">Cover &amp; Binding</h2>
          <ColorField label="Binding" value={config.coverBg} disabled={busy} onChange={(v) => set("coverBg", v)} />
          <ColorField label="Cover ink" value={config.coverInk} disabled={busy} onChange={(v) => set("coverInk", v)} />
          <FontField label="Cover font" value={config.coverFont} disabled={busy} onChange={(v) => set("coverFont", v)} />
          <TextureField
            label="Binding texture"
            value={config.coverTexture}
            imageId={config.coverTextureImageId}
            disabled={busy}
            onChange={(v) => set("coverTexture", v)}
            onUpload={(f) => void uploadTexture(f, "coverTextureImageId")}
            onClearImage={() => set("coverTextureImageId", null)}
          />
        </section>

        <section className="panel-arcane p-4 sm:p-5 space-y-3">
          <h2 className="font-heading text-sm">Flourish &amp; Ambience</h2>
          <div className="text-sm">
            <p className="text-ink-dim mb-1.5">Ornament glyph</p>
            <div className="flex flex-wrap gap-1.5">
              {THEME_ORNAMENTS.map((o) => (
                <button
                  key={o}
                  type="button"
                  disabled={busy}
                  onClick={() => set("ornament", o)}
                  className={`h-9 w-9 rounded-md border text-base leading-none transition ${
                    config.ornament === o
                      ? "border-arcane bg-arcane/15 text-arcane-bright"
                      : "border-void-border text-ink-dim hover:border-arcane/50"
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-ink-dim">Background animation</span>
            <select
              className="input-arcane !w-44 !py-1.5 text-sm"
              value={config.ambience}
              disabled={busy}
              onChange={(e) => set("ambience", e.target.value)}
            >
              {AMBIENCE_PRESETS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        </section>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="btn-arcane"
            disabled={busy || !name.trim() || !dirty}
            onClick={() => void save()}
          >
            {busy ? "Working..." : selectedId ? "Save Theme" : "Create Theme"}
          </button>
          {dirty && (
            <span className="text-xs text-ink-dim">Unsaved changes</span>
          )}
        </div>
      </div>
    </div>
  );
}
