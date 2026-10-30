"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Universal ModalPortal component.
 * Mounts any modal dialog directly at the root of `document.body`
 * to guarantee that backdrops unconditionally cover the entire viewport,
 * sidebar, and top navigation without DOM stacking-context interference.
 */
export function ModalPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted || typeof document === "undefined") {
    return null;
  }

  return createPortal(children, document.body);
}
