import { useEffect } from "react";
import { AppState } from "react-native";
import { holdMediaKeySession } from "@/modules/exoplayer-player/src/mediaKeys";

/**
 * Holds the app's media session while the calling screen is mounted and the
 * app is in front, so the remote's ⏯ ⏪ ⏩ reach useTVEventHandler on Android
 * TV. Fire OS sends them only to a media session (Fire TV, 2026-11-15).
 * Does nothing elsewhere.
 *
 * It lets go in the background: after Home, multiview and the player stay
 * mounted, and a held session would keep taking ⏯ from the home screen and
 * other apps.
 */
export const useMediaKeySession = (active = true) => {
  useEffect(() => {
    if (!active) return;
    let release: (() => void) | null =
      AppState.currentState === "background" ? null : holdMediaKeySession();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        release ??= holdMediaKeySession();
      } else if (state === "background") {
        release?.();
        release = null;
      }
    });
    return () => {
      subscription.remove();
      release?.();
    };
  }, [active]);
};
