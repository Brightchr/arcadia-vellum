const RUNES = ["ᚠ", "ᛗ", "ᚦ", "ᛟ", "ᚱ", "ᛊ", "ᚷ", "ᛞ", "ᚺ", "ᛒ", "ᛁ", "ᛜ"];

/**
 * Atmospheric backdrop behind the tome: glowing runes, rising embers, and
 * firelight from below. Pure markup — themes.css decides which theme shows
 * it and animates everything on opacity/transform only.
 */
export function TomeAmbience() {
  return (
    <div className="tome-ambience" aria-hidden="true">
      <div className="tome-ambience-fire" />
      {RUNES.map((rune, i) => (
        <span key={i} className="tome-ambience-rune">
          {rune}
        </span>
      ))}
      {Array.from({ length: 10 }, (_, i) => (
        <span key={`e${i}`} className="tome-ambience-ember" />
      ))}
    </div>
  );
}
