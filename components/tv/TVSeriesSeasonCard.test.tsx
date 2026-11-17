import { render, screen } from "@testing-library/react-native";
import { TVSeriesSeasonCard } from "./TVSeriesSeasonCard";

jest.mock("@/constants/TVTypography", () => ({
  useScaledTVTypography: () => ({ callout: 16, body: 18 }),
}));
jest.mock("@/constants/TVSizes", () => ({
  useScaledTVSizes: () => ({ posters: { poster: 200 } }),
}));
jest.mock("@/components/common/ServerImage", () => ({ Image: () => null }));
jest.mock("@/modules/glass-poster", () => ({
  GlassPosterView: () => null,
  isGlassEffectAvailable: () => false,
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

/** Whether the text sits inside the view that takes the TV focus. */
const insideFocusable = (text: string) => {
  let node = screen.getByText(text).parent;
  while (node) {
    if (node.props?.focusable === true) return true;
    node = node.parent;
  }
  return false;
};

// Kush, Fire TV, 2026-11-16: "for looking at seasons I have to click down one
// extra time just to get the view finder to show the text below the
// squares". Android scrolls a list to show the focused view, and the season
// card's title sat outside it, so ↓ onto the seasons row left the titles off
// screen. #27 fixed the same for TVPosterCard.
describe("TVSeriesSeasonCard", () => {
  test("the title and subtitle are inside the part that takes the focus", async () => {
    await render(
      <TVSeriesSeasonCard
        title='Season 1'
        subtitle='22 episodes'
        imageUrl={null}
        onPress={() => {}}
      />,
    );

    expect(insideFocusable("Season 1")).toBe(true);
    expect(insideFocusable("22 episodes")).toBe(true);
  });

  test("the focusable part is named by the season, for the screen reader", async () => {
    await render(
      <TVSeriesSeasonCard
        title='Season 1'
        imageUrl={null}
        onPress={() => {}}
      />,
    );

    expect(screen.getByLabelText("Season 1")).toBeTruthy();
  });
});
