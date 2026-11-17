import { renderHook } from "@testing-library/react-native";
import { Alert } from "react-native";
import { pressTVBack } from "@/test-utils/tvBackPress";
import { useRemoteControl } from "./useRemoteControl";

let mockConfirmBeforeStopping = true;

jest.mock(
  "react-native-reanimated",
  () => jest.requireActual("@/test-utils/reanimated").reanimatedModule,
);
jest.mock("@/i18n", () => ({
  __esModule: true,
  default: { t: (key: string) => key },
}));
jest.mock("@/utils/atoms/settings", () => ({
  useSettings: () => ({
    settings: { confirmBeforeStoppingPlayback: mockConfirmBeforeStopping },
  }),
}));
/** The remote key handler the hook gave useTVEventHandler. */
let mockTVKeys:
  | ((evt: { eventType: string; eventKeyAction?: number }) => void)
  | undefined;
jest.mock("@/hooks/useTVEventHandler", () => ({
  useTVEventHandler: (
    handler: (evt: { eventType: string; eventKeyAction?: number }) => void,
  ) => {
    mockTVKeys = handler;
  },
}));

const pressBack = async (props: { showControls?: boolean } = {}) => {
  const onBack = jest.fn();
  const onWillExit = jest.fn();
  const onHideControls = jest.fn();
  await renderHook(() =>
    useRemoteControl({
      showControls: props.showControls ?? false,
      toggleControls: jest.fn(),
      onBack,
      onWillExit,
      onHideControls,
      videoTitle: "Movie",
    }),
  );
  const handled = pressTVBack();
  return { handled, onBack, onWillExit, onHideControls };
};

afterEach(() => jest.restoreAllMocks());

beforeEach(() => {
  mockConfirmBeforeStopping = true;
  mockTVKeys = undefined;
  jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
});

describe("pressing back with the controls hidden", () => {
  test("asks before stopping playback by default", async () => {
    const { handled, onBack } = await pressBack();

    expect(handled).toBe(true);
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(onBack).not.toHaveBeenCalled();
  });

  test("stops playback straight away when the confirmation is turned off", async () => {
    mockConfirmBeforeStopping = false;

    const { handled, onBack, onWillExit } = await pressBack();

    expect(handled).toBe(true);
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(onBack).toHaveBeenCalledTimes(1);
    // The countdown must still be held back while the player closes.
    expect(onWillExit).toHaveBeenCalledTimes(1);
  });
});

describe("pressing back with the controls visible", () => {
  test("only hides them, whatever the setting", async () => {
    mockConfirmBeforeStopping = false;

    const { onBack, onHideControls } = await pressBack({ showControls: true });

    expect(onHideControls).toHaveBeenCalledTimes(1);
    expect(onBack).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});

// Fire TV, 2026-11-15: in single view ⏯ worked but ⏪ and ⏩ did nothing.
// The player only knew the arrow keys; the remote's own seek keys arrive
// as "rewind" and "fastForward".
describe("the remote's ⏪ and ⏩ keys", () => {
  const renderSeek = async (showControls: boolean) => {
    const onMinimalSeekLeft = jest.fn();
    const onMinimalSeekRight = jest.fn();
    await renderHook(() =>
      useRemoteControl({
        showControls,
        toggleControls: jest.fn(),
        onMinimalSeekLeft,
        onMinimalSeekRight,
      }),
    );
    return { onMinimalSeekLeft, onMinimalSeekRight };
  };

  test.each([
    ["hidden", false],
    ["showing", true],
  ])("seek back and forward with the controls %s", async (_, showControls) => {
    const { onMinimalSeekLeft, onMinimalSeekRight } =
      await renderSeek(showControls);

    mockTVKeys?.({ eventType: "rewind", eventKeyAction: 0 });
    mockTVKeys?.({ eventType: "fastForward", eventKeyAction: 0 });

    expect(onMinimalSeekLeft).toHaveBeenCalledTimes(1);
    expect(onMinimalSeekRight).toHaveBeenCalledTimes(1);
  });

  test("one seek per press, not on the release", async () => {
    const { onMinimalSeekLeft } = await renderSeek(false);

    mockTVKeys?.({ eventType: "rewind", eventKeyAction: 0 });
    mockTVKeys?.({ eventType: "rewind", eventKeyAction: 1 });

    expect(onMinimalSeekLeft).toHaveBeenCalledTimes(1);
  });
});

// Fire TV review, 2026-11-15: with Scores open over live TV, the player's
// controls hid after 5 s and left/right between games seeked the picture
// behind the panel. While another screen is on top, the player leaves the
// D-pad to it; the remote's own media keys still act on the video.
describe("with another screen on top (disableSeeking)", () => {
  const renderCovered = async () => {
    const handlers = {
      onMinimalSeekLeft: jest.fn(),
      onMinimalSeekRight: jest.fn(),
      onVerticalDpad: jest.fn(),
      onInteraction: jest.fn(),
      togglePlay: jest.fn(),
    };
    await renderHook(() =>
      useRemoteControl({
        showControls: false,
        toggleControls: jest.fn(),
        disableSeeking: true,
        ...handlers,
      }),
    );
    return handlers;
  };

  test("left, right, up and down do nothing", async () => {
    const handlers = await renderCovered();

    for (const eventType of ["left", "right", "up", "down"]) {
      mockTVKeys?.({ eventType, eventKeyAction: 0 });
    }

    expect(handlers.onMinimalSeekLeft).not.toHaveBeenCalled();
    expect(handlers.onMinimalSeekRight).not.toHaveBeenCalled();
    expect(handlers.onVerticalDpad).not.toHaveBeenCalled();
  });

  test("⏯ ⏪ ⏩ still act on the video", async () => {
    const handlers = await renderCovered();

    mockTVKeys?.({ eventType: "playPause", eventKeyAction: 0 });
    mockTVKeys?.({ eventType: "rewind", eventKeyAction: 0 });
    mockTVKeys?.({ eventType: "fastForward", eventKeyAction: 0 });

    expect(handlers.togglePlay).toHaveBeenCalledTimes(1);
    expect(handlers.onMinimalSeekLeft).toHaveBeenCalledTimes(1);
    expect(handlers.onMinimalSeekRight).toHaveBeenCalledTimes(1);
  });
});
