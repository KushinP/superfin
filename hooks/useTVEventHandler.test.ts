import { act, renderHook } from "@testing-library/react-native";
import { Platform } from "react-native";
import { MEDIA_KEY_DEDUPE_MS } from "@/constants/Playback";

type Evt = { eventType: string; eventKeyAction?: number };

/** The handler the platform's key hook was given. */
let mockKeyEvents: ((evt: Evt) => void) | undefined;
jest.mock("@/hooks/nativeTVEventHandler", () => ({
  nativeTVEventHandler: (handler: (evt: Evt) => void) => {
    mockKeyEvents = handler;
  },
}));

/** The listener the media session was given. */
let mockSessionKeys: ((key: string) => void) | undefined;
const mockRemove = jest.fn();
jest.mock("@/modules/exoplayer-player/src/mediaKeys", () => ({
  addMediaKeyListener: (listener: (key: string) => void) => {
    mockSessionKeys = listener;
    return { remove: mockRemove };
  },
}));

import { useTVEventHandler } from "./useTVEventHandler";

const setPlatform = (os: string, isTV: boolean) => {
  Object.defineProperty(Platform, "OS", { value: os, configurable: true });
  Object.defineProperty(Platform, "isTV", { value: isTV, configurable: true });
};

describe("useTVEventHandler", () => {
  const wasOS = Platform.OS;
  const wasTV = Platform.isTV;

  beforeEach(() => {
    jest.useFakeTimers();
    mockKeyEvents = undefined;
    mockSessionKeys = undefined;
    mockRemove.mockClear();
    setPlatform("android", true);
  });

  afterEach(() => jest.useRealTimers());
  afterAll(() => setPlatform(wasOS, wasTV));

  // Fire OS hands the media keys to the system's media session, never to
  // the app as key events (Fire TV, 2026-11-15).
  it("hands a media session key on as a key press", async () => {
    const seen: Evt[] = [];
    await renderHook(() => useTVEventHandler((evt) => seen.push(evt)));
    await act(async () => mockSessionKeys?.("playPause"));
    expect(seen).toEqual([{ eventType: "playPause", eventKeyAction: 0 }]);
  });

  it("still passes key events through", async () => {
    const seen: Evt[] = [];
    await renderHook(() => useTVEventHandler((evt) => seen.push(evt)));
    await act(async () => mockKeyEvents?.({ eventType: "select" }));
    expect(seen).toEqual([{ eventType: "select" }]);
  });

  it("acts once when a press arrives both ways", async () => {
    const seen: Evt[] = [];
    await renderHook(() => useTVEventHandler((evt) => seen.push(evt)));
    await act(async () => {
      mockKeyEvents?.({ eventType: "playPause", eventKeyAction: 0 });
      jest.advanceTimersByTime(MEDIA_KEY_DEDUPE_MS - 1);
      mockSessionKeys?.("playPause");
    });
    expect(seen).toHaveLength(1);
  });

  it("takes a later session press as a new one", async () => {
    const seen: Evt[] = [];
    await renderHook(() => useTVEventHandler((evt) => seen.push(evt)));
    await act(async () => {
      mockKeyEvents?.({ eventType: "playPause", eventKeyAction: 0 });
      jest.advanceTimersByTime(MEDIA_KEY_DEDUPE_MS);
      mockSessionKeys?.("playPause");
    });
    expect(seen).toHaveLength(2);
  });

  it("stops listening to the session when it unmounts", async () => {
    const { unmount } = await renderHook(() => useTVEventHandler(() => {}));
    await unmount();
    expect(mockRemove).toHaveBeenCalled();
  });

  it("doesn't listen to a media session off Android TV", async () => {
    setPlatform("ios", true);
    await renderHook(() => useTVEventHandler(() => {}));
    expect(mockSessionKeys).toBeUndefined();
  });
});
