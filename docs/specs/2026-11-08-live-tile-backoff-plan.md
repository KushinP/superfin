# Technical plan: Live multiview tiles stop dropping themselves

Status: Approved (Gate 2)
Date: 2026-11-08
Branch: kush/live-tile-backoff
Spec: [2026-11-08-live-tile-backoff.md](2026-11-08-live-tile-backoff.md)

## 1. Architecture decisions
**A. Noticing a failed open.**
- **Decision:** before handing the stream to MPV, fetch the channel's live playlist (a "probe"). A 500 or network error means the open failed; retry the probe after 2 s, 4 s, then 8 s. MPV gets the stream only after the probe succeeds.
- **Alternatives:**
  - Report MPV load errors from native code. Rejected: needs an Xcode rebuild and changes the full-screen player too. MPV on iOS ignores non-EOF end-file reasons today (MPVLayerRenderer.swift, MPV_EVENT_END_FILE).
  - Shorten the first-frame timer. Rejected: a working channel can take over 10 s to show its first frame.
- **Why:** JS only, reloads with Metro, works on Android TV too, and is testable with a fake `fetch`.

**B. The 5 s backoff.**
- **Decision:** one module-level timestamp of the last live stop report sent, next to the existing stop tracker in `useMultiviewTileStream.ts`. A live channel open waits until 5 s have passed since then. Library items don't wait.
- **Alternative:** per channel. Rejected: two tiles share a two-tuner box.

**C. The log line.** Written in `MultiviewTile.tsx` where the stuck decision is made. Only the tile knows how long it was frozen and how much was buffered.

**D. Probe can't tell.** A timeout (20 s) or an unparseable playlist means "unknown", and MPV plays the stream anyway. The existing 30 s first-frame rule still covers it.

## 2. Components and files
| File | Job |
|---|---|
| `constants/Multiview.ts` | `MULTIVIEW_LIVE_STALL_RECONNECT` 12 000 → 30 000. New: `MULTIVIEW_LIVE_REOPEN_GAP` = 5 000, `MULTIVIEW_LIVE_OPEN_RETRY_DELAYS` = [2 000, 4 000, 8 000], `MULTIVIEW_LIVE_PROBE_TIMEOUT` = 20 000. |
| `utils/multiview/liveProbe.ts` (new) | `probeLivePlaylist(url, headers)`: fetch the master playlist, resolve its first variant URI, fetch that. Returns `"ok"`, `"failed"` (non-2xx or network error) or `"unknown"` (timeout or nothing to parse). |
| `hooks/useMultiviewTileStream.ts` | Records when each live stop is sent; a live open waits out the gap; after the stream URL, probe with retries. On give-up: report stopped (frees the tuner), log, set the error state. Logs each failed probe. |
| `components/multiview/MultiviewTile.tsx` | Keeps the latest `cacheSeconds` from progress. On stuck, writes one WARN line (channel name and id, seconds frozen or "no first frame", seconds buffered or "unknown", `AppState.currentState`) before `onStuck`. |

**Flow after an auto-reconnect:**
1. The old tile reports stopped and the timestamp is recorded.
2. The new tile waits for pending stops (≤3 s) and for the 5 s gap.
3. It gets the stream URL, then probes. If the probe fails, it retries at 2, 4 and 8 s, then gives up.
4. On success, MPV plays.

**External calls:** 1–2 small GETs to the user's own Jellyfin per live open, plus one per retry. No cost.

## 3. Schema
None. No stored data changes. Log lines go to the existing app log.

## 4. Dependencies
None. Uses `fetch`, `AbortController` and `AppState`.

## 5. Failure modes
- **Probe ok but MPV fails:** the existing 30 s first-frame reconnect still applies, and it logs.
- **Tile removed during the gap or retries:** the stream is already opened on the server, so cleanup reports stopped. Tested.
- **Slow open (over 20 s):** "unknown", so MPV plays it anyway.
- **No `cacheSeconds`** (ExoPlayer): logged as "unknown", not 0.
- **Log volume:** one line per reconnect and per failed probe, capped by the existing 3-in-a-row limit.
- **Manual Reconnect and quality change** pass the 5 s gap too. Intended: they free a tuner as well.

## 6. Test plan
| Check | Test | File |
|---|---|---|
| 1 | a live tile frozen 30 s reconnects and logs why | MultiviewTile.test.tsx |
| 2 | a live tile frozen 20 s that moves again is left alone | MultiviewTile.test.tsx |
| 3 | a live open waits 5 s after the last live stop | useMultiviewTileStream.test.tsx |
| 4 | a failed live open retries after 2 s and 4 s, then plays | useMultiviewTileStream.test.tsx, liveProbe.test.ts |
| 5 | a channel failing every probe gives up after the 8 s retry, frees its tuner, shows the error | useMultiviewTileStream.test.tsx |
| 6 | paused channel (existing), plus a movie tile never waits or probes | both |
| 7 | manual Reconnect resets retries (existing multiview.test.ts) | multiview.test.ts |
| 8 | 30 min of Fox on the Mac; compare Settings → Logs with Jellyfin's log | by hand |

All network calls are faked. The existing test "asks to reconnect once stalled past the live cushion" moves from about 16 s to about 32 s, as the spec requires; Kush approved this with Gate 2.

## 7. AI eval integrity
Not applicable.

## 8. Build order
1. **Slice 1:** 30 s limit and log line, with tests for checks 1, 2 and 6. Commit.
2. **Slice 2:** gap, probe and retries, with tests for checks 3, 4, 5 and 7. Commit.
3. **Last:** `/test-gate`, then a Metro reload for check 8.

Cut first if short of time: the per-failed-probe log lines.

## 9. Checkpoints
Gate 2 covers: no schema change and no new dependencies. Nothing else from the CLAUDE.md list applies. No push or PR unless asked.

## 10. Risks and undo
- **Slower auto-recovery** of a truly stuck channel: about 30 s instead of 14 s.
- **Live manual Reconnect and quality change** up to 5 s slower.
- **A wrong "failed" probe** puts a tile in the error state; manual Reconnect still works.
- **Undo:** revert the two code commits, or tune the constants.

## 11. Consistency pass
- Spec check 3 measures from when the stop is sent, and so does the plan.
- Probe retries are separate from the 3-in-a-row limit, per the spec's default.
- Logging failed probes (spec P1) is built in Slice 2 and is the first thing cut.
- Added: manual Reconnect and quality changes also wait the 5 s gap.

## Changes
- 2026-11-08: The "last live stop" clock lives in its own small module, `utils/multiview/liveReopenGap.ts`, not inside `useMultiviewTileStream.ts`. The existing hook tests use the real clock, so a test that closes a live tile would otherwise make the next test wait 5 s. The module has a reset for tests. Behavior is unchanged.
- 2026-11-08: The probe skips any stream URL that isn't a `.m3u8` playlist ("unknown", so the player decides). Fetching a direct stream would download the channel endlessly.
