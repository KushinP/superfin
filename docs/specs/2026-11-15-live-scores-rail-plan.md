# Live scores v2 (rail and scores screen): technical plan (Gate 2)

Status: Approved (Gate 2)
Date: 2026-11-15
Branch: `kush/live-scores-rail` (worktree `~/superfin-live-scores`)
Product spec: `docs/specs/2026-11-15-live-scores-rail.md` (Approved, Gate 1, e6f84146)

## Context

v1 (#12) drew a small score bug in each tile's corner, over the picture. Kush approved a v2:
- a **rail** in the black band under the tiles, with his games pinned and color-tagged and the rest of the league after them;
- a **scores screen** on demand, with the details.

v1's poller (`hooks/useLiveScores.ts`), delay buffer, matching and settings stay. This plan swaps the display and adds the details.

### Checked today (2026-11-15)

- **ESPN's scoreboard feed already carries every detail:**
  - `situation.lastPlay.text` (for example "Official Timeout at 02:32.");
  - `situation.lastPlay.probability.homeWinPercentage` / `awayWinPercentage` (0.29 / 0.71);
  - `situation.lastPlay.drive.description` ("8 plays, 73 yards, 5:09");
  - `situation.homeTimeouts` / `awayTimeouts`;
  - `competitions[0].leaders[]` with `name` (`passingYards` / `rushingYards` / `receivingYards`) and `leaders[0]` carrying `displayValue` ("2/2, 43 YDS, 1 TD"), `athlete.shortName` and `team.id`.

  So there are **no extra requests**.
- **Leaders are per game:** one top passer, rusher and receiver across both teams, not per team.
- **A game before kickoff also has `leaders`**, probably season stats. They must be hidden until the game starts.
- **The app's code (exploration):**
  - TV menus over multiview are `transparentModal` routes, and multiview stays mounted under them. That's how `tv-option-modal` works today, and the ExoPlayer detach fix (#11) keeps tiles playing.
  - The pattern to copy for a richer sheet is `app/(auth)/tv-syncplay-modal.tsx` with `hooks/useSyncPlaySheet.tsx`: a route on TV, and `useGlobalModal().showModal()` (a bottom sheet) on phones.
  - On Android TV, `BlurView` only tints, so panels need a solid backing color (`rgba(18,18,20,0.96)`, as in `TVLibrarySheet.tsx:32`).
- **Layout math** (Fire TV, 960×540 screen units, from `tileFrames`):

  | Layout | Black band under the tiles |
  |---|---|
  | 2 tiles side by side | ≈135 |
  | 2 tiles, one enlarged | ≈75 (under the big picture) |
  | 1 tile | 0 (the picture fills the screen) |
  | 3–4 tiles | ≈0 |

## 1. Architecture decisions

1. **Where the rail goes: computed from the tile frames.**
   - `placeRail(frames, area, railHeight)` finds the black band below the lowest tile.
   - If the band fits the rail plus margins, the rail is centered in it and overlaps no picture.
   - Otherwise (1 tile, or 3–4), it sits over the very bottom edge, translucent. This makes the spec's P1-1 fallback part of P0, because one tile has no band (consistency fix 1).
   - Alternative: hide the rail with one tile. Rejected, because one game on screen is still when you'd want the league.
2. **Pinned games are delayed, others are live, and no pinned game ever leaks live.**
   - Pinned games come from the delayed snapshot, as today.
   - Other games come from the newest snapshot.
   - The trap: before the delay has passed, a tile's game isn't matched in the delayed snapshot yet, and would appear among the "other" games with its live score.
   - So the games to exclude from the live list are matched on the **newest** snapshot. Until the delay passes, a pinned slot shows only the teams and a dash, with no score (R4).
3. **Shared state for the scores screen: an atom.**
   - The screen is a separate route on TV, so it can't read multiview's hook state.
   - `useLiveScores` writes the view it computes (pinned games with tags, other games, status, delay) into `liveScoresViewAtom`. The rail and the screen both read it, so the screen updates while it's open.
   - Alternative: pass the data in route params. Rejected, because they'd be a snapshot that goes stale.
4. **Scores screen.**
   - **TV:** a new route `app/(auth)/tv-scores-modal.tsx` (`transparentModal`, `fade`), built like `tv-syncplay-modal.tsx`. It has a bottom panel with a solid backing, `TVFocusGuideView` focus traps, `useTVBackPress` to close, and the first control focused.
   - **Phones:** `useGlobalModal().showModal(<ScoresPanel/>, { snapPoints: ["50%"] })`.
   - `hooks/useScoresScreen.ts` picks between the two, like `useSyncPlaySheet`.
   - The content is one component, `ScoresPanel`, used on both.
5. **The Scores entry points.**
   - A new toolbar button after the layout button, with its own `scoresButton` ref and `scoresOpened` flag, so focus comes back to it after Back. That's the same pattern the quality button uses (`multiview.tsx:186-197`).
   - The tile menu's `"scores"` action now opens the scores screen instead of the delay sheet.
   - The delay controls move into the screen. `useLiveScoresMenu` and its tests are deleted (consistency fix 3).
6. **Tile color tags: drawn on the score layer, not in the tile.**
   - A 3-unit bar along the top edge of a matched tile's frame, in that tile's color, on the existing `pointerEvents="none"` layer.
   - `MultiviewTile` stays untouched. Its green "heard" and white "focus" borders still show with the toolbar, and the tag sits on top of them.
7. **Paging, not scrolling.**
   - `railItems` works out how many "other" chips fit from the rail width.
   - A page index advances every 8 s, using one timer for the layer. Pinned chips never page.
8. **Testing without the network.** As in v1: recorded fixtures, fake fetch and fake timers. One new fixture is recorded live with the detail fields present (a game in play, one before kickoff, one final).

## 2. Components and files

**New**
| File | One job |
|---|---|
| `utils/livescores/railLayout.ts` (+ test) | `placeRail(frames, area, height)` → `{left, top, width, overlay}` |
| `utils/livescores/railItems.ts` (+ test) | Order games (in progress, upcoming by kickoff, final), split pinned and others, pages for a given width |
| `utils/atoms/liveScores.ts` | `liveScoresViewAtom`: what the rail and the screen show |
| `components/multiview/ScoresRail.tsx` (+ test) | The strip: pinned chips with tag colors, a separator, the current page of others, or "Scores unavailable" |
| `components/multiview/ScoresPanel.tsx` (+ test) | The screen's content: delay controls, your games in full, the other games list |
| `app/(auth)/tv-scores-modal.tsx` | The TV route around `ScoresPanel` |
| `hooks/useScoresScreen.ts` (+ test) | Open the screen: the route on TV, a bottom sheet on phones |
| `utils/livescores/__fixtures__/scoreboard-details-2026-11-15.json` | A live recording with the detail fields |

**Changed**
- `utils/livescores/espnScoreboard.ts`: optional `details` on `GameScore` (`lastPlay`, `winProbability`, `drive`, `timeouts`, `leaders`). `leaders` only once the game has started. **A missing or odd detail is dropped; it never makes the whole board `null`** (unlike the core fields).
- `hooks/useLiveScores.ts`:
  - also return the newest games;
  - pinned = tiles matched on the delayed snapshot;
  - excluded = matched on the newest;
  - write the atom.
- `components/multiview/MultiviewScoreLayer.tsx`: draws the rail and tile tags instead of per-tile bugs.
- `components/multiview/ScoreBug.tsx`: becomes the rail chip (`RailChip`), with the text logic kept.
- `app/(auth)/multiview.tsx`:
  - the Scores toolbar button with focus return;
  - the `"scores"` tile action opens the screen;
  - pass `area` and the layout to the layer;
  - drop `useLiveScoresMenu`.
- `app/_layout.tsx`: register `tv-scores-modal` like the other TV modals (`:554-640`).
- `constants/LiveScores.ts`: rail height, margins, page interval (8 s) and the tag colors (blue `#60a5fa`, amber `#f59e0b`).
- `translations/en.json`: rail and screen strings. The menu's `livescores.menu_*` and `delay_*` keys are reused or removed so the i18n check stays clean.
- `components/multiview/multiviewScreen.test.tsx` / `multiviewScores.test.tsx`: the menu item is now "Scores" and opens the screen.

**Deleted:** `components/multiview/useLiveScoresMenu.ts` and its test. The behavior moves to `ScoresPanel`, whose tests cover the same cases (5 s later or sooner, clamped to 0–90, off and on).

**Data flow:**
1. The ESPN fetch, as today.
2. Snapshot buffer, giving the delayed and the newest snapshots.
3. Matching on each.
4. `liveScoresViewAtom`.
5. `ScoresRail` (always) and `ScoresPanel` (when open).
6. The screen's buttons write settings, which change the delay the hook reads.

## 3. Schema

**No new settings and no database.** v1's `liveScoresEnabled` and `liveScoresDelaySeconds` are reused. Memory only:
- **`GameScore.details`** (all optional):
  - `lastPlay?: string`;
  - `winProbability?: { home: number; away: number }` (0–1);
  - `drive?: string`;
  - `timeouts?: { home: number; away: number }`;
  - `leaders?: { category: "passing" | "rushing" | "receiving"; name: string; line: string; teamAbbr: string }[]`.
- **`liveScoresViewAtom`:**
  - `pinned: { tileKey, color, game | null }[]`, where `game` is null before the delay has passed;
  - `others: GameScore[]` (newest, excluding any game matched on screen);
  - `status: "ok" | "unavailable"` and `reason?`;
  - `delaySeconds`.

**Check against acceptance tests:** R1–R11 can all be computed from these, plus the frames, area and settings. Nothing is stored that v1 didn't.

## 4. Dependencies

None new. It reuses `expo-blur`, `@gorhom/bottom-sheet` through `GlobalModal`, Jotai and React Query, which are all already there.

## 5. Failure modes

- **A detail field is missing or changes shape:** that line is left out and everything else shows (R6). A test feeds a game with every detail broken.
- **Core data fails** (fetch, shape, stale): the rail says "Scores unavailable", and the screen says why (R8), as in v1.
- **Leaders before kickoff:** dropped, so season stats never pose as game stats.
- **A pinned game leaks live through the "others" list:** prevented by decision 2, with a test at :29 and :30 (R4).
- **One tile, or 3–4:** the rail overlays the bottom edge, and a test checks it stays inside the screen.
- **Focus on TV after the screen closes:** without a focus request, the next Back leaves multiview. Covered by the `scoresOpened` return, a screen test and a check by hand.
- **The phone bottom sheet under native tile views:** unverified (the exploration flagged it). Checked by hand on the iPhone simulator. If it's hidden, the fallback is an RN `Modal` like `MultiviewPicker`.
- **Opening or closing the screen reconnects a tile:** covered by a screen test counting tile builds (R5) and checked by hand on the Fire TV.

## 6. Test plan

| Check | Test |
|---|---|
| R1 normal | `railLayout.test.ts` "side by side: centered in the bottom band, no overlap"; `ScoresRail.test.tsx` "pinned first with tag colors, then in progress, upcoming, final" |
| R2 layouts | `railLayout.test.ts` "one enlarged: band under the big picture"; "one tile / four tiles: overlay at the bottom edge, inside the screen" |
| R3 paging | `railItems.test.ts` pages; `ScoresRail.test.tsx` "after 8 s the others show page 2; pinned stay" (fake timers) |
| R4 spoiler | `useLiveScores.test.tsx` "pinned score changes at :30, not :29"; "an unpinned game updates on fetch"; "a tile's game never appears live among the others before the delay" |
| R5 open and close | `multiviewScores.test.tsx` "Scores in the toolbar opens the screen; Back closes; no tile rebuilt" (TV and phone paths) |
| R6 details | `espnScoreboard.test.ts` details from the new fixture; "broken details are dropped, board kept"; "no leaders before kickoff"; `ScoresPanel.test.tsx` lines shown or left out |
| R7 delay controls | `ScoresPanel.test.tsx` "5 s later makes 35; clamped at 90 and 0; turn off" |
| R8 failure | `ScoresRail.test.tsx` "unavailable shows text, no scores"; `ScoresPanel.test.tsx` reason |
| R9 unmatched | `useLiveScores.test.tsx` "unmatched tile: no pin, no tag; its game among the others" |
| R10 control | `useLiveScores.test.tsx` (v1, unchanged) zero fetches; `multiviewScores.test.tsx` "scores off: no rail, no Scores button" |
| R11 TV focus | `multiviewScores.test.tsx` "the rail has no focusable element"; by hand on the Fire TV |

Then `/test-gate`. By hand on the Fire TV: R1, R2, R5 and R11 during a live game, once Jellyfin's guide is fixed.

## 7. AI features

Not applicable.

## 8. Build order

Each slice is about 300 lines or fewer and ends in a passing commit. If time runs out, P1-2 is cut first, then paging. Without paging, the rail shows only what fits.
1. **Details in the data.** Record the fixture; `GameScore.details` with tolerant parsing; tests (R6 data).
2. **Rail logic.** `railLayout` and `railItems`, pure, with tests (R1, R2, R3, R9 logic).
3. **The poller's view.** Newest vs delayed, the exclusion, the atom; tests (R4, R8, R9, R10).
4. **Rail on screen.** `ScoresRail`, `RailChip`, tile tags, and `MultiviewScoreLayer` switched over (the v1 bug is removed); tests (R1, R3, R8, R11).
5. **The scores screen.** `ScoresPanel` with tests (R6, R7, R8).
6. **Opening it.** The TV route plus `_layout` registration, the phone sheet, `useScoresScreen`, the toolbar button with focus return, the tile menu item; `useLiveScoresMenu` deleted; screen tests (R5, R10, R11).
7. *(P1-2)* Select another game on the screen to expand it.

P1-3 (fantasy) stays with the v1 P1 plan and isn't in this branch.

## 9. Checkpoints

- **Gate 2 covers:** no new settings and no new dependencies (sections 3–4).
- **Still separate:** pushing and opening the PR, and installing on the Fire TV. Fixing Jellyfin's guide is the server session's job (Kush approves there).

## 10. Risks and undo

- **Existing multiview:** with scores off or no football, nothing changes (R10).
  - The visible change for everyone: the v1 corner bug goes away, the rail and tags appear, and the tile menu's item becomes "Scores".
  - Undo: turn scores off, or revert the PR's squash commit.
- **A new route in `_layout.tsx`:** it's registered like the existing TV modals, and doesn't touch the provider order.

## 11. Consistency pass

Product spec changes, saved with this plan under `## Changes`:
1. **One tile up** has no black band, so the rail overlays the bottom edge, translucent. The P1-1 fallback is now P0 for 1, 3 or 4 tiles. The success measure ("never covers a picture") applies to 2 tiles.
2. **Leaders are per game** (one top passer, rusher and receiver across both teams), not per team, because that's what the scoreboard feed has. Per-team leaders would need a 400 KB summary per game.
3. **The delay controls move** from v1's tile-menu sheet to the scores screen, so v1's "Live scores: 30 s behind" sheet is deleted. The A6 "no reconnect" check now applies to opening and closing the screen (R5).
4. **Before the delay has passed,** a pinned slot shows only the teams and a dash, never a live score (R4).

Checked:
- every R-check maps to a named test;
- no stored data is added;
- the no-request control (R10) holds, because the details come from the same fetch;
- the rail stays display-only, matching the non-goal of no remote focus.

## Changes

- 2026-11-15, slice 4: v1's status words moved to `components/multiview/gameStatusText.ts`, shared by the rail chips and the scores panel, instead of keeping `ScoreBug.tsx` as the chip. `ScoreBug` and its tests are removed.
- 2026-11-15, slice 4: with no trustworthy data, the rail shows the specific reason ("Scores unavailable: ESPN can't be reached"), the same words the scores screen uses.
- 2026-11-15, slice 6: the toolbar's focus return after a TV sheet closes is shared by the quality and Scores buttons (`toolbarReturn`), instead of a second copy of the quality button's flag.
- 2026-11-15, slice 6: the tile menu's Scores item, like the toolbar button, shows only while a tile shows football (R10).
- 2026-11-15, test-gate: `components/multiview/tvScoresModal.test.tsx` added for R5's "Back closes it" on TV.
- Left for later: `useLiveScores` still returns v1's per-tile `tiles`, now unused on screen; ESPN's "0 plays, 0 yards, 0:00" drive right after a kickoff is shown as is.
