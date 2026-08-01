"use client";

import dynamic from "next/dynamic";

/**
 * StPageFlip touches the DOM at init, so the reader is loaded client-only.
 */
const TomeReader = dynamic(() => import("./TomeReader"), {
  ssr: false,
  loading: () => (
    <div className="tome-reader-stage">
      <p className="text-ink-dim animate-pulse font-heading">
        Opening the tome...
      </p>
    </div>
  ),
});

export default TomeReader;
