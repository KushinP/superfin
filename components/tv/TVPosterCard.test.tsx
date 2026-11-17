import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { render, screen } from "@testing-library/react-native";
import { TVPosterCard } from "./TVPosterCard";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/constants/TVTypography", () => ({
  useScaledTVTypography: () => ({ callout: 16, body: 18 }),
}));
jest.mock("@/constants/TVPosterSizes", () => ({
  useScaledTVPosterSizes: () => ({ poster: 200, episode: 300 }),
}));
jest.mock("@/providers/JellyfinProvider", () => {
  const { atom } = jest.requireActual("jotai");
  return { apiAtom: atom(null) };
});
jest.mock("@/components/common/ServerImage", () => ({ Image: () => null }));
jest.mock("@/components/common/ProgressBar", () => ({
  ProgressBar: () => null,
}));
jest.mock("@/components/WatchedIndicator", () => ({
  WatchedIndicator: () => null,
  WatchedIndicatorTV: () => null,
}));
jest.mock("@/modules/glass-poster", () => ({
  GlassPosterView: () => null,
  isGlassEffectAvailable: () => false,
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

const movie: BaseItemDto = {
  Id: "m1",
  Name: "Heart of the Beast",
  Type: "Movie",
  ProductionYear: 2026,
};

// Fire TV, 2026-11-16, seen with ADB: on a card row (Home, seasons, Seerr's
// Trending) the focused poster sat on the screen's bottom edge with its
// title hidden, and ↓ often only scrolled. Android scrolls a list to show
// the focused view, and the title was outside it, so it stayed off screen.
// The title and subtitle are now inside the focusable part.
describe("TVPosterCard", () => {
  test("the title is inside the part that takes the focus", async () => {
    await render(<TVPosterCard item={movie} onPress={() => {}} />);

    const title = screen.getByText("Heart of the Beast");
    let node = title.parent;
    let focusable = false;
    while (node) {
      if (node.props?.focusable === true) focusable = true;
      node = node.parent;
    }
    expect(focusable).toBe(true);
  });

  // The Fire TV's screen reader read focused cards as "" or an icon code.
  test("the focusable part is named by the item's title", async () => {
    await render(<TVPosterCard item={movie} onPress={() => {}} />);

    expect(screen.getByLabelText(/Heart of the Beast/)).toBeTruthy();
  });

  test("without text, there's no title inside", async () => {
    await render(
      <TVPosterCard item={movie} onPress={() => {}} showText={false} />,
    );
    expect(screen.queryByText("Heart of the Beast")).toBeNull();
  });
});
