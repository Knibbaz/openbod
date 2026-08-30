import { useEffect, useState } from "react";
import { coreApi } from "./api";

/**
 * Draait deze instantie als demonstratie? De instantie zegt het zelf, dus een
 * echte instantie toont nergens demo-hulpjes en niemand hoeft ze bij het in
 * productie nemen weg te halen.
 */
export function useDemoModus(): boolean {
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    let cancelled = false;
    coreApi
      .getDemoStatus()
      .then((s) => {
        if (!cancelled) setDemo(s.actief);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return demo;
}
