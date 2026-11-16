# Live scores, v3: every game on the rail, you pick yours (product spec)

Status: Approved (Gate 1). Kush: "approve", 2026-11-15.
Date: 2026-11-15
Branch: `kush/live-scores-pick`
Builds on: `docs/specs/2026-11-15-live-scores-rail.md` (v2, shipped in #16) and `docs/specs/2026-11-15-live-scores-overlay.md` (v1, #12). This replaces their automatic guide matching.

---

## 1. Problem

Kush, after the Fire TV test on 2026-11-15: "Would it not make sense for it to just show all scores on the rail, and when I click on demand more details I can pick what game I want to keep it simple".

- **Evidence (Fire TV, develop @ e5abf850, 2026-11-15):**
  - 49ers–Cowboys on WFXT ran past its guide slot.
  - The guide moved on to "The OT", a postgame show that names no teams.
  - Matching found nothing, so the tile showed no score.
  - In #16 the rail and the Scores button also appear only while a tile's guide title looks like football ("football" or "NFL"). So with the newest build the rail and the Scores button would have been missing too.
  - The guide itself was stale until 19:29 that night, which may have broken earlier tests.
- **Cost:** scores fail exactly when games run long, which is every week. Single channel view has no scores at all.

## 2. Users and goals

**User:** Kush on the Fire TV, watching live NFL in multiview or full screen.

**Goals**
1. The rail shows every live NFL score, whatever the guide says.
2. One click shows any game's details, and Kush picks the games he cares about.
3. The same works in single channel view.
4. Still no spoilers.

**Non-goals**
- **Automatic matching from the guide.** It's the part that broke. Removed.
- **Color tags on tiles.** They depended on matching.
- **Other sports, phone alerts, fantasy.** Unchanged from v1 and v2.
- **Selecting on the rail itself.** The rail stays display-only, so it never takes focus from the video.

**Later**
- Matching as a suggestion only ("Looks like SF @ DAL. Pin it?"), never deciding on its own.
- Pin a game to a specific tile, with a colored edge.
- "Watch this game": tune a tile to it.

## 3. User stories

1. As Kush, I see every in-progress NFL game on the rail, in multiview and in single channel view, without setting anything up.
2. As Kush, I open Scores, select any game, and see its details: last play, drive, down and distance, win probability, timeouts, leaders.
3. As Kush, I press "Follow" on a game there. It moves to the front of the rail and the top of Scores, and stays until it ends.
4. As Kush, I never see a score before my TV shows the play.
5. **Empty:** with no NFL game in progress there's no rail. Scores still lists today's upcoming and final games.
6. **Error:** if ESPN fails, the rail says "Scores unavailable" and Scores says why. No popups.

## 4. Requirements

### P0
- **P0-1 Rail with every game.**
  - Shown whenever an NFL game is in progress and scores are on. It doesn't depend on the guide.
  - **Multiview:** placed as today.
  - **Single channel view:** along the bottom edge, shown together with the player controls.
  - **Order:** followed games, then in progress, upcoming, final.
  - **Paging:** every 8 s if the games don't fit.
- **P0-2 Scores screen.**
  - **Opening:** from a Scores button, always present while scores are on, in the multiview toolbar and in single view's controls.
  - **List:** every game. Selecting one expands its details (v2's P1-2 becomes P0).
  - **Following:** a Follow / Unfollow button, with up to 2 followed games.
  - **Delay controls:** stay at the top.
- **P0-3 Follows.** A follow lasts until that game is final, applies to both views, and is forgotten when the app restarts.
- **P0-4 Spoiler delay on every game** (default 30 s), not just followed ones. Simpler, and a game you switch to can't have been spoiled.
- **P0-5 Polling.**
  - One shared ESPN fetch while multiview or a live channel is open and scores are on.
  - Every 15 s while any game is in progress, every 5 min otherwise. None otherwise.
- **P0-6 Remove guide matching** and its settings.
- **P0-7 Log.** Each fetch's result (game count and status) and each Follow change go to the app log, so a device test shows what happened.
- **P0-8 Playback isn't disturbed.** The rail and Scores never reconnect or rebuild a video.

### P1
- Pin a followed game to a tile, with a colored edge.
- Matching as a suggestion only.

### P2
- Other sports.
- "Watch this game".

## 5. Success

- **Number:** over the next 2 game days, how many times there are "no scores" while Kush watches live TV with an NFL game in progress, including overtime and late games. **Target: 0.**
- **Question for Kush:** "Did you have to do anything to get scores today?"

## 6. Acceptance checks

| # | Given | When | Then | How |
|---|---|---|---|---|
| S1 normal | 3 games in progress, a tile on a postgame show ("The OT") | Multiview is open | The rail shows all 3 | automated |
| S2 single view | Same | A live channel is open full screen, controls shown | The same rail is shown | automated + by hand |
| S3 details and follow | Scores is open | Select SF @ DAL, then Follow | Its details show; it's first on the rail and at the top of Scores | automated |
| S4 follow ends | SF @ DAL is followed | It goes final | It's no longer pinned first | automated |
| S5 spoiler | Delay 30 s, any game scores at 1:00:00 | 1:00:29 / 1:00:30 | The change appears at :30, not :29 | automated (fake clock) |
| S6 empty | No game in progress | A view is open | No rail; Scores lists upcoming and final games | automated |
| S7 failure | ESPN fails or returns an unknown format | Polling runs | "Scores unavailable", no popup, video unaffected | automated |
| S8 limit | 2 games followed | Follow a third | Decided in Gate 2: ask which to replace, or disable the button | automated |
| S9 control | Scores off, or a movie in single view | Use the app | No rail, no Scores button, no ESPN requests | automated |
| S10 device | Fire TV, a real game | Both views | The rail and Follow work | by hand |

## 7. Open questions (defaults apply unless Kush says otherwise)

1. **Single view rail: always visible, or only with the controls?** Default: with the controls, so it never covers the picture uninvited.
2. **Follow limit.** Default: 2, matching the 2 tuners.
3. **Delay on every game.** Default: yes.
