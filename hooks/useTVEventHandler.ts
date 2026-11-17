import { useCallback, useEffect, useRef } from "react";
import type { TVRemoteEvent } from "react-native";
import { Platform } from "react-native";
import { MEDIA_KEY_DEDUPE_MS } from "@/constants/Playback";
import { nativeTVEventHandler } from "@/hooks/nativeTVEventHandler";
import { addMediaKeyListener } from "@/modules/exoplayer-player/src/mediaKeys";
import { writeDebugLog } from "@/utils/log";

/**
 * A TV remote event. react-native-tvos 0.88 types `eventKeyAction` as a
 * string, but both platforms send a number: -1 unknown, 0 down, 1 up
 * (RCTTVNavigationEventNotificationConstants.mm on tvOS,
 * ReactAndroidHWInputDeviceHelper on Android).
 */
export type TVRemoteKeyEvent = Omit<TVRemoteEvent, "eventKeyAction"> & {
  eventKeyAction?: number;
};

const isPress = (evt: TVRemoteKeyEvent) =>
  evt.eventKeyAction === undefined || evt.eventKeyAction === 0;

/**
 * The TV remote's keys, a no-op off TV. On Android TV it also hears the
 * media keys from the app's media session: Fire OS sends ⏯ ⏪ ⏩ there and
 * never as key presses (Fire TV, 2026-11-15). They arrive as the same events
 * react-native-tvos sends, so a handler needn't know which way a key came.
 */
export const useTVEventHandler = (
  callback: (evt: TVRemoteKeyEvent) => void,
) => {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  // When each key last arrived as a key press, so a box that also hands it
  // on to the session doesn't act on one press twice.
  const pressedAt = useRef(new Map<string, number>());

  const onKeyEvent = useCallback((evt: TVRemoteKeyEvent) => {
    if (evt?.eventType && isPress(evt)) {
      pressedAt.current.set(evt.eventType, Date.now());
    }
    callbackRef.current(evt);
  }, []);
  nativeTVEventHandler(onKeyEvent);

  useEffect(() => {
    if (!Platform.isTV || Platform.OS !== "android") return;
    const subscription = addMediaKeyListener((key) => {
      const at = pressedAt.current.get(key);
      const acted = at === undefined || Date.now() - at >= MEDIA_KEY_DEDUPE_MS;
      // So a device log shows what reached the player, and when: on the
      // Fire TV (2026-11-15) nothing played with the session open, and
      // nothing said whether a key had arrived.
      writeDebugLog("Media keys: from the media session", { key, acted });
      if (!acted) return;
      callbackRef.current({
        eventType: key,
        eventKeyAction: 0,
      } as TVRemoteKeyEvent);
    });
    return () => subscription?.remove();
  }, []);
};
