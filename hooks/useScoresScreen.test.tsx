import { act, render, renderHook, screen } from "@testing-library/react-native";
import type { ReactElement } from "react";
import { Dimensions, Platform, StyleSheet } from "react-native";
import { useScoresScreen } from "./useScoresScreen";

const mockPush = jest.fn();
jest.mock("@/hooks/useAppRouter", () => ({
  __esModule: true,
  default: () => ({ push: mockPush, back: jest.fn() }),
}));
const mockShowModal = jest.fn();
jest.mock("@/providers/GlobalModalProvider", () => ({
  useGlobalModal: () => ({ showModal: mockShowModal, hideModal: jest.fn() }),
}));
// The sheet's native scroll view can't load under Jest: a plain view that
// keeps its style stands in for it.
jest.mock("@gorhom/bottom-sheet", () => {
  const { View } = require("react-native");
  return {
    BottomSheetScrollView: ({
      children,
      style,
    }: {
      children: unknown;
      style: unknown;
    }) => (
      <View testID='scores-sheet' style={style}>
        {children}
      </View>
    ),
  };
});
jest.mock("@/components/multiview/ScoresScreenContent", () => ({
  ScoresScreenContent: () => null,
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const onTV = async (run: () => Promise<void>) => {
  const was = Platform.isTV;
  Object.defineProperty(Platform, "isTV", { value: true, configurable: true });
  try {
    await run();
  } finally {
    Object.defineProperty(Platform, "isTV", { value: was, configurable: true });
  }
};

describe("useScoresScreen", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockShowModal.mockClear();
  });

  // On TV anything modal is a route: only a route gets the remote's Back.
  test("on TV, opens the scores route over multiview", async () => {
    await onTV(async () => {
      const { result } = await renderHook(() => useScoresScreen());
      await act(async () => result.current());
      expect(mockPush).toHaveBeenCalledWith("/(auth)/tv-scores-modal");
      expect(mockShowModal).not.toHaveBeenCalled();
    });
  });

  test("on a phone, opens a sheet over the bottom half", async () => {
    const { result } = await renderHook(() => useScoresScreen());
    await act(async () => result.current());
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockShowModal).toHaveBeenCalledTimes(1);
    // Upstream's sheet sizes itself to its content (snap points are gone),
    // so the sheet caps its own height at half the window.
    await render(mockShowModal.mock.calls[0][0] as ReactElement);
    const style = StyleSheet.flatten(
      screen.getByTestId("scores-sheet").props.style,
    );
    expect(style.maxHeight).toBe(Dimensions.get("window").height / 2);
  });
});
