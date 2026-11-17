import type { KeyCommand } from "@/modules/key-commands";

export type AppKeyCommandAction =
  | { kind: "tab"; href: string }
  | { kind: "push"; href: string }
  | { kind: "back" };

export type AppKeyCommand = Omit<KeyCommand, "title"> & {
  /** Translation key of the title shown in the shortcut overlay. */
  titleKey: string;
  action: AppKeyCommandAction;
};

/**
 * The app-wide keyboard shortcuts on iPad and the Mac. Only ⌘ shortcuts:
 * a bare key would be taken from the text fields and the player.
 */
export const APP_KEY_COMMANDS: AppKeyCommand[] = [
  {
    id: "tab-home",
    input: "1",
    modifiers: ["command"],
    titleKey: "tabs.home",
    action: { kind: "tab", href: "/(auth)/(tabs)/(home)" },
  },
  {
    id: "tab-search",
    input: "2",
    modifiers: ["command"],
    titleKey: "tabs.search",
    action: { kind: "tab", href: "/(auth)/(tabs)/(search)" },
  },
  {
    id: "tab-favorites",
    input: "3",
    modifiers: ["command"],
    titleKey: "tabs.favorites",
    // Upstream moved Favorites into More's stack (Expo SDK 58 tab layout).
    action: { kind: "tab", href: "/(auth)/(tabs)/(more)/favorites" },
  },
  {
    id: "tab-library",
    input: "4",
    modifiers: ["command"],
    titleKey: "tabs.library",
    action: { kind: "tab", href: "/(auth)/(tabs)/(libraries)" },
  },
  {
    id: "search",
    input: "f",
    modifiers: ["command"],
    titleKey: "tabs.search",
    action: { kind: "tab", href: "/(auth)/(tabs)/(search)" },
  },
  {
    id: "settings",
    input: ",",
    modifiers: ["command"],
    titleKey: "tabs.settings",
    action: { kind: "push", href: "/(auth)/settings" },
  },
  {
    id: "back",
    input: "[",
    modifiers: ["command"],
    titleKey: "common.back",
    action: { kind: "back" },
  },
];
