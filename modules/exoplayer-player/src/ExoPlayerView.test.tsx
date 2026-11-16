import { render } from "@testing-library/react-native";
import type { MpvPlayerViewRef } from "@/modules/mpv-player";

const mockNativeDestroy = jest.fn();
jest.mock("expo", () => {
  const { forwardRef, useImperativeHandle } = jest.requireActual("react");
  return {
    requireNativeView: () =>
      forwardRef(function MockNativeExoPlayer(_props: object, ref: unknown) {
        useImperativeHandle(ref, () => ({ destroy: mockNativeDestroy }));
        return null;
      }),
  };
});

import ExoPlayerView from "./ExoPlayerView";

describe("ExoPlayerView", () => {
  beforeEach(() => mockNativeDestroy.mockClear());

  // A multiview tile keeps its handle (lastPlayer) and calls destroy() from
  // its unmount cleanup. React 19 clears the wrapper's own ref to the native
  // view before that cleanup runs (react19-ref-cleared-before-effect-cleanup),
  // so destroy() reached nothing, and since #11 nothing else freed the
  // decoder until the native view was dropped.
  test("destroy() still reaches the native player after the view unmounts", async () => {
    let handle: MpvPlayerViewRef | null = null;
    const { unmount } = await render(
      <ExoPlayerView
        ref={(player) => {
          if (player) handle = player;
        }}
        source={undefined as never}
      />,
    );
    await unmount();

    await (handle as MpvPlayerViewRef | null)?.destroy();

    expect(mockNativeDestroy).toHaveBeenCalledTimes(1);
  });
});
