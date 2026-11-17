import { render, screen } from "@testing-library/react-native";
import { Platform, StyleSheet } from "react-native";
import { Input } from "./Input";

jest.mock("@/constants/TVTypography", () => ({
  useScaledTVTypography: () => ({ body: 28 }),
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-blur", () => {
  const { View } = jest.requireActual("react-native");
  return { BlurView: View };
});

// Fire TV, 2026-11-17, screenshots: multiview's "Search channels" showed only
// its lower half. On TV the field has a fixed height (56 at the default text
// size) for 28 px text, and Android pads a TextInput inside its height by
// default, so the text didn't fit and its top was cut off. The login screen's
// TVInput hit the same thing.
describe("Input on TV", () => {
  beforeEach(() => {
    jest.spyOn(Platform, "isTV", "get").mockReturnValue(true);
  });
  afterEach(() => jest.restoreAllMocks());

  test("the text field has no built-in vertical padding, and centres its text", async () => {
    await render(<Input placeholder='Search channels' />);
    const style = StyleSheet.flatten(
      screen.getByPlaceholderText("Search channels").props.style,
    );

    expect(style.paddingVertical ?? style.paddingTop).toBe(0);
    expect(style.paddingVertical ?? style.paddingBottom).toBe(0);
    expect(style.textAlignVertical).toBe("center");
  });
});
