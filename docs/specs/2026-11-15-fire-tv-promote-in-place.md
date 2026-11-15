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
