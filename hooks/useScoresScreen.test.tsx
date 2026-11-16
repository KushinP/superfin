import { act, renderHook } from "@testing-library/react-native";
import { Platform } from "react-native";
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
// The sheet's native scroll view can't load under Jest; only which way the
// screen opens is tested here.
jest.mock("@gorhom/bottom-sheet", () => ({
  BottomSheetScrollView: ({ children }: { children: unknown }) => children,
}));
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
    expect(mockShowModal.mock.calls[0][1]).toMatchObject({
      snapPoints: ["50%"],
    });
  });
});
