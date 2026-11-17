# SuperFin on the Mac

SuperFin runs on Apple silicon Macs as the iPad app ("Designed for iPad"). There is no Mac Catalyst build, and that is a decision, not a gap:

- **MPVKit has no Mac Catalyst slice.** `ios/Pods/MPVKit/MPVKit.xcframework` holds `ios-arm64`, `ios-arm64_x86_64-simulator` and the tvOS slices only. A Catalyst build would need MPV rebuilt for `ios-arm64_x86_64-maccatalyst`.
- **Neither do the prebuilt Expo modules.** `ExpoModulesCore`, `ExpoImage`, `ExpoCamera` and the rest ship as xcframeworks without that slice.

The iPad app on a Mac uses the same binary, the same MPV renderer and the same multiview as the iPad. It runs only on Apple silicon; Intel Macs are not supported.

## What the app does differently on a Mac

- **Window**: `ios.requireFullScreen` is `false` in `app.json`, so the window resizes freely (and iPad gets Split View and Stage Manager). On the Mac it cannot shrink below 960 by 600 (`components/MacWindowSize.tsx`, `constants/Mac.ts`). Layout follows `useWindowDimensions`; don't read `Dimensions.get("window")` once at import, it does not follow a resize.
- **Sidebar**: the Mac hides the native tab bar and draws its own sidebar beside the tabs (`components/MacSidebar.tsx`): the sections, the user's libraries, Settings at the foot. Apple's sidebar-adaptable `TabView` style is iPad only (`usesNativeSidebar`): in a Mac window it skipped its layout after the toggle (`.claude/learned-facts/sidebar-adaptable-breaks-in-a-mac-window.md`).
- **Library page**: past 700pt wide it is a grid of cover tiles (`components/library/LibraryTile.tsx`) instead of the phone's list.
- **Keyboard shortcuts**: `modules/key-commands` registers `UIKeyCommand`s on the root view controller, and `components/AppKeyCommands.tsx` handles them: ⌘1 to ⌘4 for Home, Search, Favorites and Library, ⌘F for Search, ⌘, for Settings, ⌘[ for Back. The list is `utils/keyCommands.ts`. App-wide shortcuts are ⌘ only, so text fields keep their keys; a screen adds bare keys of its own only while it is open (`useScreenKeyCommands`: multiview's 1 to 4 and G). The same shortcuts work with an iPad keyboard; hold ⌘ to see them.
- **Player keys**: the native player takes space (play and pause) and ← and → (skip by the configured amounts) from upstream's `PlayerKeyboardPolicy.swift`, which leaves them to a sheet or the scrubber that owns them; SuperFin adds ↑ and ↓ (volume), M (mute) and Escape (close) in `PlayerKeyBindings.swift`. `scripts/ios/test-player-key-bindings.sh` and `scripts/ios/test-player-keyboard-policy.sh` check them.
- **Detecting a Mac**: `isMac()` in `utils/platform.ts`. `Platform.OS` is `"ios"` and `Platform.isPad` can be true, so nothing in React Native alone tells a Mac apart; `expo-device` reports a desktop for an iPad app on a Mac.
- **Header buttons**: a `TouchableOpacity` in `headerLeft`/`headerRight` takes no clicks on the Mac (see `.claude/learned-facts/macos-header-buttons-fix.md`). The Biome rule `biome-plugins/header-no-touchable-opacity.grit` fails the lint when one is added.

## Running it on this Mac

In Xcode, pick the **My Mac (Designed for iPad)** destination for the `SuperFin` scheme and run. From the command line:

```bash
xcodebuild -workspace ios/SuperFin.xcworkspace -scheme SuperFin \
  -destination 'platform=macOS,variant=Designed for iPad' build
```

It needs the signing team set in `app.json` (`ios.appleTeamId`).

## Shipping it

An iPad app reaches the Mac through the App Store record it already has: in App Store Connect, under the app's **Pricing and Availability**, keep **Make this app available on Mac** checked for iPhone and iPad apps on Apple silicon. No separate build or upload is needed. TestFlight builds can be installed on a Mac the same way.

Outside the App Store, an iPad app can't be notarized and handed out as a `.app` the way a native Mac app can. Direct download needs a real Mac build, which means Catalyst and so an MPVKit with a Catalyst slice.

## Checking a change on the Mac

- Resize the window from small to full screen: Home, the item page, the Live TV guide and multiview reflow.
- Every header button takes a click.
- ⌘1 to ⌘4, ⌘F, ⌘, and ⌘[ work, and typing in Search is not taken over.
- The sidebar marks the open section or library, and the player answers space and the arrows with Touch Alternatives off.
- Playback, Picture in Picture, and multiview with four tiles.
- Sleep and wake in the middle of a stream.
