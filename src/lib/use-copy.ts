"use client";

import { useState } from "react";

// Copy text and flash a "Copied" state for a moment. A clipboard write can fail
// (iframes, insecure contexts) — then nothing flashes and the text stays on
// screen for the user to select by hand.
export function useCopy(): [copied: boolean, copy: (text: string) => void] {
  const [copied, setCopied] = useState(false);

  function copy(text: string) {
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      })
      .catch(() => {});
  }

  return [copied, copy];
}
