import { render, screen } from "@testing-library/react-native";
import { TVNavBar } from "./TVNavBar";

jest.mock("@/constants/TVSizes", () => ({
  TVPadding: { horizontal: 60 },
}));
jest.mock("@/constants/TVTypography", () => ({
  useScaledTVTypography: () => ({ heading: 20 }),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("@/components/tv/hooks/useTVFocusAnimation", () => ({
  useTVFocusAnimation: () => ({
    focused: false,
    handleFocus: () => {},
    handleBlur: () => {},
    animatedStyle: {},
  }),
}));
jest.mock("./hooks/useNavBarPresence", () => ({
  useNavBarPresence: () => ({
    visible: true,
    onItemFocus: () => {},
    onItemBlur: () => {},
  }),
}));

const tabs = [
  { key: "home", label: "Home" },
  { key: "search", label: "Search" },
  { key: "settings", label: "Settings" },
];

// Fire TV, 2026-11-16, ADB and screenshots: ← on the first tab (Home) left
// the tab bar for the page's first card and hid the bar; a second ← then
// scrolled the page down. Sideways at the ends, the focus now stays put.
describe("TVNavBar", () => {
  test("the tabs sit in a focus guide that keeps ← and → in the bar", async () => {
    await render(
      <TVNavBar tabs={tabs} activeTabKey='home' onTabChange={() => {}} />,
    );

    const guide = screen.getByTestId("tv-nav-bar-focus-guide");
    expect(guide.props.trapFocusLeft).toBe(true);
    expect(guide.props.trapFocusRight).toBe(true);
    // ↓ to the page, and ↑ to it from the page, still work.
    expect(guide.props.trapFocusDown).toBeFalsy();
    expect(guide.props.trapFocusUp).toBeFalsy();
  });

  test("every tab is inside it", async () => {
    await render(
      <TVNavBar tabs={tabs} activeTabKey='home' onTabChange={() => {}} />,
    );

    const guide = screen.getByTestId("tv-nav-bar-focus-guide");
    for (const label of ["Home", "Search", "Settings"]) {
      let node = screen.getByText(label).parent;
      let inside = false;
      while (node) {
        if (node === guide) inside = true;
        node = node.parent;
      }
      expect(inside).toBe(true);
    }
  });
});
