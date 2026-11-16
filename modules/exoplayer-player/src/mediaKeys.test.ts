import { Platform } from "react-native";

const mockStart = jest.fn();
const mockStop = jest.fn();
let mockListener: ((event: { key: string }) => void) | undefined;
const mockRemove = jest.fn();
// Only "ExoPlayer" is faked; every other native module goes to the real
// lookup. jest.resetModules() below reads Expo's lazy global fetch in CI,
// which extends requireNativeModule("ExpoFetchModule").NativeResponse; the
// fake answered that name too, and CI failed with "Super expression must
// either be null or a function" (since #17).
jest.mock("expo-modules-core", () => {
  const actual = jest.requireActual("expo-modules-core");
  return {
    ...actual,
    requireNativeModule: (name: string) =>
      name === "ExoPlayer"
        ? {
            startMediaKeySession: mockStart,
            stopMediaKeySession: mockStop,
            addListener: (
              _: string,
              listener: (event: { key: string }) => void,
            ) => {
              mockListener = listener;
              return { remove: mockRemove };
            },
          }
        : actual.requireNativeModule(name),
  };
});

const setPlatform = (os: string, isTV: boolean) => {
  Object.defineProperty(Platform, "OS", { value: os, configurable: true });
  Object.defineProperty(Platform, "isTV", { value: isTV, configurable: true });
};

const load = () =>
  jest.requireActual<typeof import("./mediaKeys")>("./mediaKeys");

describe("the media key session", () => {
  const wasOS = Platform.OS;
  const wasTV = Platform.isTV;

  beforeEach(() => {
    jest.resetModules();
    mockStart.mockClear();
    mockStop.mockClear();
    mockListener = undefined;
  });

  afterAll(() => setPlatform(wasOS, wasTV));

  it("opens once for two holders and closes after the last lets go", () => {
    setPlatform("android", true);
    const { holdMediaKeySession } = load();
    const releaseMultiview = holdMediaKeySession();
    const releasePlayer = holdMediaKeySession();
    expect(mockStart).toHaveBeenCalledTimes(1);

    releaseMultiview();
    expect(mockStop).not.toHaveBeenCalled();
    releasePlayer();
    expect(mockStop).toHaveBeenCalledTimes(1);
  });

  it("lets go only once per hold", () => {
    setPlatform("android", true);
    const { holdMediaKeySession } = load();
    const release = holdMediaKeySession();
    const other = holdMediaKeySession();
    release();
    release();
    expect(mockStop).not.toHaveBeenCalled();
    other();
    expect(mockStop).toHaveBeenCalledTimes(1);
  });

  it("passes each key on by name", () => {
    setPlatform("android", true);
    const { addMediaKeyListener } = load();
    const keys: string[] = [];
    addMediaKeyListener((key) => keys.push(key));
    mockListener?.({ key: "playPause" });
    mockListener?.({ key: "fastForward" });
    expect(keys).toEqual(["playPause", "fastForward"]);
  });

  it("does nothing off Android TV", () => {
    setPlatform("ios", true);
    const { holdMediaKeySession, addMediaKeyListener } = load();
    holdMediaKeySession()();
    expect(addMediaKeyListener(() => {})).toBeNull();
    expect(mockStart).not.toHaveBeenCalled();
    expect(mockStop).not.toHaveBeenCalled();
  });
});
