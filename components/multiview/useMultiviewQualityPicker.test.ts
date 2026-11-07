import { act, renderHook } from "@testing-library/react-native";
import { Platform } from "react-native";

const mockShowActionSheet = jest.fn();
const mockShowOptions = jest.fn();
const mockUpdateSettings = jest.fn();
let mockSettings: Record<string, unknown> = {};
let mockPluginSettings: Record<string, unknown> = {};

jest.mock("@expo/react-native-action-sheet", () => ({
  useActionSheet: () => ({ showActionSheetWithOptions: mockShowActionSheet }),
}));
jest.mock("@/hooks/useTVOptionModal", () => ({
  useTVOptionModal: () => ({ showOptions: mockShowOptions }),
}));
jest.mock("@/utils/atoms/settings", () => ({
  useSettings: () => ({
    settings: mockSettings,
    updateSettings: mockUpdateSettings,
    pluginSettings: mockPluginSettings,
  }),
}));
// BITRATES lives in the selector, whose dropdown loads native code.
jest.mock("@/components/PlatformDropdown", () => ({
  PlatformDropdown: () => null,
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { useMultiviewQualityPicker } from "./useMultiviewQualityPicker";

const setTV = (isTV: boolean) =>
  Object.defineProperty(Platform, "isTV", { value: isTV, configurable: true });

describe("useMultiviewQualityPicker", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettings = {};
    mockPluginSettings = {};
    setTV(false);
  });

  test("starts at the multiview default until the user picks one", async () => {
    const { result } = await renderHook(() => useMultiviewQualityPicker());
    expect(result.current.quality).toBe("8 Mb/s");
  });

  test("on the Mac, iPhone and iPad a pick from the sheet sets the multiview quality", async () => {
    const { result } = await renderHook(() => useMultiviewQualityPicker());
    await act(async () => result.current.openShared());

    const [options, onPick] = mockShowActionSheet.mock.calls[0];
    expect(options.options[0]).toBe("Max");
    onPick(options.options.indexOf("Max"));
    expect(mockUpdateSettings).toHaveBeenCalledWith({
      multiviewMaxBitrate: { key: "Max", value: undefined },
    });
  });

  test("cancelling the sheet changes nothing", async () => {
    const { result } = await renderHook(() => useMultiviewQualityPicker());
    await act(async () => result.current.openShared());
    const [options, onPick] = mockShowActionSheet.mock.calls[0];
    onPick(options.cancelButtonIndex);
    onPick(undefined);
    expect(mockUpdateSettings).not.toHaveBeenCalled();
  });

  test("picking the quality already in use does not restart the tiles", async () => {
    // Every tile reopens its stream when the setting changes.
    mockSettings = { multiviewMaxBitrate: { key: "4 Mb/s", value: 4_000_000 } };
    const { result } = await renderHook(() => useMultiviewQualityPicker());
    await act(async () => result.current.openShared());
    const [options, onPick] = mockShowActionSheet.mock.calls[0];
    onPick(options.options.indexOf("4 Mb/s"));
    expect(mockUpdateSettings).not.toHaveBeenCalled();
  });

  test("on a TV it opens the TV option sheet with the current quality selected", async () => {
    setTV(true);
    mockSettings = { multiviewMaxBitrate: { key: "4 Mb/s", value: 4_000_000 } };
    const { result } = await renderHook(() => useMultiviewQualityPicker());
    await act(async () => result.current.openShared());

    expect(mockShowActionSheet).not.toHaveBeenCalled();
    const { options, onSelect } = mockShowOptions.mock.calls[0][0];
    expect(options.find((o: { selected: boolean }) => o.selected).value).toBe(
      "4 Mb/s",
    );
    onSelect("2 Mb/s");
    expect(mockUpdateSettings).toHaveBeenCalledWith({
      multiviewMaxBitrate: { key: "2 Mb/s", value: 2_000_000 },
    });
  });

  test("a quality the server admin locked cannot be opened", async () => {
    mockPluginSettings = { multiviewMaxBitrate: { locked: true } };
    const { result } = await renderHook(() => useMultiviewQualityPicker());
    expect(result.current.locked).toBe(true);
    await act(async () => result.current.openShared());
    expect(mockShowActionSheet).not.toHaveBeenCalled();
    expect(mockShowOptions).not.toHaveBeenCalled();
  });

  test("one tile can go lower than the shared quality", async () => {
    const onPick = jest.fn();
    const { result } = await renderHook(() => useMultiviewQualityPicker());
    await act(async () => result.current.openTile(undefined, onPick));
    const [options, choose] = mockShowActionSheet.mock.calls[0];
    // The way back to the shared quality comes first.
    expect(options.options[0]).toBe("multiview.tile_quality_shared");
    choose(options.options.indexOf("4 Mb/s"));
    expect(onPick).toHaveBeenCalledWith({ key: "4 Mb/s", value: 4_000_000 });
    // The setting all tiles share is left alone.
    expect(mockUpdateSettings).not.toHaveBeenCalled();
  });

  test("a tile goes back to the shared quality, and only when it had its own", async () => {
    const onPick = jest.fn();
    const { result } = await renderHook(() => useMultiviewQualityPicker());
    await act(async () =>
      result.current.openTile({ key: "4 Mb/s", value: 4_000_000 }, onPick),
    );
    mockShowActionSheet.mock.calls[0][1](0);
    expect(onPick).toHaveBeenCalledWith(undefined);

    onPick.mockClear();
    await act(async () => result.current.openTile(undefined, onPick));
    mockShowActionSheet.mock.calls[1][1](0);
    expect(onPick).not.toHaveBeenCalled();
  });

  test("choosing for all tiles tells the screen, so per-tile caps are cleared", async () => {
    const onPicked = jest.fn();
    const { result } = await renderHook(() => useMultiviewQualityPicker());
    await act(async () => result.current.openShared(onPicked));
    const [options, choose] = mockShowActionSheet.mock.calls[0];
    choose(options.options.indexOf("2 Mb/s"));
    expect(onPicked).toHaveBeenCalled();
  });
});
