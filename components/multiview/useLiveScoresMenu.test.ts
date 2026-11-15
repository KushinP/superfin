import { act, renderHook } from "@testing-library/react-native";
import { Platform } from "react-native";
import { useLiveScoresMenu } from "./useLiveScoresMenu";

const mockShowActionSheet = jest.fn();
jest.mock("@expo/react-native-action-sheet", () => ({
  useActionSheet: () => ({ showActionSheetWithOptions: mockShowActionSheet }),
}));
const mockShowOptions = jest.fn();
jest.mock("@/hooks/useTVOptionModal", () => ({
  useTVOptionModal: () => ({ showOptions: mockShowOptions }),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${Object.values(values).join(",")}` : key,
  }),
}));

let mockSettings: Record<string, unknown> = {};
const mockUpdateSettings = jest.fn();
jest.mock("@/utils/atoms/settings", () => ({
  useSettings: () => ({
    settings: mockSettings,
    updateSettings: mockUpdateSettings,
  }),
}));

/** Opens the menu and picks the option with this label. */
const pick = async (label: string) => {
  const { result } = await renderHook(() => useLiveScoresMenu());
  await act(async () => result.current.open());
  const [{ options }, callback] = mockShowActionSheet.mock.calls.at(-1);
  const index = options.indexOf(label);
  expect(index).toBeGreaterThanOrEqual(0);
  await act(async () => callback(index));
};

describe("useLiveScoresMenu", () => {
  beforeEach(() => {
    mockSettings = { liveScoresEnabled: true, liveScoresDelaySeconds: 30 };
    mockShowActionSheet.mockReset();
    mockShowOptions.mockReset();
    mockUpdateSettings.mockReset();
  });

  test("the tile menu's item says the delay in force", async () => {
    const { result } = await renderHook(() => useLiveScoresMenu());
    expect(result.current.label).toBe("livescores.menu_delay:30");
  });

  test("says when scores are off", async () => {
    mockSettings.liveScoresEnabled = false;
    const { result } = await renderHook(() => useLiveScoresMenu());
    expect(result.current.label).toBe("livescores.menu_off");
  });

  // A6
  test("+5 s makes it 35", async () => {
    await pick("livescores.delay_more");
    expect(mockUpdateSettings).toHaveBeenCalledWith({
      liveScoresDelaySeconds: 35,
    });
  });

  test("−5 s makes it 25", async () => {
    await pick("livescores.delay_less");
    expect(mockUpdateSettings).toHaveBeenCalledWith({
      liveScoresDelaySeconds: 25,
    });
  });

  test("stays within 0 to 90 s", async () => {
    mockSettings.liveScoresDelaySeconds = 90;
    await pick("livescores.delay_more");
    expect(mockUpdateSettings).toHaveBeenLastCalledWith({
      liveScoresDelaySeconds: 90,
    });
    mockSettings.liveScoresDelaySeconds = 0;
    await pick("livescores.delay_less");
    expect(mockUpdateSettings).toHaveBeenLastCalledWith({
      liveScoresDelaySeconds: 0,
    });
  });

  test("turns scores off, and back on", async () => {
    await pick("livescores.turn_off");
    expect(mockUpdateSettings).toHaveBeenLastCalledWith({
      liveScoresEnabled: false,
    });
    mockSettings.liveScoresEnabled = false;
    await pick("livescores.turn_on");
    expect(mockUpdateSettings).toHaveBeenLastCalledWith({
      liveScoresEnabled: true,
    });
  });

  test("cancel changes nothing", async () => {
    await pick("common.cancel");
    expect(mockUpdateSettings).not.toHaveBeenCalled();
  });

  test("the sheet says what the delay is for", async () => {
    const { result } = await renderHook(() => useLiveScoresMenu());
    await act(async () => result.current.open());
    expect(mockShowActionSheet.mock.calls[0][0].message).toBe(
      "livescores.delay_message:30",
    );
  });

  // On a Fire TV the phone action sheet is a white panel with no visible
  // focus, so the TV gets the app's own TV menu, like the tile menu.
  describe("on a TV", () => {
    const wasTV = Platform.isTV;
    beforeEach(() => {
      Object.defineProperty(Platform, "isTV", {
        value: true,
        configurable: true,
      });
    });
    afterEach(() => {
      Object.defineProperty(Platform, "isTV", {
        value: wasTV,
        configurable: true,
      });
    });

    test("opens the TV menu, titled with the delay in force", async () => {
      const { result } = await renderHook(() => useLiveScoresMenu());
      await act(async () => result.current.open());
      expect(mockShowActionSheet).not.toHaveBeenCalled();
      const menu = mockShowOptions.mock.calls[0][0];
      expect(menu.title).toBe("livescores.menu_delay:30");
      expect(menu.options.map((o: { label: string }) => o.label)).toEqual([
        "livescores.delay_more",
        "livescores.delay_less",
        "livescores.turn_off",
      ]);
    });

    test("+5 s from the TV menu makes it 35", async () => {
      const { result } = await renderHook(() => useLiveScoresMenu());
      await act(async () => result.current.open());
      const menu = mockShowOptions.mock.calls[0][0];
      await act(async () => menu.onSelect(menu.options[0].value));
      expect(mockUpdateSettings).toHaveBeenCalledWith({
        liveScoresDelaySeconds: 35,
      });
    });
  });
});
