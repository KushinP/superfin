import type { ReactNode } from "react";
import { TVFocusGuideView } from "react-native";

/**
 * A row of sub-tabs on a TV page (Live TV's Programs … Multiview). Sideways
 * at its ends the focus stays in the row: → on Live TV's last sub-tab,
 * Multiview, jumped up to the top tab bar (Fire TV, 2026-11-17). Up and
 * down are left alone. The top tab bar does the same (TVNavBar).
 */
export function TVSubTabRow({ children }: { children: ReactNode }) {
  return (
    <TVFocusGuideView
      testID='tv-sub-tab-row'
      trapFocusLeft
      trapFocusRight
      style={{ flexDirection: "row", gap: 8 }}
    >
      {children}
    </TVFocusGuideView>
  );
}
