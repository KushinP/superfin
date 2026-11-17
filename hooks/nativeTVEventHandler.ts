import { Platform } from "react-native";
import type { TVRemoteKeyEvent } from "@/hooks/useTVEventHandler";

type UseTVEventHandler = (callback: (evt: TVRemoteKeyEvent) => void) => void;

let tvEventHandler: UseTVEventHandler = () => {};

if (Platform.isTV) {
  try {
    tvEventHandler = require("react-native")
      .useTVEventHandler as UseTVEventHandler;
  } catch {
    tvEventHandler = () => {};
  }
}

/**
 * react-native-tvos's own key event hook, a no-op off TV. Use
 * useTVEventHandler, which also hears the media keys Fire OS keeps from it.
 */
export const nativeTVEventHandler = tvEventHandler;
