import { act, renderHook } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";

const mockRelease = jest.fn();
const mockHold = jest.fn(() => mockRelease);
jest.mock("@/modules/exoplayer-player/src/mediaKeys", () => ({
  holdMediaKeySession: () => mockHold(),
}));

import { useMediaKeySession } from "./useMediaKeySession";

/** The AppState listener the hook added, to play app state changes. */
let appStateListener: ((state: AppStateStatus) => void) | undefined;
const mockRemoveAppState = jest.fn();

describe("useMediaKeySession", () => {
  beforeEach(() => {
    mockHold.mockClear();
    mockRelease.mockClear();
    mockRemoveAppState.mockClear();
    appStateListener = undefined;
    Object.defineProperty(AppState, "currentState", {
      value: "active",
      configurable: true,
    });
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_, listener) => {
        appStateListener = listener as (state: AppStateStatus) => void;
        return { remove: mockRemoveAppState } as never;
      });
  });
  afterEach(() => jest.restoreAllMocks());

  it("holds the session while mounted and lets go on unmount", async () => {
    const { unmount } = await renderHook(() => useMediaKeySession());
    expect(mockHold).toHaveBeenCalledTimes(1);
    expect(mockRelease).not.toHaveBeenCalled();
    await unmount();
    expect(mockRelease).toHaveBeenCalledTimes(1);
    expect(mockRemoveAppState).toHaveBeenCalled();
  });

  it("doesn't hold it while inactive", async () => {
    await renderHook(() => useMediaKeySession(false));
    expect(mockHold).not.toHaveBeenCalled();
  });

  // Review, 2026-11-15: after Home on the Fire TV, multiview and the player
  // stay mounted in the background, and the session kept taking ⏯ from the
  // home screen. The spec says leaving gives ⏯ back to the system.
  it("lets go while the app is in the background, and holds it again on return", async () => {
    await renderHook(() => useMediaKeySession());
    expect(mockHold).toHaveBeenCalledTimes(1);

    await act(async () => appStateListener?.("background"));
    expect(mockRelease).toHaveBeenCalledTimes(1);

    await act(async () => appStateListener?.("active"));
    expect(mockHold).toHaveBeenCalledTimes(2);
  });

  it("doesn't hold it twice when the app reports active again", async () => {
    await renderHook(() => useMediaKeySession());
    await act(async () => appStateListener?.("active"));
    expect(mockHold).toHaveBeenCalledTimes(1);
  });
});
