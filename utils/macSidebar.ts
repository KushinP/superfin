import type { Ionicons } from "@expo/vector-icons";
import type { Settings } from "@/utils/atoms/settings";
import { LIVE_TV_TAB_HREF } from "@/utils/liveTv";
import { showsWatchlists } from "@/utils/tvTabs";

export type MacSidebarItem = {
  /** Unique per section: Favorites and Watchlists share a tab group. */
  id: string;
  /** The tab group's route segment, as useSegments() reports it. */
  segment: string;
  /** The page inside the group, for sections that share one (More's). */
  page?: string;
  href: string;
  titleKey: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
};

/**
 * The Mac sidebar's sections, in the TV bar's order (utils/tvTabs.ts): the
 * tab bar is hidden on the Mac, and the phone's More menu would only add a
 * click there. Favorites and Watchlists open inside More's stack, where
 * upstream moved them; Settings sits at the sidebar's foot. Live TV shows
 * when the user has a Live TV library (useLiveTvAvailable).
 */
export const macSidebarItems = (
  settings: Partial<
    Pick<
      Settings,
      "streamyStatsServerUrl" | "hideWatchlistsTab" | "showCustomMenuLinks"
    >
  > | null,
  liveTv = false,
): MacSidebarItem[] => [
  {
    id: "home",
    segment: "(home)",
    href: "/(auth)/(tabs)/(home)",
    titleKey: "tabs.home",
    icon: "home",
  },
  {
    id: "search",
    segment: "(search)",
    href: "/(auth)/(tabs)/(search)",
    titleKey: "tabs.search",
    icon: "search",
  },
  {
    id: "favorites",
    segment: "(more)",
    page: "favorites",
    href: "/(auth)/(tabs)/(more)/favorites",
    titleKey: "tabs.favorites",
    icon: "heart",
  },
  ...(liveTv
    ? [
        {
          id: "livetv",
          segment: "(livetv)",
          href: LIVE_TV_TAB_HREF,
          titleKey: "live_tv.title",
          icon: "tv" as const,
        },
      ]
    : []),
  ...(showsWatchlists(settings)
    ? [
        {
          id: "watchlists",
          segment: "(more)",
          page: "watchlists",
          href: "/(auth)/(tabs)/(more)/watchlists",
          titleKey: "watchlists.title",
          icon: "list" as const,
        },
      ]
    : []),
  {
    id: "libraries",
    segment: "(libraries)",
    href: "/(auth)/(tabs)/(libraries)",
    titleKey: "tabs.library",
    icon: "library",
  },
];
