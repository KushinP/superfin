import { existsSync } from "node:fs";
import { join } from "node:path";
import en from "@/translations/en.json";
import { LIVE_TV_TABS, visibleLiveTvTabs } from "./liveTvTabs";

const routes = join(
  __dirname,
  "../../app/(auth)/(tabs)/(home,libraries,search,more,tv-favorites,tv-watchlists,livetv)/livetv",
);
const lookup = (key: string) =>
  key
    .split(".")
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown>)?.[part],
      en,
    );

describe("Live TV tabs", () => {
  test("Recordings stays off the bar while it has nothing to show", () => {
    expect(visibleLiveTvTabs().map((tab) => tab.name)).toEqual([
      "programs",
      "guide",
      "channels",
    ]);
  });

  test("Recordings comes back with the switch", () => {
    expect(visibleLiveTvTabs(true).map((tab) => tab.name)).toContain(
      "recordings",
    );
  });

  test("every tab has a route and a translated label", () => {
    // Reported: the bar showed the route names, untranslated.
    for (const tab of LIVE_TV_TABS) {
      expect(existsSync(join(routes, `${tab.name}.tsx`))).toBe(true);
      expect(typeof lookup(tab.label)).toBe("string");
    }
  });
});
