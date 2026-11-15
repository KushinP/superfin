import { act, fireEvent, render, screen } from "@testing-library/react-native";
import recorded from "@/utils/livescores/__fixtures__/scoreboard-2026-11-15.json";
import { parseScoreboard } from "@/utils/livescores/espnScoreboard";

// The real multiview screen with stand-in tiles, as in
// multiviewScreen.test.tsx on develop: the real tile opens a stream and a
// native player. What matters here is that scores are drawn over the tiles,
// stay when the toolbar hides, and that changing the delay rebuilds no tile,
// since a rebuilt live tile stops its stream and takes a new tuner.

type TileProps = { itemId: string; onLongPress: () => void };
const mockTileProps: Record<string, TileProps> = {};
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
jest.mock("@/components/multiview/MultiviewPicker", () => ({
  MultiviewPicker: () => null,
}));

/** The options each action sheet picks, in order: the menu, then its sheet. */
const mockSheetChoices: number[] = [];
const mockSheets: { options: string[] }[] = [];
jest.mock("@expo/react-native-action-sheet", () => ({
  useActionSheet: () => ({
    showActionSheetWithOptions: (
      options: { options: string[] },
      callback: (index: number) => void,
    ) => {
      mockSheets.push(options);
      callback(mockSheetChoices.shift() ?? options.options.length - 1);
    },
  }),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${Object.values(values).join(",")}` : key,
  }),
}));

// Settings as a tiny store, so a change re-renders the screen as the real
// settings atom does.
let mockSettings: Record<string, unknown> = {};
const mockListeners = new Set<() => void>();
jest.mock("@/utils/atoms/settings", () => {
  const { useSyncExternalStore } = jest.requireActual("react");
  const subscribe = (listener: () => void) => {
    mockListeners.add(listener);
    return () => mockListeners.delete(listener);
  };
  return {
    useSettings: () => ({
      settings: useSyncExternalStore(subscribe, () => mockSettings),
      updateSettings: (patch: Record<string, unknown>) => {
        mockSettings = { ...mockSettings, ...patch };
        for (const listener of mockListeners) listener();
      },
      pluginSettings: undefined,
    }),
  };
});

// The poller is covered by useLiveScores*.test.tsx; here it says the first
// tile shows KC @ ATL, pinned in the rail.
const mockKcAtl = parseScoreboard(JSON.parse(JSON.stringify(recorded)))![0];
/** False: no tile shows football, so there is no view (R10). */
let mockHasView = true;
jest.mock("@/hooks/useLiveScores", () => ({
  useLiveScores: (tiles: { key: string }[]) => ({
    tiles: new Map(),
    games: [],
    view:
      mockHasView && tiles.length > 0
        ? {
            status: "ok",
            pinned: [
              {
                tileKey: tiles[0].key,
                color: "#60a5fa",
                gameId: mockKcAtl.id,
                teams: { away: "KC", home: "ATL" },
                game: mockKcAtl,
              },
            ],
            others: [],
            delaySeconds: 30,
          }
        : null,
  }),
}));

// Opening the scores screen is covered by useScoresScreen.test.tsx.
const mockOpenScores = jest.fn();
jest.mock("@/hooks/useScoresScreen", () => ({
  useScoresScreen: () => mockOpenScores,
}));
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ itemIds: "a,b" }),
  useFocusEffect: () => {},
}));
jest.mock("@/hooks/useAppRouter", () => ({
  __esModule: true,
  default: () => ({ back: jest.fn(), push: jest.fn() }),
}));
jest.mock("@/components/multiview/useMultiviewQualityPicker", () => ({
  useMultiviewQualityPicker: () => ({
    quality: "8 Mb/s",
    openShared: jest.fn(),
    openTile: jest.fn(),
  }),
}));
jest.mock("@/hooks/useTVOptionModal", () => ({
  useTVOptionModal: () => ({ showOptions: jest.fn() }),
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
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock("@/utils/multiview/availability", () => ({
  isMultiviewAvailable: () => true,
}));

// After the mocks, which it imports.
const MultiviewRoute = jest.requireActual("@/app/(auth)/multiview").default;

/** The tile menu's Scores item. */
const SCORES = 4;

beforeEach(() => {
  for (const key of Object.keys(mockTileProps)) delete mockTileProps[key];
  mockMounts.length = 0;
  mockUnmounts.length = 0;
  mockSheetChoices.length = 0;
  mockSheets.length = 0;
  mockSettings = { liveScoresEnabled: true, liveScoresDelaySeconds: 30 };
  mockHasView = true;
  mockOpenScores.mockClear();
});

describe("live scores on the multiview screen", () => {
  // R1 (v1's A1, now for the rail)
  test("draws the scores rail and keeps it when the toolbar hides", async () => {
    jest.useFakeTimers();
    try {
      await render(<MultiviewRoute />);
      expect(screen.getByTestId("scores-rail")).toBeTruthy();
      expect(screen.getByText("KC")).toBeTruthy();
      expect(screen.getByTestId("tile-tag-tile-0")).toBeTruthy();
      expect(screen.getByLabelText("multiview.change_layout")).toBeTruthy();

      await act(async () => {
        await jest.advanceTimersByTimeAsync(10_000);
      });
      // The toolbar has gone; the rail and the tag have not.
      expect(screen.queryByLabelText("multiview.change_layout")).toBeNull();
      expect(screen.getByTestId("scores-rail")).toBeTruthy();
      expect(screen.getByTestId("tile-tag-tile-0")).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  // R5
  test("Scores in the toolbar opens the scores screen and rebuilds no tile", async () => {
    await render(<MultiviewRoute />);
    await fireEvent.press(screen.getByLabelText("livescores.open_scores"));
    expect(mockOpenScores).toHaveBeenCalledTimes(1);
    expect([...mockMounts].sort()).toEqual(["a", "b"]);
    expect(mockUnmounts).toEqual([]);
  });

  // R5
  test("the tile menu's Scores item opens it too", async () => {
    await render(<MultiviewRoute />);
    mockSheetChoices.push(SCORES);
    await act(() => mockTileProps.a.onLongPress());
    expect(mockSheets[0].options[SCORES]).toBe("livescores.open_scores");
    expect(mockOpenScores).toHaveBeenCalledTimes(1);
    expect(mockUnmounts).toEqual([]);
  });

  // R10
  test("with no football on any tile: no rail, no Scores button or item", async () => {
    mockHasView = false;
    await render(<MultiviewRoute />);
    expect(screen.queryByTestId("scores-rail")).toBeNull();
    expect(screen.queryByLabelText("livescores.open_scores")).toBeNull();
    await act(() => mockTileProps.a.onLongPress());
    expect(mockSheets[0].options).not.toContain("livescores.open_scores");
    expect(mockSheets[0].options).toContain("multiview.remove_tile");
  });

  test("Remove is still the tile menu's destructive option, below Scores", async () => {
    await render(<MultiviewRoute />);
    await act(() => mockTileProps.a.onLongPress());
    const sheet = mockSheets[0] as {
      options: string[];
      destructiveButtonIndex?: number;
      cancelButtonIndex?: number;
    };
    expect(sheet.options[sheet.destructiveButtonIndex ?? -1]).toBe(
      "multiview.remove_tile",
    );
    expect(sheet.options[sheet.cancelButtonIndex ?? -1]).toBe("common.cancel");
  });
});
