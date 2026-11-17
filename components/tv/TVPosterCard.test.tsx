import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { render, screen } from "@testing-library/react-native";
import { TVPosterCard } from "./TVPosterCard";

jest.mock("@/providers/JellyfinProvider", () =>
  jest.requireActual("@/test-utils/realSessionAtoms"),
);

jest.mock("@/components/WatchedIndicator", () => ({
  UnplayedCountBadge: () => null,
  WatchedIndicator: () => null,
  WatchedIndicatorTV: () => null,
}));
jest.mock("@/components/common/ProgressBar", () => ({
  ProgressBar: () => null,
}));
jest.mock("@/modules/glass-poster", () => ({
  GlassPosterView: () => null,
  isGlassEffectAvailable: () => false,
}));
jest.mock("@/constants/TVPosterSizes", () => ({
  useScaledTVPosterSizes: () => ({ poster: 200, episode: 300 }),
}));
jest.mock("@/constants/TVTypography", () => ({
  useScaledTVTypography: () => ({ callout: 20, body: 20, heading: 30 }),
}));

// The badge on the episode a page is about read "Now Playing" in English
// whatever the language (seen in French on an Android TV, 2026-11-03).
test("the badge of the current item speaks the user's language", async () => {
  await render(
    <TVPosterCard
      item={{ Id: "e1", Name: "Pilot", Type: "Episode" }}
      orientation='horizontal'
      imageUrlGetter={() =>
        "https://jellyfin.example.com/Items/e1/Images/Primary"
      }
      isCurrent
      onPress={() => {}}
    />,
  );

  expect(screen.getByText("player.now_playing")).toBeTruthy();
  expect(screen.queryByText("Now Playing")).toBeNull();
});

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
