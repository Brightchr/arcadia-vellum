/**
 * Atmospheric backdrop behind the tome. Pure markup — themes.css supplies
 * each theme's colors, glyph characters, and motion, all on opacity/transform.
 * Structure: 1 glow, 1 drifting mist, 12 glyphs, 10 rising motes.
 */
export function TomeAmbience() {
  return (
    <div className="tome-ambience" aria-hidden="true">
      <div className="tome-ambience-fire" />
      <div className="tome-ambience-drift" />
      {Array.from({ length: 12 }, (_, i) => (
        <span key={`g${i}`} className="tome-ambience-rune" />
      ))}
      {Array.from({ length: 10 }, (_, i) => (
        <span key={`e${i}`} className="tome-ambience-ember" />
      ))}
    </div>
  );
}
