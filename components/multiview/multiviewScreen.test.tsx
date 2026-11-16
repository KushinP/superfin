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
  onLongPress: (name?: string) => void;
  hasTVPreferredFocus?: boolean;
  onTargetRef?: unknown;
  showStats?: boolean;
  remoteTarget?: boolean;
  onRemoteState?: (state: { controllable: boolean; focused: boolean }) => void;
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
const mockActionSheet = jest.fn();
jest.mock("@expo/react-native-action-sheet", () => ({
  useActionSheet: () => ({
    showActionSheetWithOptions: (
      options: unknown,
      callback: (index: number) => void,
    ) => {
      mockActionSheet(options);
      callback(mockSheetChoice);
    },
  }),
}));

type TVMenu = {
  title: string;
  options: { label: string; sublabel?: string; value: string }[];
  onSelect: (value: string) => void;
  deferApplyUntilDismissed?: boolean;
};
/** Every TV option menu the screen opened, latest last. */
const mockTVMenus: TVMenu[] = [];
jest.mock("@/hooks/useTVOptionModal", () => ({
  useTVOptionModal: () => ({
    showOptions: (menu: TVMenu) => mockTVMenus.push(menu),
  }),
}));

const mockOpenTileQuality = jest.fn();

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
    openTile: (...args: unknown[]) => mockOpenTileQuality(...args),
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
// Live scores are tested in multiviewScores.test.tsx; here they stand aside,
// with football on screen so the tile menu has its Scores item.
const mockOpenScores = jest.fn();
jest.mock("@/hooks/useLiveScores", () => ({
  useLiveScores: () => ({
    tiles: new Map(),
    games: [],
    view: {
      status: "ok",
      waiting: false,
      followed: [],
      others: [],
      delaySeconds: 30,
    },
  }),
}));
const mockUseMediaKeySession = jest.fn();
jest.mock("@/hooks/useMediaKeySession", () => ({
  useMediaKeySession: () => mockUseMediaKeySession(),
}));
jest.mock("@/hooks/useScoresScreen", () => ({
  useScoresScreen: () => mockOpenScores,
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
// Scores sits between Reconnect and Remove.
const REMOVE = 5;

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
  mockTVMenus.length = 0;
  mockOpenScores.mockClear();
  mockActionSheet.mockClear();
  mockOpenTileQuality.mockClear();
});

/** Runs a test body as on a TV, putting the platform back after. */
const onTV = async (body: () => Promise<void>) => {
  const wasTV = Platform.isTV;
  Object.defineProperty(Platform, "isTV", { value: true, configurable: true });
  try {
    await body();
  } finally {
    Object.defineProperty(Platform, "isTV", {
      value: wasTV,
      configurable: true,
    });
  }
};

/** Long-presses a tile on TV and picks a TV menu option by its position. */
const tvMenu = async (itemId: string, name: string, position: number) => {
  await act(() => mockTileProps[itemId].onLongPress(name));
  const menu = mockTVMenus[mockTVMenus.length - 1];
  await act(() => menu.onSelect(menu.options[position].value));
};

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
    // On TV the tile menu is the TV menu; Make main is its first option.
    await onTV(async () => {
      await render(<MultiviewRoute />);
      await switchLayout();

      await tvMenu("b", "WFXT", 0);

      expect(mockTileProps.b.hasTVPreferredFocus).toBe(true);
      expect(mockTileProps.a.hasTVPreferredFocus).toBe(false);
      expect(mockTileProps.b.onTargetRef).toBeDefined();
      expect(mockTileProps.a.onTargetRef).toBeUndefined();
    });
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

describe("a tile's menu on TV", () => {
  // The phone action sheet on a Fire TV was a white panel over most of the
  // screen with no title and no visible focus; TV uses the app's TV menu.
  test("opens the TV menu titled with the tile's name, not the action sheet", async () => {
    await onTV(async () => {
      await render(<MultiviewRoute />);

      await act(() => mockTileProps.b.onLongPress("WFXT"));

      expect(mockActionSheet).not.toHaveBeenCalled();
      expect(mockTVMenus).toHaveLength(1);
      expect(mockTVMenus[0].title).toBe("WFXT");
      expect(mockTVMenus[0].options.map((o) => o.label)).toEqual([
        "multiview.make_main",
        "multiview.stats_quality_tile",
        "multiview.stats_show",
        "multiview.reconnect",
        "livescores.open_scores",
        "multiview.remove_tile",
      ]);
      expect(mockTVMenus[0].options[1].sublabel).toBe("8 Mb/s");
    });
  });

  test("a tile with no name yet is titled as tile options", async () => {
    await onTV(async () => {
      await render(<MultiviewRoute />);

      await act(() => mockTileProps.b.onLongPress());

      expect(mockTVMenus[0].title).toBe("multiview.tile_menu");
    });
  });

  test("Make main makes it the main tile", async () => {
    await onTV(async () => {
      await render(<MultiviewRoute />);
      await switchLayout();

      await tvMenu("b", "WFXT", 0);

      expect(isBig("b")).toBe(true);
      expect(drawOrder()).toEqual(["a", "b"]);
    });
  });

  test("Quality opens that tile's quality picker, after the menu closes", async () => {
    await onTV(async () => {
      await render(<MultiviewRoute />);

      await tvMenu("b", "WFXT", 1);

      expect(mockTVMenus[0].deferApplyUntilDismissed).toBe(true);
      expect(mockOpenTileQuality).toHaveBeenCalledTimes(1);
    });
  });

  test("Show stats turns that tile's stats on", async () => {
    await onTV(async () => {
      await render(<MultiviewRoute />);

      await tvMenu("b", "WFXT", 2);

      expect(mockTileProps.b.showStats).toBe(true);
      expect(mockTileProps.a.showStats).toBe(false);
    });
  });

  test("Reconnect rebuilds that tile alone", async () => {
    await onTV(async () => {
      await render(<MultiviewRoute />);

      await tvMenu("b", "WFXT", 3);

      expect(mockUnmounts).toEqual(["b"]);
    });
  });

  test("Scores opens the scores screen", async () => {
    await onTV(async () => {
      await render(<MultiviewRoute />);

      await tvMenu("b", "WFXT", 4);

      expect(mockOpenScores).toHaveBeenCalledTimes(1);
      expect(mockUnmounts).toEqual([]);
    });
  });

  test("Remove takes that tile away", async () => {
    await onTV(async () => {
      await render(<MultiviewRoute />);

      await tvMenu("b", "WFXT", 5);

      expect(drawOrder()).toEqual(["a"]);
    });
  });

  test("a phone keeps the action sheet", async () => {
    await render(<MultiviewRoute />);
    mockSheetChoice = 6; // Cancel

    await act(() => mockTileProps.b.onLongPress("WFXT"));

    expect(mockActionSheet).toHaveBeenCalledTimes(1);
    expect(mockTVMenus).toHaveLength(0);
  });
});

describe("the remote's playback keys", () => {
  // Fire OS sends ⏯ ⏪ ⏩ to the system's media session, never to the app as
  // key presses (Fire TV, 2026-11-15), so multiview holds one while open.
  test("multiview holds a media session while open", async () => {
    mockUseMediaKeySession.mockClear();
    await render(<MultiviewRoute />);
    expect(mockUseMediaKeySession).toHaveBeenCalled();
  });

  test("the only movie tile takes the keys while a live tile has the focus", async () => {
    await render(<MultiviewRoute />);
    await act(() => {
      mockTileProps.a.onRemoteState?.({ controllable: false, focused: true });
      mockTileProps.b.onRemoteState?.({ controllable: true, focused: false });
    });

    expect(mockTileProps.a.remoteTarget).toBe(false);
    expect(mockTileProps.b.remoteTarget).toBe(true);
  });
});
