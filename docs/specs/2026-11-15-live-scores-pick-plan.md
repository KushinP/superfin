# Technical plan: live scores v3, every game on the rail and you pick

Status: Approved (Gate 2). Kush: "approved", 2026-11-15.
Date: 2026-11-15
Branch: `kush/live-scores-pick`
Spec: [2026-11-15-live-scores-pick.md](2026-11-15-live-scores-pick.md)

## 1. Architecture decisions

**A. One scores feed, no tiles.**
- **Decision:** `useLiveScores` takes only whether it should run. Multiview runs it, and so does the full-screen player while a live channel plays. They share one React Query fetch, so there is still one ESPN request at a time.
- **Rejected:** keeping tile matching as a fallback. It's the fragile part, and Kush asked to keep it simple.

**B. The delay applies to every game.**
- **Decision:** the existing delay buffer already delays the whole fetch, so every game reads from the delayed copy. Until the first fetch is a delay old, there's no rail.

**C. Follows live in memory.**
- **Decision:** a Jotai atom holds up to 2 game ids. It isn't saved, so it's gone after a restart. A game leaves the follows once it's final in the delayed data, or once it's missing from the feed.
- **Rejected:** a saved setting. It would outlive the game and the week.

**D. The follow limit (S8).**
- **Decision:** with 2 games followed, Follow on a third is disabled, with "Unfollow a game to follow this one" under it.
- **Rejected:** a which-one-to-replace question. It's a second popup for a rare case.

**E. Single view (Android TV).**
- **What the code does:** live TV always plays in the JS route (`usePlayMedia.ts`), so its controls are `Controls.tv.tsx`.
- **Rail:** while a live channel's controls are showing, the rail sits just above the bottom controls.
- **Scores button:** added beside Mute. It opens the same `tv-scores-modal`, and the focus goes back to the button when that closes.
- **Phone player:** out of scope.

**F. Matching removed.**
- **Code:** `utils/livescores/matchGame.ts` and its tests go, along with the tile color tags and the per-tile score. `useChannelsNow` goes too if nothing else uses it.
- **Settings:** on/off and the delay are unchanged.

## 2. Components and files

| File | Job |
|---|---|
| `hooks/useLiveScores.ts` | The feed: poll, delay, apply follows, build the view, log |
| `utils/atoms/liveScores.ts` | View is followed games, then other games; adds the follows atom |
| `utils/livescores/railItems.ts` | Rail order, followed first; prune finished follows |
| `components/multiview/ScoresRail.tsx`, `RailChip.tsx` | Followed instead of pinned; no tile colors |
| `components/multiview/ScoresPanel.tsx` | Expandable games, Follow / Unfollow, the limit line |
| `components/multiview/MultiviewScoreLayer.tsx` | The rail only, no tile tags |
| `app/(auth)/multiview.tsx` | The new feed; Scores button whenever scores are on |
| `components/video-player/controls/Controls.tv.tsx` | Rail and Scores button for live TV |
| `app/(auth)/player/direct-player.tsx` | Runs the feed while a live channel plays |
| `translations/en.json` | Follow, Unfollow, the limit line |
| Deleted: `utils/livescores/matchGame.ts`, `matchGame.test.ts` | Tile matching, removed |

**External calls:** the same ESPN scoreboard address, every 15 s while a game is in progress, every 5 min otherwise. Only while multiview or a live channel is open and scores are on. No cost.

## 3. Schema
None. No database or disk changes; follows are memory only.

## 4. Dependencies
None.

## 5. Failure modes

- **ESPN down, an unknown format, or data over 2 min old:** "Scores unavailable", as today.
- **A followed game ends or leaves the feed:** it's unfollowed.
- **The Scores button hides with the controls while Scores is open:** on close, the focus goes back to it, and the controls show again first.
- **Silent failure (looks fine, polls nothing):** each fetch logs its game count and how many are in progress.

## 6. Test plan

| Check | Test |
|---|---|
| S1 | `useLiveScores.test.tsx`: every game shows, whatever the tiles' listings say |
| S2 | Controls test: a live channel's controls show the rail and Scores |
| S3, S4 | `ScoresPanel.test.tsx`: Follow pins a game first; `railItems.test.ts`: a final game leaves the follows |
| S5 | `useLiveScores.test.tsx`, fake clock: an unfollowed game also waits for the delay |
| S6, S7 | `useLiveScores.test.tsx`, adapting the empty and failure tests |
| S8 | `ScoresPanel.test.tsx`: Follow is off with 2 followed |
| S9 | `multiviewScores.test.tsx` and the Controls test: scores off means no rail, no button, no fetch; a movie means no rail |
| S10 | Fire TV, by hand |

The existing tests that check matching (v1 A4, A5; v2 R9) are removed with the matching code, and the PR lists them by name.

## 7. AI eval integrity
Not applicable.

## 8. Build order

1. **Feed:** the hook, follows, delay on every game, logs, matching removed, multiview adapted.
2. **Scores screen:** expand a game, Follow, the limit.
3. **Single view:** rail and Scores button in the TV controls.
4. **Finish:** checks, PR, CI build, Fire TV.

If time runs short, step 3 ships as its own PR.

## 9. Checkpoints
Gate 2 covers deleting the matching files listed above and their tests. There's no schema and no dependency change. Installing on the TV is still asked first.

## 10. Risks and undo

- **Risk:** games you aren't watching appear 30 s late. Intended.
- **Risk:** a rail over the bottom of the picture in single view, only with the controls.
- **Undo:** revert the PR, which brings back v2.

## 11. Consistency pass

- S8 was "ask or disable"; it's now "disable" (D).
- "Single view" is Android TV only; the phone player is out (E).
