import { useEffect } from "react";
import { holdMediaKeySession } from "@/modules/exoplayer-player/src/mediaKeys";

/**
 * Holds the app's media session while the calling screen is mounted, so the
 * remote's ⏯ ⏪ ⏩ reach useTVEventHandler on Android TV. Fire OS sends them
 * only to a media session (Fire TV, 2026-11-15). Does nothing elsewhere.
 */
export const useMediaKeySession = (active = true) => {
  useEffect(() => {
    if (!active) return;
    return holdMediaKeySession();
  }, [active]);
};
