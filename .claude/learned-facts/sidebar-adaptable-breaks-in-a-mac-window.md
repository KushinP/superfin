# Apple's sidebar-adaptable tab view skips its layout in a Mac window

**Date**: 2026-11-04
**Category**: navigation
**Key files**: `utils/platform.ts` (`usesNativeSidebar`), `components/MacSidebar.tsx`, `app/(auth)/(tabs)/_layout.tsx`

## Detail

`react-native-bottom-tabs` (the tab bar before Expo SDK 58) applied SwiftUI's `.tabViewStyle(.sidebarAdaptable)`
when `sidebarAdaptable` is set. On an iPad it works: the floating tab bar gets
a toggle to a sidebar and back. In the iPad app on a Mac ("Designed for iPad")
the toggle animates but nothing lays out after it: the sidebar comes back as
an empty blurred panel over half the window, and closing it leaves the
floating tab bar stuck at the window's left edge, cut off. The same build on
an iPad simulator, in either orientation, is fine.

So the Mac does not use it. It hides the native tab bar and draws
`MacSidebar` beside the tabs; `sidebarAdaptable` is on for an iPad only.

Since Expo SDK 58 the tabs are Expo Router's own (`expo-router/native-tabs`),
not `react-native-bottom-tabs`: the bar is hidden with `<NativeTabs hidden>`
and the sidebar flag is `<NativeTabs sidebarAdaptable>`. Whether Expo's
sidebar has the same Mac bug is not checked: the Mac keeps `MacSidebar`.

Changing `sidebarAdaptable` while the app runs (a Fast Refresh that flips it)
crashes with `UIViewControllerHierarchyInconsistency`. In the app the value is
fixed at launch, so only development sees it.

## Symptom pattern

On the Mac only: after the sidebar toggle, an empty sidebar panel, or the
tab bar pinned to the left edge. Resizing the window does not reliably fix it.
