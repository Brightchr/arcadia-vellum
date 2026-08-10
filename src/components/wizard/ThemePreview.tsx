"use client";

/**
 * Miniature open-book preview rendered with the real theme CSS
 * (theme classes + .tome-page styles live in themes.css). Also renders
 * custom themes ("custom-<id>") when their generated CSS is on the page.
 */
export function ThemePreview({
  themeId,
  sampleName,
}: {
  themeId: string;
  sampleName?: string | null;
}) {
  return (
    <div className={`theme-${themeId} pointer-events-none select-none`}>
      <div className="tome-page tome-preview-page">
        <h2 className="tome-chapter">Session the First</h2>
        <p>
          The rain had teeth that night. {sampleName || "Eveline"} pressed a
          palm to the standing stone and felt it <em>hum</em> — old magic,
          older than the town, older than the road that led us here.
        </p>
        <p>
          We made camp beneath the shattered arch. I recorded the sigils before
          the light failed.
        </p>
      </div>
    </div>
  );
}
