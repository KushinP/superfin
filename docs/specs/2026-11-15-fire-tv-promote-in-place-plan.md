# Technical plan: Making a multiview tile the main tile keeps it playing

Status: Approved (Gate 2). Kush's words, relayed by the "Jellyfin live TV server troubleshooting" session on 2026-11-15: "Approve plan".
Date: 2026-11-15
Branch: kush/fire-tv-promote-in-place
Spec: [2026-11-15-fire-tv-promote-in-place.md](2026-11-15-fire-tv-promote-in-place.md)

## 1. Architecture decisions
**A. Where the fix lives.**
- **Decision:** in JS. The screen keeps a stable draw order and positions each tile by its place in the layout.
- **Alternative:** make ExoPlayerView survive a detach (release from Expo's view destroy callback instead of `onDetachedFromWindow`). Rejected for now: it needs a native rebuild, a missed destroy would leak a decoder and audio sink, and the Fire TV can't be touched for testing.
- **Why:** reloads with Metro, testable in Jest, and removes the cause (the re-order) on every platform.

**B. How the draw order is kept.**
- **Decision:** a pure helper `tileDrawOrder(previous, tiles)` in `utils/multiview/multiview.ts`. It keeps the previous order of keys still present, drops removed ones, and appends new ones in the order they appear in `tiles`. The screen holds the previous order in a ref.
- **Alternative:** store the order in `MultiviewState`. Rejected: every state function would have to keep it in step, and it's only a drawing concern.
- **Why:** small, pure and tested on its own.

**C. Focus.** `hasTVPreferredFocus` and `onTargetRef` follow the main tile (layout index 0), not the first tile drawn.

## 2. Components and files
| File | Job |
|---|---|
| `utils/multiview/multiview.ts` | New `tileDrawOrder(previous, tiles)`. |
| `utils/multiview/multiview.test.ts` | Unit tests for `tileDrawOrder`. |
| `app/(auth)/multiview.tsx` | Draws tiles in `tileDrawOrder` order. Each tile's frame and focus props come from its index in `state.tiles`. |
| `app/(auth)/multiview.test.tsx` (new) | Screen tests for checks 1-7, with a stand-in tile that records its mounts. |

**Flow:**
1. Promotion reorders `state.tiles` as today.
2. The screen computes the draw order from the previous one, which is unchanged.
3. Each tile gets the frame for its layout index.
4. React updates the props only, so the native view moves and resizes in place.

**External calls:** none.

## 3. Schema
None.

## 4. Dependencies
None.
- Tests use the existing Jest setup.
- The worktree links to the main checkout's installed packages (`bun.lock` is identical).
- An Android TV emulator for check 8 is not installed. It needs its own checkpoint.

## 5. Failure modes
- **A key appears twice:** impossible, since `addTile` uses unique keys. The helper still drops duplicates.
- **Removal:** the removed tile's view goes, as today. The others aren't re-ordered, so they aren't detached.
- **playNext and reconnect** change the React key, so that tile is rebuilt on purpose (check 6). It keeps its draw slot, because the tile key is unchanged.
- **Focus order with the remote** is spatial on Android TV, so the draw order doesn't steer it. The explicit focus props follow the main tile.
- **Silent failure:** a tile drawn without a frame. The screen skips a tile with no frame, as today; the test checks every tile is drawn.

## 6. Test plan
| Check | Test | File |
|---|---|---|
| 1 | "making a small tile main keeps the draw order and gives it the big frame" | app/(auth)/multiview.test.tsx |
| 2 | "tapping a small tile in focus keeps the draw order" | same |
| 3 | "switching to focus keeps the draw order" | same |
| 4 | tileDrawOrder unit tests, plus "removing and adding tiles keeps the others' order" | multiview.test.ts, multiview.test.tsx |
| 5 | "a promotion rebuilds no tile" | multiview.test.tsx |
| 6 | "a reconnected tile alone is rebuilt" | multiview.test.tsx |
| 7 | "the main tile gets the starting focus" | multiview.test.tsx |
| 8 | Emulator, then Fire TV after the game | by hand |

Checks 1-3 must fail before the fix and pass after it.

## 7. AI eval integrity
Not applicable.

## 8. Build order
1. Spec and plan commit.
2. Screen and unit tests, run and shown failing. Commit after the fix with the tests, as one passing commit.
3. Fix.
4. `/test-gate`.

## 9. Checkpoints
- Gate 2 covers: no schema, no dependencies.
- Still needs its own approval:
  - installing an Android TV emulator;
  - any install on the Fire TV, with a backup of the current release APK first;
  - pushing or a PR.

## 10. Risks and undo
- **The draw order no longer matches the layout order.** Tiles don't overlap, so nothing visible changes. Screen readers would read the tiles in the order they were added.
- **Undo:** revert the fix commit.

## Changes
- 2026-11-15: The screen test is `components/multiview/multiviewScreen.test.tsx`, not `app/(auth)/multiview.test.tsx`. Expo Router treats files under `app/` as screens, so a test there could become a route. Behavior unchanged.
- 2026-11-15: Check 5 ("a promotion rebuilds no tile") already passed before the fix. React never remounted a promoted tile: the reconnect came from the native view being re-ordered, which checks 1-3 reproduce. It stays as a control.
- **2026-11-15, addendum (approved by Kush: "approve"): native lifecycle fix.** This replaces decision 1A's "no native change". The device test shows the long-press menu alone takes the tile views off the window, and the player is released then.
  - **Decision.**
    - `ExoPlayerView.onDetachedFromWindow()` stops calling `destroy()`. A detached view keeps its player. When the view is put back, PlayerView rebinds the video surface on its own. A TextureView or SurfaceView gets a new surface, and Media3's listener sets it on the player.
    - `ExoPlayerModule`'s View gets `OnViewDestroys { view -> view.destroy() }`, as `HeroCarouselModule.kt` already does. Expo calls it when React removes the view for good.
    - `destroy()` is already safe to call twice: `player?.release()` then `player = null`.
  - **Release paths that remain.**
    1. JS `destroy()` on tile unmount (`MultiviewTile.tsx:170`) and on every full-screen player exit (`direct-player.tsx`).
    2. `OnViewDestroys`.
  - **Alternative.** Rebuild the player in `onAttachedToWindow` from the saved config. Rejected: it still drops the stream, and the server would see a new session.
  - **Files.**
    - `modules/exoplayer-player/android/src/main/java/expo/modules/exoplayerplayer/ExoPlayerView.kt`: the detach handler and a comment.
    - `ExoPlayerModule.kt`: `OnViewDestroys`.
    - `.claude/learned-facts/` plus its index line in `CLAUDE.md`: a fact recording that ExoPlayerView must not release on detach.
  - **Risk.**
    - A player whose view is detached while its screen stays mounted (for example covered by a pushed screen) now keeps playing instead of being released, as MPV on iOS already does.
    - A JS path that forgets `destroy()` and an Expo build that skips `OnViewDestroys` would both have to fail for a player to leak.
  - **Tests.**
    - Not coverable in Jest (native lifecycle).
    - CI compiles the Kotlin. There is no Android SDK on this Mac.
    - The proof is checks 9-11 on the Fire TV, run by the fork session, with the logcat pass rule: no `ExoPlayerImpl: Release` at a long-press, and no new `master.m3u8`.
  - **Undo.** Revert the commit. Reinstalling the backed-up APK (`~/superfin-fire-tv-backup/base.apk`) rolls back the device.
- **2026-11-15, addendum 2 (approved by Kush: "approve"): TV tile menu.**
  - **Decision.**
    - In `app/(auth)/multiview.tsx`, `onTileLongPress` calls `showOptions` from `useTVOptionModal` when `Platform.isTV`, and keeps `showActionSheetWithOptions` elsewhere.
    - Each option's value is the action, and one `runTileAction(key, action)` serves both paths, so they cannot drift apart.
    - The title is the tile's item name, passed up from `MultiviewTile` with the long-press (`onLongPress(name)`), falling back to "Tile options".
    - Quality opens a second TV menu, so the first is dismissed first (`deferApplyUntilDismissed: true`, the documented case of an onSelect that navigates).
    - On return, focus goes back to the long-pressed tile with `requestTVFocus()`, as the screen already does for the quality button (`android-tv-modal-close-loses-focus`).
  - **Alternative.** An absolutely positioned panel over the tile. Rejected by the repo's TV rules (Back handling).
  - **Files.**
    - `app/(auth)/multiview.tsx`.
    - `components/multiview/MultiviewTile.tsx`: passes its name with the long-press.
    - `translations/en.json`: one new key, "Tile options", if no existing key says it.
    - `components/multiview/multiviewScreen.test.tsx`.
  - **Tests.** In `multiviewScreen.test.tsx`, with `useTVOptionModal` mocked:
    - check 12: TV opens the TV menu with the tile's name and not the action sheet;
    - check 13: each option's `onSelect` performs the right action;
    - check 15: a phone still opens the action sheet.

    Checks 14 and 16 are on the device.
  - **Risk.**
    - The menu is a route on top of multiview, so it may take the tile views off the window. That's harmless only with addendum 1, so the two ship together.
    - Focus return after Back must be checked on the device.
  - **Size.** About 80 lines of code plus tests, together with addendum 1's ~10. That's still one PR (#10), but it is now two concerns: the player lifecycle and the menu. Splitting the menu into its own PR is an option if Kush prefers.
