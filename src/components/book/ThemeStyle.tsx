/**
 * Injects the generated CSS for custom themes. The CSS is produced by
 * customThemeCss() from fully validated config values — never from raw
 * user input.
 */
export function ThemeStyle({ css }: { css: string | null }) {
  if (!css) return null;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
