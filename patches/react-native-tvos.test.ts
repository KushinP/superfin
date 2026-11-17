// Kush, Fire TV, 2026-11-17: "whenever i press the ok (center button) i hear a
// double click sound". Android plays the system click itself when OK releases a
// focusable view (its click listener, ReactViewManager.setFocusable), and
// react-native-tvos's Pressability played the same click again before onPress.
// Our patch keeps Android's click on TV and drops the second one; this fails if
// a regenerated patch or a version bump brings it back.

const mockPlayTouchSound = jest.fn();

jest.mock("react-native/Libraries/Components/Sound/SoundManager", () => ({
  __esModule: true,
  default: { playTouchSound: mockPlayTouchSound },
}));

/** Pressability as it runs on the given platform, a TV or a phone. */
const pressabilityOn = (isTV: boolean) => {
  jest.resetModules();
  jest.doMock("react-native/Libraries/Utilities/Platform", () => ({
    __esModule: true,
    default: {
      OS: "android",
      isTV,
      select: (choices: Record<string, unknown>) =>
        choices.android ?? choices.default,
    },
  }));
  return require("react-native/Libraries/Pressability/Pressability").default;
};

beforeEach(() => mockPlayTouchSound.mockClear());

test("OK on an Android TV remote runs the press without a second click", () => {
  const Pressability = pressabilityOn(true);
  const onPress = jest.fn();
  const handlers = new Pressability({ onPress }).getEventHandlers();

  // What the native view sends when OK goes down and comes back up.
  handlers.onPressIn({});
  handlers.onPressOut({});

  expect(onPress).toHaveBeenCalledTimes(1);
  expect(mockPlayTouchSound).not.toHaveBeenCalled();
});

test("a phone keeps React Native's press click (must not change)", () => {
  const Pressability = pressabilityOn(false);
  const onPress = jest.fn();
  const handlers = new Pressability({ onPress }).getEventHandlers();

  handlers.onPressIn({});
  handlers.onPressOut({});

  expect(onPress).toHaveBeenCalledTimes(1);
  expect(mockPlayTouchSound).toHaveBeenCalledTimes(1);
});
