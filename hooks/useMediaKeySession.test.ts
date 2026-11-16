import { renderHook } from "@testing-library/react-native";

const mockRelease = jest.fn();
const mockHold = jest.fn(() => mockRelease);
jest.mock("@/modules/exoplayer-player/src/mediaKeys", () => ({
  holdMediaKeySession: () => mockHold(),
}));

import { useMediaKeySession } from "./useMediaKeySession";

describe("useMediaKeySession", () => {
  beforeEach(() => {
    mockHold.mockClear();
    mockRelease.mockClear();
  });

  it("holds the session while mounted and lets go on unmount", async () => {
    const { unmount } = await renderHook(() => useMediaKeySession());
    expect(mockHold).toHaveBeenCalledTimes(1);
    expect(mockRelease).not.toHaveBeenCalled();
    await unmount();
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it("doesn't hold it while inactive", async () => {
    await renderHook(() => useMediaKeySession(false));
    expect(mockHold).not.toHaveBeenCalled();
  });
});
