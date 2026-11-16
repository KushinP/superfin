import type { EventSubscription } from "expo-modules-core";
import { requireNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

/** The media keys the session passes on, named as react-native-tvos names them. */
export type MediaKey =
  | "playPause"
  | "play"
  | "pause"
  | "rewind"
  | "fastForward";

type MediaKeysNativeModule = {
  startMediaKeySession(): void;
  stopMediaKeySession(): void;
  addListener(
    event: "onMediaKey",
    listener: (event: { key: MediaKey }) => void,
  ): EventSubscription;
};

// Android TV only. Fire OS hands ⏯ ⏪ ⏩ to the system's media session, never
// to the app as key presses (Fire TV, 2026-11-15), so the app has to hold
// one to hear them. Wrapped so a build without the module just has no keys.
const MediaKeys: MediaKeysNativeModule | null = (() => {
  if (Platform.OS !== "android" || !Platform.isTV) return null;
  try {
    return requireNativeModule<MediaKeysNativeModule>("ExoPlayer");
  } catch {
    return null;
  }
})();

let holders = 0;

/**
 * Opens the media session for as long as something holds it: multiview and
 * the player can both be mounted for a moment while one replaces the other,
 * so the session closes only when the last one lets go.
 */
export const holdMediaKeySession = (): (() => void) => {
  if (!MediaKeys) return () => {};
  if (holders === 0) MediaKeys.startMediaKeySession();
  holders += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders -= 1;
    if (holders === 0) MediaKeys.stopMediaKeySession();
  };
};

/** Called with each media key the session receives. */
export const addMediaKeyListener = (
  listener: (key: MediaKey) => void,
): EventSubscription | null =>
  MediaKeys?.addListener("onMediaKey", ({ key }) => listener(key)) ?? null;
