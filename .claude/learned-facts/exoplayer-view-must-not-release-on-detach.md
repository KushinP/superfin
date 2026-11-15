# ExoPlayerView Must Not Release Its Player on Detach

**Date**: 2026-11-15
**Category**: native
**Key files**: `modules/exoplayer-player/android/src/main/java/expo/modules/exoplayerplayer/ExoPlayerView.kt`, `ExoPlayerModule.kt`, `components/multiview/MultiviewTile.tsx`

## Detail

An Android view is taken off the window and put back while it stays on
screen. Re-ordering siblings does it, and so did the long-press menu of a
multiview tile on a Fire TV (the phone action sheet), to every tile at once.

`ExoPlayerView` used to call `destroy()` from `onDetachedFromWindow()`, and
nothing rebuilt the player on reattach. So every tile went black. A live
channel then reconnected after the 30 s stall rule, which meant a new stream,
tuner session and FFmpeg encode on the server, and often an HTTP 500 on the
reopen. In logcat both tiles showed `ExoPlayerImpl: Release` at the moment
of the long-press.

The player is now released only:
- by JS `destroy()` (a tile's unmount cleanup, every full-screen player exit);
- by `OnViewDestroys` in `ExoPlayerModule`, when React really drops the view.

`destroy()` is safe to call twice. On reattach, the TextureView or SurfaceView
gets a new surface and Media3's own listener rebinds it, so nothing has to be
rebuilt.

MPV on iOS keeps its player across window changes (`MpvPlayerView.didMoveToWindow`),
which is why only Android TV showed this.

## Symptom pattern

A native player goes black after an unrelated UI action (a menu, a re-order,
a modal route) and comes back only by reconnecting, with a release logged at
the moment of that action and no JS unmount.
