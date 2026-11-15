# Live scores overlay and fantasy players: product spec

Status: Approved (Gate 1)
Date: 2026-11-15
Branch: `kush/live-scores-overlay`

Decisions already made by Kush (2026-11-15): fantasy league is on **ESPN**; first version is **NFL only**; alerts are **Fire TV only** (no phone); spoiler delay defaults to **30 s**, adjustable.

---

## 1. Problem

**Hypothesis** (no ticket or data; this is Kush's own Sunday setup).

On Sundays Kush runs multiview on the Fire TV with up to 4 over-the-air NFL games from the HDHomeRun. Each tile shows only the channel name (for example "WCBS"), and only while the toolbar is visible. To know the score, the clock, or the down in a small tile he has to promote it to the main tile or squint at the broadcaster's own graphic, which is unreadable at quarter size. To know whether his fantasy players are doing anything, he picks up his phone and opens the ESPN app, which is also the fastest way to get spoiled: ESPN's app is real time, and his TV picture is roughly 15–45 seconds behind (over-the-air plus Jellyfin transcoding).

Cost today: constant phone checking during games, missed big plays in small tiles, and spoilers ("my phone says touchdown, the TV still shows 2nd and 8").

What would confirm it: after a few Sundays with the feature, Kush checks his phone less during games and never sees a score on the TV before the play happens on screen.

## 2. Users and goals

**User:** Kush, watching live NFL on the Fire TV in Superfin's multiview (one household, one TV, one ESPN fantasy league).

**Goals**
1. Glancing at any live NFL tile tells Kush the score, quarter, clock and down/distance, without promoting it.
2. The overlay never tells him something the picture hasn't shown yet (no spoilers, within the delay he set).
3. He knows when one of his fantasy players scores, on the TV, without picking up his phone.

**Non-goals**
- **Sports other than the NFL.** Kush chose NFL only; other sports need different layouts (no downs in basketball). Parked in Later.
- **Phone notifications.** Kush chose Fire TV only. Push is off in this fork anyway (no EAS project id or Firebase file) and would send data off the box.
- **Sleeper or Yahoo leagues.** His league is on ESPN. Yahoo also needs a full OAuth sign-in.
- **Fantasy scoring or lineup management** (projections, points totals, setting a lineup). The ESPN app does this; we only answer "did my guy just score?".
- **Exact sync with the picture.** We can't read the broadcast's own clock; the delay is a manual setting, not automatic lip-sync.
- **Anything heavy on the Jellyfin server box.** It is already short on memory and disk; this feature adds nothing to Jellyfin itself.
- **Apple TV, iPhone, iPad, Mac.** Fire TV (Android TV) first. The design shouldn't block them, but they aren't tested.

**Later**
- College football, NBA, MLB, NHL score bugs.
- A scores ticker across the bottom of multiview (feature 3).
- Score bug in the full-screen player, not just multiview tiles.
- "Red zone" highlight: flash a tile's border when its game is inside the 20.
- Automatic delay calibration (Kush presses a button when he sees a touchdown; we compute the delay).
- Phone alerts.

## 3. User stories

Most important first.

1. As Kush, I want each live NFL tile to show a small score bug (both teams, score, quarter, clock, down and distance) so that I can follow four games without promoting any of them.
2. As Kush, I want the score bug to lag real time by a delay I can set (default 30 s) so that it never shows a score before the play happens on my screen.
3. As Kush, I want to nudge that delay up or down from the TV remote while watching, so that I can match it to what I see without leaving multiview.
4. As Kush, I want a tile whose program isn't an NFL game (news, a movie, a rerun) to show no score bug, so that I never see a wrong score.
5. As Kush, I want to see which of my ESPN fantasy players are in a tile's game, so that I know which game matters to me.
6. As Kush, I want a short toast on the TV when one of my fantasy players scores (touchdown, field goal for my kicker, and so on), delayed by the same spoiler delay, so that I don't have to watch my phone.
7. **Empty state:** as Kush, when no NFL game is on (Tuesday night), I want nothing extra on screen and nothing polling, so that the app stays exactly as it is today.
8. **Error state:** as Kush, when score data can't be loaded (ESPN down or its format changed), I want the bug to disappear quietly (no error popups over my games), and a short note in the tile's stats/menu that scores are unavailable.
9. **Error state:** as Kush, when my ESPN fantasy cookies have expired, I want one clear message telling me fantasy is off and how to fix it, while the score bug keeps working.
10. **Ambiguous match:** as Kush, when the app can't tell which game a channel is showing, I want it to show nothing rather than guess, and to let me pick the game from the tile's menu.

## 4. Requirements

### P0: must ship (feature 1, the score bug)

- **P0-1 Match a tile to a game.** For each live TV tile in multiview, use the channel's current guide (EPG) program title and the channel name to find today's NFL game. A match needs both teams named in the title (for example "NFL Football: Bills at Chiefs") or a single NFL game on that channel's network in that time slot. If two games could match, or none, show nothing.
- **P0-2 Score bug on the tile.** Small, readable at quarter-tile size on a TV: both team abbreviations, scores, quarter, game clock, and down and distance with possession when the ball is live. Shows halftime, end of quarter and "Final". Stays visible when the toolbar hides (unlike the name label), and doesn't cover the center of the picture.
- **P0-3 Spoiler delay.** Everything the bug shows is what the data said *delay seconds ago*, not now. Default 30 s, range 0–90 s, in 5 s steps. One setting for all tiles (all come from the same tuner and transcode path, so lag is similar).
- **P0-4 Adjust delay from the remote.** In the tile's hold menu (next to Make main, Quality, Stats), add "Score delay +5 s / −5 s" showing the current value. Also in Settings, TV and mobile.
- **P0-5 On/off.** A setting "Show live scores on tiles", default on. Off means no polling at all.
- **P0-6 Poll once, share it.** One scoreboard fetch serves every tile on the device, no matter how many tiles show games. Polls only while multiview is open and at least one tile is matched or being matched. No polling when no NFL game is live. Nothing new runs on the Jellyfin server.
- **P0-7 Fail quietly.** Any data problem (network down, unexpected format, ESPN changes its unofficial feed) hides the bug. No popups during a game. The tile's Stats overlay says "Scores unavailable" with the reason.
- **P0-8 Doesn't disturb playback.** Showing, updating or hiding the bug never reconnects, restarts or re-renders the video player.

### P1: fast follow (feature 2, fantasy)

- **P1-1 Connect ESPN fantasy.** Kush's league id and team are settings. His private-league cookies (`espn_s2`, `SWID`) are secrets: they live only in `.env`, never in the app's code, logs, git or the shipped app bundle. (Where they're read from is an open question below.)
- **P1-2 "My players in this game" panel.** When a tile's game has any of Kush's rostered starters (and optionally bench), the tile menu or an expanded overlay lists them with their stat line (for example "J. Allen: 2 pass TD, 1 rush TD").
- **P1-3 Scoring toast.** When one of his players scores, show a TV toast ("Josh Allen: rushing TD, BUF 21–17") using the existing toast, after the same spoiler delay. One toast per scoring play, even if the data is fetched several times.
- **P1-4 Fantasy failure.** Expired or wrong cookies: one toast per session ("ESPN fantasy sign-in expired: update your cookies") and the panel hides. The score bug is unaffected.
- **P1-5 Manual game pick.** From the tile menu, "Choose game…" lists today's live NFL games; picking one overrides the automatic match for that tile until the program changes.

### P2: design for, don't build

- **P2-1 Scores ticker** across the multiview (feature 3), fed by the same shared data.
- **P2-2 Other sports** (college football first): keep the matching and the bug layout per-sport, not NFL-hardcoded throughout.
- **P2-3 Score bug in the full-screen player.**
- **P2-4 Other fantasy platforms** (Sleeper is free and public): keep the fantasy source swappable.
- **P2-5 A different scores source** if ESPN's unofficial feed breaks: keep the source behind one swappable piece.

## 5. Success

- **Number:** spoiler-free accuracy. Out of every score change the bug shows across 3 Sundays of real use, the share that appears **on or after** the play is on screen and on the right game. Measured by hand: Kush notes any early or wrong score in a running note. **Target: zero early scores and zero wrong-game bugs** over 3 Sundays.
- **Question to ask Kush:** "During the last game day, how often did you pick up your phone to check a score or a fantasy player?"

## 6. Acceptance checks

| # | Given | When | Then | How |
|---|---|---|---|---|
| A1 normal | A tile on a channel whose program is "NFL Football: Bills at Chiefs", and that game is live 14–10 BUF, 2nd qtr 3:12, 2nd & 8 | Multiview is open | The tile shows BUF 14, KC 10, 2nd, 3:12, 2nd & 8 with possession, and it stays when the toolbar hides | automated (fake score data) + by hand on Fire TV |
| A2 spoiler delay | Delay is 30 s and the data changes to BUF 21 at 1:00:00 | Time is 1:00:29 / 1:00:30 | At :29 the bug still shows 14; at :30 it shows 21 | automated (fake clock) |
| A3 edge: not a game | A tile shows "Local News at 6" | Multiview is open | No score bug, and no scoreboard poll if no other tile matched | automated |
| A4 edge: ambiguous | The title is just "NFL Football" and two games are live on that network's slot | Matching runs | No bug is shown (no guessing) | automated |
| A5 edge: program change | A matched game ends and the guide moves to "60 Minutes" | The next guide refresh | The bug shows "Final" until the program changes, then disappears | automated |
| A6 edge: delay change | Delay is 30 s | Kush picks "+5 s" from the tile menu | The setting is 35 s, the menu shows 35 s, and the bug's lag changes without the video reconnecting | automated + by hand |
| A7 edge: one poll | 4 tiles each show a different live NFL game | 2 minutes pass | Scoreboard fetches happen once per poll interval in total, not once per tile | automated (count fetches) |
| A8 failure | The scoreboard request fails or returns an unexpected shape | Polling runs | Bugs hide, no popup, Stats shows "Scores unavailable", the video keeps playing; bugs come back when data is good again | automated |
| A9 fantasy (P1) | Kush's starter Josh Allen is in BUF–KC and the data shows him scoring a rushing TD | The delay has passed | One toast "Josh Allen: rushing TD", even if the next 5 fetches still contain that play | automated |
| A10 fantasy failure (P1) | The ESPN cookies are expired | The fantasy data loads | One toast saying the sign-in expired; the score bug still works; the cookies never appear in logs | automated |
| A11 control: must not change | Scores setting off, or no live NFL anywhere | Kush uses multiview (promote, reconnect, audio switch, stats) | Behavior, layout and network traffic are exactly as today: no score requests | automated (existing multiview tests pass unchanged + a no-fetch check) |
| A12 control: secrets | A release build | Inspect the app bundle and logs | No `espn_s2` or `SWID` value appears anywhere | by hand (search the built bundle) |

## 7. Open questions

Only ones that change the plan. Each has a default so work can continue.

1. **Where do the ESPN fantasy cookies live and get used?** They must stay in `.env` only. A Fire TV app can't safely read a `.env` at run time: anything bundled into the app (`EXPO_PUBLIC_*`) ships inside the APK, so it isn't secret. The choices are (a) a tiny fantasy-fetching service that runs next to Jellyfin on the Ubuntu box, reads `.env`, and gives the TV only "who scored" (small, but adds something to a box that's already tight), or (b) a tiny service on another always-on machine at home. **Default: (a), kept to a few MB of memory, and only for P1 (the P0 score bug needs no secrets).** Gate 2 will size it.
2. **Do bench players count for the toast?** **Default: starters only for the toast; bench shown in the panel.**
3. **How should channels map to networks?** OTA channel names are call signs (WCBS, WNBC), not "CBS". **Default: a short hand-filled list of Kush's channels to networks in settings, only used when the program title doesn't name both teams.**
4. **Poll interval.** ESPN's feed is unofficial, so we shouldn't hammer it. **Default: every 15 s while a matched game is live, every 5 min otherwise; tuned in Gate 2.**

## Risks

- **ESPN's scoreboard feed is unofficial** and can change or break without notice. Mitigation: fail quietly (P0-7), keep the source swappable (P2-5).
- **Spoilers.** If the delay is set lower than the real lag, the bug spoils. Mitigation: default 30 s on the safe side, easy remote adjustment, and the success measure tracks it.
- **Guide titles vary** ("NFL Football", "NFL on CBS", team nicknames vs cities). Mitigation: show nothing when unsure, plus manual pick (P1-5).
- **Server box pressure** if the fantasy service (open question 1) runs there. Mitigation: P1 only, sized in Gate 2, easy to turn off.
- **ESPN cookies expire** every so often. Mitigation: one clear message (P1-4).
- **Touching multiview** while another session changes tile ordering on `kush/fire-tv-promote-in-place`. This feature only adds an overlay inside the tile and must not change render order or keys (A11).
