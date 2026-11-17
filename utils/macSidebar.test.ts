import { macSidebarItems } from "./macSidebar";

const ids = (
  settings: Parameters<typeof macSidebarItems>[0],
  liveTv?: boolean,
) => macSidebarItems(settings, liveTv).map((item) => item.id);

// The Mac hides the tab bar and lists its sections here instead. Upstream's
// phone bar gathers favorites and watchlists in More; the sidebar has room for
// them, so they stay sections, opening inside More's stack.
describe("macSidebarItems", () => {
  test("lists the sections in the TV bar's order", () => {
    expect(ids({})).toEqual(["home", "search", "favorites", "libraries"]);
  });

  test("shows Watchlists only with a StreamyStats server and the tab on", () => {
    expect(ids({ streamyStatsServerUrl: "https://stats" })).toContain(
      "watchlists",
    );
    expect(
      ids({ streamyStatsServerUrl: "https://stats", hideWatchlistsTab: true }),
    ).not.toContain("watchlists");
  });

  test("shows Live TV after Favorites when the user has it", () => {
    expect(ids({}, true)).toEqual([
      "home",
      "search",
      "favorites",
      "livetv",
      "libraries",
    ]);
  });

  // Upstream left Custom links out of the TV bar; the Mac follows it.
  test("has no Custom links section", () => {
    expect(ids({ showCustomMenuLinks: true })).not.toContain("custom-links");
  });

  test("every section opens a tab group that exists", () => {
    const groups = ["(home)", "(search)", "(more)", "(livetv)", "(libraries)"];
    for (const item of macSidebarItems({ streamyStatsServerUrl: "x" }, true)) {
      expect(groups).toContain(item.segment);
      expect(item.href.startsWith(`/(auth)/(tabs)/${item.segment}`)).toBe(true);
    }
  });

  test("favorites and watchlists open inside More", () => {
    const items = macSidebarItems({ streamyStatsServerUrl: "x" });
    expect(items.find((item) => item.id === "favorites")).toMatchObject({
      segment: "(more)",
      page: "favorites",
      href: "/(auth)/(tabs)/(more)/favorites",
    });
    expect(items.find((item) => item.id === "watchlists")).toMatchObject({
      segment: "(more)",
      page: "watchlists",
      href: "/(auth)/(tabs)/(more)/watchlists",
    });
  });

  test("Live TV opens at the Live TV screen, not the bare group", () => {
    const live = macSidebarItems({}, true).find((item) => item.id === "livetv");
    expect(live?.href).toBe("/(auth)/(tabs)/(livetv)/livetv/programs");
  });
});
