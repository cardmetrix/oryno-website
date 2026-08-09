import { FALLBACK_JAP_SERVICES } from "./catalog";
import { getJapServices, isJapDemoMode, type JapService } from "./client";

/**
 * Prefer live/stale JAP catalog; never throw — falls back to the demo list so
 * the boosting UI can still render when the panel is down.
 */
export async function getJapServicesSafe(): Promise<{
  services: JapService[];
  demo: boolean;
  fallback: boolean;
}> {
  if (isJapDemoMode()) {
    return {
      services: FALLBACK_JAP_SERVICES,
      demo: true,
      fallback: false,
    };
  }

  try {
    const services = await getJapServices();
    return { services, demo: false, fallback: false };
  } catch (error) {
    console.error("[jap] services unavailable; demo fallback", error);
    return {
      services: FALLBACK_JAP_SERVICES,
      demo: false,
      fallback: true,
    };
  }
}
