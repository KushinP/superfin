# Live scores, v2: a scores rail plus a scores screen on demand — product spec

Status: Approved (Gate 1)
Date: 2026-11-15
Branch: `kush/live-scores-rail`
Builds on: `docs/specs/2026-11-15-live-scores-overlay.md` (P0 shipped in #12). This replaces its P0-2 "score bug on the tile". The poller, the spoiler delay and the matching stay as built.

Decided by Kush (2026-11-15): a rail that's always on for glancing, and a scores screen on demand for details. Details shown: last play, game leaders, win probability, drive and timeouts. At most 2 games up at once (2 tuners).

---

## 1. Problem

**Hypothesis** (from Kush looking at mockups today; nothing has run on the TV yet).

The P0 bug sits in each tile's top-left corner, over the picture. With only two games up there's black space above and below the pictures, so covering the picture is unnecessary. Kush also wants:
- **the rest of the league:** "I'd like to see other games too";
- **more than the score:** last play, leaders, win probability, drive.

Putting all of that next to each tile looked messy: overlapping strips and too many boxes. In his words: "this seems messy."

What would confirm it: on a game day, Kush glances at the rail instead of his phone, and opens the scores screen when he wants detail.

## 2. Users and goals

**User:** Kush, Fire TV multiview, one or two live NFL games.

**Goals**
1. One glance at the bottom of the screen gives both of his games' scores and the rest of the league's, with nothing covering either picture.
2. One press opens everything about his games (last play, leaders, win probability, drive, timeouts) and one press closes it, without interrupting the video.
3. Still no spoilers on his own games.

**Non-goals**
- **Per-tile boxes or a stats card beside each tile.** That's the messy version this replaces.
- **Covering the pictures when 1–2 tiles are up.** The rail lives in the black band. Only the on-demand screen covers part of the picture, and only while it's open.
- **Sports beyond the NFL, phone notifications, other fantasy platforms.** Unchanged from v1.
- **Selecting games in the rail with the remote.** The rail is display-only, so it never steals focus from the tiles. Picking a game happens on the scores screen.
- **Play-by-play history, box scores or standings.** The scores screen shows the current state, not a full game center.

**Later**
- Tuning a tile to a game from the rail or the scores screen ("watch this game"), which needs a channel lookup.
- Red zone or scoring flashes in the rail.
- The v1 fantasy line (P1) on the scores screen.

## 3. User stories

1. As Kush, I want a thin scores rail in the black band under my games, so that I see all NFL scores at a glance without anything over the picture.
2. As Kush, I want my two games first in the rail, each with a color that matches its tile, so that I know which score belongs to which picture.
3. As Kush, I want the rest of today's games after mine (in-progress first, then upcoming, then final), so that I can follow the league.
4. As Kush, I want one press of the remote to open a scores screen with my games' details (last play, leaders, win probability, drive, timeouts) and every other game, and Back to close it, so that I get depth only when I ask.
5. As Kush, I want the spoiler delay controls on that screen, so that delay, on/off and details are all in one place.
6. **Empty state:** as Kush, with no NFL today, I want no rail at all, so that multiview looks as it always did.
7. **Error state:** as Kush, if ESPN can't be reached or its data changes, I want the rail to show "Scores unavailable" in small text, not stale scores. The scores screen should say why.
8. **Edge:** as Kush, if my tile's game can't be matched, it shouldn't be pinned or tagged; it just appears among the other games.

## 4. Requirements

### P0: must ship

- **P0-1 Scores rail.**
  - One translucent strip, centered in the black band below the tiles. It never overlaps a picture when 1–2 tiles are up, in either layout (side by side or one enlarged).
  - It's always visible while a football program is on any tile, and stays up when the toolbar hides.
- **P0-2 Your games first.**
  - Tiles matched to a game (by the existing matching) are pinned at the start of the rail, in tile order: score, quarter and clock, possession dot.
  - Each one gets a color tag, and its tile gets a thin edge of the same color.
- **P0-3 Rest of the league.**
  - Every other NFL game today, ordered in progress, then upcoming (kickoff time), then final, showing teams, score and quarter or time.
  - If they don't fit, the non-pinned part pages every 8 s. Pages, not scrolling: smoother and cheaper on a Fire TV.
- **P0-4 Spoiler delay.**
  - Pinned games keep the v1 delay (default 30 s, adjustable).
  - Other games show live (default; see open question 1).
- **P0-5 Scores screen on demand.**
  - Opened from a "Scores" button in the multiview toolbar and a "Scores" item in each tile's menu. That item replaces v1's "Live scores: 30 s behind" item.
  - It's a panel over the bottom half of the screen, and Back closes it.
  - Tiles keep playing behind it, with no reconnect (as in A6).
- **P0-6 What the scores screen shows.**
  - For each of your games: score, quarter and clock, down and distance, possession, last play, win probability, current drive (plays, yards, time), timeouts each, and the leaders (passing, rushing, receiving).
  - Then every other game, in the rail's order.
  - At the top: the delay with 5 s sooner and later, and Turn live scores off.
- **P0-7 Remove the v1 corner bug.** The rail replaces it. Settings (on/off, delay) are unchanged.
- **P0-8 Failures.** ESPN unreachable, unknown data, or data over 2 minutes old: the rail shows "Scores unavailable" and no scores, and the scores screen says why. No popups. A failed detail field (for example, no leaders yet) just leaves that line out.
- **P0-9 Polling stays as v1.** One shared scoreboard fetch, every 15 s while a game on screen is in play, 5 min otherwise, none with scores off or no football on screen. The details come from the same scoreboard fetch, so no extra requests.

### P1: fast follow

- **P1-1 3 or 4 tiles.** There's no black band, so the rail sits translucent along the very bottom edge of the screen, over the pictures' bottom few percent.
- **P1-2 Other games' details.** On the scores screen, selecting another game expands it with the same details.
- **P1-3 Fantasy.** The v1 P1 work (roster service, "my players" and toasts) moves onto the scores screen.

### P2: design for, don't build

- **P2-1 "Watch this game" from the scores screen:** tune a tile to the channel showing it.
- **P2-2 Other sports** in the rail.

## 5. Success

- **Number:** across 3 game days, zero early scores on pinned games and zero times the rail covers a picture with 1–2 tiles up. Kush notes any by hand.
- **Question to ask Kush:** "Did you open your phone for a score today? Did you open the scores screen, and was what you wanted on it?"

## 6. Acceptance checks

| # | Given | When | Then | How |
|---|---|---|---|---|
| R1 normal | Two tiles on KC @ ATL (in play) and BUF @ NYJ, 12 games today | Multiview is open, side by side | The rail sits in the bottom black band: KC–ATL then BUF–NYJ pinned with their tile colors, then the other games in progress, upcoming, final order; nothing overlaps either picture | automated (layout math + render) + by hand |
| R2 layouts | The same two games | Switch to one tile enlarged | The rail moves to the band below the big picture and still overlaps no picture | automated |
| R3 paging | 12 other games don't fit | 8 s pass | The non-pinned part shows the next page; the pinned games stay | automated (fake clock) |
| R4 spoiler | Delay 30 s; KC scores in data at 1:00:00 | 1:00:29 / 1:00:30 | The pinned KC score changes at :30, not :29; an unpinned game's score changes as soon as it's fetched | automated |
| R5 open and close | Multiview with two games | Press Scores, then Back | The scores screen opens with both games' details and the full list, then closes; no tile is rebuilt or reconnected | automated (screen test counting tile builds) + by hand |
| R6 details | ESPN gives last play, win probability, drive, timeouts, leaders | Scores screen open | Each shows for your games; a missing one (no leaders before kickoff) is just left out | automated |
| R7 delay controls | Delay 30 s | "5 s later" on the scores screen | Delay 35 s; pinned scores lag 35 s | automated |
| R8 failure | ESPN fails or changes shape | Polling runs | The rail says "Scores unavailable", shows no scores; the scores screen gives the reason; the video is unaffected | automated |
| R9 unmatched | One tile's listing doesn't name a game | Multiview open | That tile has no color tag; its game (if any) appears unpinned | automated |
| R10 control | Scores off, or no football on any tile | Use multiview | No rail, no Scores button, no score requests; multiview as before #12 | automated |
| R11 TV focus | Fire TV remote | Move around tiles and toolbar | Focus never lands on the rail; the Scores button is reachable from the toolbar like the other buttons | by hand + screen test |

## 7. Open questions

1. **Should other games also wait for the delay?** Showing them live is fine for games you aren't watching. But if you then tune to one, its score was already shown live. **Default: live.**
2. **The Scores button's place in the toolbar.** **Default: after the layout button.**
3. **Your tile color tags.** **Default: blue for the first tile and amber for the second, as in the mockups.**

## Risks

- **The black band's height varies by layout.** With one tile enlarged it's about 75 screen units, and the rail is about 40, so it fits. Layout math tests guard it (R1, R2).
- **Unofficial ESPN fields.** The leaders, last play, win probability and drive fields come from the same unofficial feed and can change. Each detail is optional, and a missing one is left out (R6).
- **Merges with #12's menu changes.** The tile menu item changes name and job. develop's screen tests cover the menu order.
- **Fire TV look.** "Glass" on Android TV is a see-through dark panel. True blur isn't available there.

---
