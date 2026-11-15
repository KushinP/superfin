import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Platform } from "react-native";
import type { TileFrame } from "@/utils/multiview/multiview";

// The screen is tested with a stand-in tile: the real one opens a stream and a
// native player. What matters here is the order the tiles are drawn in, and
// whether a tile is rebuilt. On Android TV a tile that changes place among its
// siblings is taken off the window, and ExoPlayerView releases its player when
// that happens (onDetachedFromWindow), so a promotion froze the tile until it
// reconnected: a new stream, a new tuner and a new encode on the server.

type TileProps = {
  itemId: string;
  frame: TileFrame;
  onPress: () => void;
  onLongPress: () => void;
  hasTVPreferredFocus?: boolean;
  onTargetRef?: unknown;
};

/** Each tile's latest props, by item id. */
const mockTileProps: Record<string, TileProps> = {};
/** Item ids, once per tile mounted and once per tile unmounted. */
const mockMounts: string[] = [];
const mockUnmounts: string[] = [];

jest.mock("@/components/multiview/MultiviewTile", () => ({
  MultiviewTile: (props: TileProps) => MockTile(props),
}));
const MockTile = (props: TileProps) => {
  const { useEffect } = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  mockTileProps[props.itemId] = props;
  useEffect(() => {
    mockMounts.push(props.itemId);
    return () => {
      mockUnmounts.push(props.itemId);
    };
  }, []);
  return <View testID={`tile-${props.itemId}`} />;
};

type PickerProps = { onPick: (itemId: string) => void };
let mockPickerProps: PickerProps | null = null;
jest.mock("@/components/multiview/MultiviewPicker", () => ({
  MultiviewPicker: (props: PickerProps) => {
    mockPickerProps = props;
    return null;
  },
}));

/** The option the next action sheet picks, by index. */
let mockSheetChoice = 0;
jest.mock("@expo/react-native-action-sheet", () => ({
  useActionSheet: () => ({
    showActionSheetWithOptions: (
      _options: unknown,
      callback: (index: number) => void,
    ) => callback(mockSheetChoice),
  }),
}));

let mockItemIds = "a,b";
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ itemIds: mockItemIds }),
  useFocusEffect: () => {},
}));
jest.mock("@/hooks/useAppRouter", () => ({
  __esModule: true,
  default: () => ({ back: jest.fn() }),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@expo/vector-icons", () => ({
  Ionicons: Object.assign(() => null, { glyphMap: {} }),
}));
jest.mock("expo-keep-awake", () => ({
  activateKeepAwakeAsync: jest.fn(async () => {}),
  deactivateKeepAwake: jest.fn(),
}));
jest.mock("react-native-edge-to-edge", () => ({ SystemBars: () => null }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock("@/components/multiview/useMultiviewQualityPicker", () => ({
  useMultiviewQualityPicker: () => ({
    quality: "8 Mb/s",
    locked: false,
    openShared: jest.fn(),
    openTile: jest.fn(),
  }),
}));
jest.mock("@/hooks/useOrientation", () => ({
  useOrientation: () => ({
    lockOrientation: jest.fn(async () => {}),
    unlockOrientation: jest.fn(async () => {}),
  }),
}));
jest.mock("@/hooks/useRevalidatePlaybackProgressCache", () => ({
  useInvalidatePlaybackProgressCache: () => jest.fn(async () => {}),
}));
jest.mock("@/hooks/useScreenKeyCommands", () => ({
  useScreenKeyCommands: jest.fn(),
}));
jest.mock("@/packages/expo-screen-orientation", () => ({
  OrientationLock: { LANDSCAPE: 6 },
}));
jest.mock("@/utils/multiview/availability", () => ({
  isMultiviewAvailable: () => true,
}));

// After the mocks, which it imports.
const MultiviewRoute = jest.requireActual("@/app/(auth)/multiview").default;

/** Item ids in the order the screen draws their tiles. */
const drawOrder = () =>
  screen
    .getAllByTestId(/^tile-/)
    .map((tile) => String(tile.props.testID).replace("tile-", ""));

/** Whether this tile's frame is wider than every other tile on screen. */
const isBig = (itemId: string) => {
  const onScreen = drawOrder();
  return onScreen.every(
    (other) =>
      other === itemId ||
      mockTileProps[itemId].frame.width > mockTileProps[other].frame.width,
  );
};

const MAKE_MAIN = 0;
const RECONNECT = 3;
const REMOVE = 4;

/** Long-presses a tile and picks a menu option. */
const menu = async (itemId: string, choice: number) => {
  mockSheetChoice = choice;
  await act(() => mockTileProps[itemId].onLongPress());
};

const press = async (itemId: string) => {
  await act(() => mockTileProps[itemId].onPress());
};

const switchLayout = async () => {
  await fireEvent.press(screen.getByLabelText("multiview.change_layout"));
};

beforeEach(() => {
  for (const key of Object.keys(mockTileProps)) delete mockTileProps[key];
  mockMounts.length = 0;
  mockUnmounts.length = 0;
  mockItemIds = "a,b";
  mockPickerProps = null;
});

describe("making a tile the main tile", () => {
  test("from its menu keeps the draw order and gives it the big frame", async () => {
    await render(<MultiviewRoute />);
    await switchLayout(); // grid to focus; a is heard, so a is main
    expect(isBig("a")).toBe(true);

    await menu("b", MAKE_MAIN);

    expect(drawOrder()).toEqual(["a", "b"]);
    expect(isBig("b")).toBe(true);
  });

  test("by selecting a small tile in focus keeps the draw order", async () => {
    await render(<MultiviewRoute />);
    await switchLayout();

    await press("b");

    expect(drawOrder()).toEqual(["a", "b"]);
    expect(isBig("b")).toBe(true);
  });

  test("switching to focus keeps the draw order when the second tile is heard", async () => {
    await render(<MultiviewRoute />);
    await press("b"); // grid: hear b

    await switchLayout();

    expect(drawOrder()).toEqual(["a", "b"]);
    expect(isBig("b")).toBe(true);
  });

  test("rebuilds no tile, so no stream is stopped or opened", async () => {
    await render(<MultiviewRoute />);
    await switchLayout();

    await menu("b", MAKE_MAIN);
    await switchLayout();
    await switchLayout();

    expect([...mockMounts].sort()).toEqual(["a", "b"]);
    expect(mockUnmounts).toEqual([]);
  });

  test("gives the main tile the remote's starting focus", async () => {
    const wasTV = Platform.isTV;
    Object.defineProperty(Platform, "isTV", {
      value: true,
      configurable: true,
    });
    try {
      await render(<MultiviewRoute />);
      await switchLayout();

      await menu("b", MAKE_MAIN);

      expect(mockTileProps.b.hasTVPreferredFocus).toBe(true);
      expect(mockTileProps.a.hasTVPreferredFocus).toBe(false);
      expect(mockTileProps.b.onTargetRef).toBeDefined();
      expect(mockTileProps.a.onTargetRef).toBeUndefined();
    } finally {
      Object.defineProperty(Platform, "isTV", {
        value: wasTV,
        configurable: true,
      });
    }
  });
});

describe("other changes to the tiles", () => {
  test("removing and adding tiles leaves the others in their draw order", async () => {
    mockItemIds = "a,b,c";
    await render(<MultiviewRoute />);
    await switchLayout();
    await menu("c", MAKE_MAIN);

    await menu("a", REMOVE);
    expect(drawOrder()).toEqual(["b", "c"]);

    await act(() => mockPickerProps?.onPick("d"));
    expect(drawOrder()).toEqual(["b", "c", "d"]);
    expect(mockUnmounts).toEqual(["a"]);
  });

  test("a reconnected tile alone is rebuilt, in its own place", async () => {
    await render(<MultiviewRoute />);

    await menu("b", RECONNECT);

    expect(mockUnmounts).toEqual(["b"]);
    expect(mockMounts).toEqual(["a", "b", "b"]);
    expect(drawOrder()).toEqual(["a", "b"]);
  });
});
