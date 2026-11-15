# Spec: Making a multiview tile the main tile keeps it playing

Status: Approved (Gates 1 and 2). Kush's words, relayed by the "Jellyfin live TV server troubleshooting" session on 2026-11-15: "Approve plan".
Date: 2026-11-15
Branch: kush/fire-tv-promote-in-place

## 1. Problem
Kush: "Making a tile the main tile on fire tv forces a reconnect, it needs to be easier."

- **Who feels it:** anyone watching multiview on Fire TV or Android TV. It happens every time a tile is made the main tile, and when switching from the grid to the focus layout (which does the same thing to the tile being heard).
- **What it costs:**
  - **A live channel** freezes. After the 30 s stall rule it reconnects, which means a stop report, the server closing the tuner, a new FFmpeg encode and a new tuner session.
  - **Reopening that soon** can get HTTP 500 back from the server, and two live tiles plus a reopen can run out of the two tuners.
  - **A movie or episode tile** stays frozen until the user picks Reconnect.
- **Evidence (code, 2026-11-15):**
  - Promotion moves the tile to the front of the list the screen draws.
  - React keeps the tile, but Android removes its native view and adds it back at the front.
  - On being removed, the Android TV player (ExoPlayerView) releases itself and never rebuilds. The iPhone, iPad and Mac player does not, which is why only TV is affected.
  - Not yet seen in a device log. Check 8 confirms it.

## 2. Users and goals
Users: Kush watching two to four channels or shows in multiview on the living room Fire TV.

Goals:
- Making a tile the main tile is instant: the picture keeps playing, at most a brief reframe.
- No new stream, tuner or encode on the server for a promotion.
- Switching between grid and focus layouts behaves the same way.

Non-goals:
- **Changing the Android player's own detach behaviour.** That needs a native rebuild and risks leaking players. It's a separate, optional hardening.
- **Faster reconnects in general.** That's covered by the live tile backoff work.
- **Animating the move.** The tiles jump to their new place, as today.

Later: make ExoPlayerView survive a brief detach (P2 below).

## 3. User stories
1. As Kush, I want to make a small tile the main one and keep watching it without a freeze.
2. As Kush, I want switching to the focus layout to enlarge the tile I'm hearing without reconnecting it.
3. As Kush, I want removing or adding a tile to leave the other tiles playing.
4. As Kush, when a tile moves on to its next episode or I press Reconnect, I still want a fresh stream (that must not change).

## 4. Requirements
- **P0:** the screen draws tiles in the order they were added, whatever their place in the layout. Promotion and layout changes only change each tile's position and size.
- **P0:** the remote's starting focus and the toolbar's focus link still go to the main tile.
- **P1:** none.
- **P2 (design for, don't build):** ExoPlayerView releases only when the view is destroyed, not on a brief detach.

## 5. Success
- **Measure:** promotions that cause a new stream. Today every promotion on Fire TV does. Target: 0. Measured in Jellyfin's log: no new "Opening channel stream" or "Playback stopped" for a promoted live tile.
- **Question for Kush:** "Did making a tile the main one feel instant?"

## 6. Acceptance checks
1. Given two tiles in the focus layout, when the small one is made main from its menu, then the tiles are drawn in the same order as before and the promoted tile gets the big frame. **Automated.**
2. Given the focus layout with the toolbar showing, when a small tile is tapped (or selected with the remote), then the draw order is unchanged and it gets the big frame. **Automated.**
3. Given the grid with the second tile heard, when the layout switches to focus, then the draw order is unchanged. **Automated.**
4. Given a promoted tile, when another tile is removed, or a new one added, then the remaining tiles keep their draw order and a new tile is drawn last. **Automated.**
5. Given a promotion, then no tile is rebuilt, so no stop report and no new stream are sent. **Automated** (as a check on the screen; the stream lives inside the tile).
6. **Must not change:** given a tile that plays its next episode, or is reconnected, then that tile alone is rebuilt with a fresh stream. **Automated.**
7. Given a promotion, then the remote's starting focus and the toolbar's focus link go to the new main tile. **Automated.**
8. Given a live channel tile on Android TV, when it's made main, then it keeps playing with no reconnect, and Jellyfin's log shows no new stream for it.
   - First on an Android TV emulator, not the Fire TV. Installing the emulator is its own checkpoint.
   - Then on the Fire TV, after the game, with Kush's OK, with the current release APK backed up first.

   **By hand.**

## 7. Open questions
- None that change the plan. Default: the order tiles were added is the draw order.

## Changes
- **2026-11-15, addendum (approved by Kush: "approve"): the real cause is native.**
  - **What the device test found.** The Fire TV test of PR #10's CI build, run by the "Jellyfin live TV server troubleshooting (fork)" session, showed tiles still reconnect. Kush: "Basically anytime I do the hold down on the tile, not even click anything it auto reconnects".
  - **The log.** It shows both tile players released (`ExoPlayerImpl: Release`) at the moment of the long-press, before any option is chosen. The app is reported as backgrounded, and the stall rule reopens both channels about 16 s later.
  - **The cause.** Anything that takes a tile's view off the window releases its player: the long-press menu, and possibly re-ordering. `ExoPlayerView.onDetachedFromWindow()` calls `destroy()`, and nothing rebuilds the player when the view comes back. The draw-order fix stays, since it is still correct, but it is not enough.
  - **New requirement (P0).** On Android, a player view taken off the window and put back keeps its player and stream. The player is released only when React really removes the view.
  - **New acceptance checks.**
    9. Given multiview on Android TV with two live tiles, when a tile is long-pressed and the menu dismissed, then both tiles keep playing: no `ExoPlayerImpl: Release` in logcat, and no new `master.m3u8` request or stream in Jellyfin. **By hand, on the Fire TV.**
    10. Given a tile that is removed, or the multiview screen closed, then its player is released (logcat `ExoPlayerImpl: Release` per tile) and Jellyfin logs the stop. **By hand.**
    11. **Must not change:** given the full-screen player on Android TV, when the user leaves it (Back, end of video, next episode), then the player is released and nothing keeps playing in the background. **By hand.**
- **2026-11-15, addendum 2 (approved by Kush: "approve"): the tile menu on TV.**
  - **Problem.** Kush: "The drawer also look shit if we can do anything about that".
    - On TV, a long-press opens the phone action sheet: a white panel over the bottom ~60% of the screen, with black left-aligned text and a red "Remove".
    - It has no title and no visible remote focus.
    - The area above it went black because the players had been released (addendum 1).
  - **Requirement (P0).** On TV, the tile's long-press opens the app's TV menu, the same one multiview's quality picker already uses on TV (`useTVOptionModal`).
    - It's a dark blurred panel whose title is the tile's channel or show name.
    - It offers the same five actions: Make main, Quality (with the current quality as a sublabel), Show or Hide stats, Reconnect, Remove.
    - The focused option is shown in white (TV rule: no coloured focus), and Back closes it with nothing changed.
    - Phones, the iPad and the Mac keep the action sheet.
  - **Non-goals.**
    - **Icons and a red "Remove":** the shared TV menu has neither, and adding them changes every TV menu in the app (P2).
    - **A custom panel drawn over the tiles:** the repo's TV rules forbid absolutely positioned overlays on TV, because Back doesn't work with them (`docs/conventions/tv.md`, `tv-modals-must-use-navigation-pattern`).
  - **Acceptance checks.**
    12. Given TV, when a tile is long-pressed, then the TV menu opens, titled with that tile's name, and the action sheet does not. **Automated.**
    13. Given the TV menu, when each option is chosen, then it does what the action sheet option did (make main, quality picker, stats, reconnect, remove). **Automated.**
    14. Given the TV menu, when Back is pressed, then nothing changes and focus returns to the tile. **By hand, on the Fire TV.** Jest can't press a TV remote.
    15. Given a phone, when a tile is long-pressed, then the action sheet still opens (must not change). **Automated.**
    16. Given the TV menu open over two live tiles, then both keep playing behind it. With addendum 1 the players aren't released. **By hand, on the Fire TV.**
