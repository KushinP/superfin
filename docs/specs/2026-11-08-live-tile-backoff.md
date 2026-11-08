# Live multiview tiles stop dropping themselves

Status: Approved (Gates 1 and 2)
Date: 2026-11-08
Branch: kush/live-tile-backoff

## 1. Problem
**Who has it:** Kush, watching live TV (Fox) in Superfin's multiview on a Mac. "Live TV keeps dropping in the app."

**How often:** 4 drops in 13 minutes on 2026-11-08 (15:36, 15:41, 15:46, 15:49 EST), after 93–432 s of good playback each. Each drop is a frozen picture, then a black tile while the channel reopens. The reopen sometimes fails once or twice before it works.

**Evidence:**
- Jellyfin's logs show every drop starts with the app reporting "stopped" (`Stopping ffmpeg process with q command`, then `Playback stopped reported by app`). The server was healthy throughout.
- In the code (commit a96d9d17), a tile whose picture stands still for about 14 s reports "stopped" and reopens straight away. That's too soon for the tuner to be free, so the reopen fails with HTTP 500 on `live.m3u8`, and the next try waits 30 s.

**Hypothesis:** why the picture freezes for 14 s is unknown. Candidates are a broadcast timestamp glitch, the buffer running dry, or the app being in the background. A log entry at each drop showing how much video was buffered and whether the app was in front would tell us which.

## 2. Users and goals
**User:** Kush, watching 1–4 live channels in multiview on a Mac or iPhone, from his own Jellyfin server with a two-tuner HDHomeRun.

**Goals:**
1. A brief hiccup in the broadcast no longer turns into a full drop and reopen.
2. A channel that really is stuck comes back on the first try, not after a failed attempt and a 30 s wait.
3. After any drop, Settings → Logs shows why it happened.

**Non-goals:**
- Fixing the underlying freeze. Its cause is unknown, and the log is how we find out.
- The full-screen player. It has no auto-reconnect and isn't dropping.
- Server-side changes (Jellyfin, FFmpeg, tuner). The server is healthy and is handled separately.
- Android TV / Fire TV tiles. They get the same timing, but aren't tested here.

**Later:**
- Recovering on the same session without reporting "stopped", so the tuner stays up.
- Deciding "stuck" by "no new video arriving" rather than "picture not moving".

## 3. User stories
1. As a viewer, I want a channel that hiccups for a few seconds, even 20, to carry on by itself, so I don't lose my place to a reopen.
2. As a viewer, I want a channel that's truly stuck to come back in under about 10 s, even if the tuner isn't free on the first try.
3. As the person debugging this, I want each automatic reconnect in the app log, with how long it was frozen, how much was buffered and whether the app was in front.
4. Error state: if a channel can't be reopened after its retries, the tile stops trying and shows the existing "couldn't play" state with manual Reconnect.
5. Paused state: a paused channel is never reconnected (unchanged).

## 4. Requirements
**P0 (must ship)**
- A playing live tile reconnects only after its picture has been frozen for about 30 s (was about 14 s).
- Every automatic reconnect writes one app-log line: the channel, seconds frozen, seconds buffered, and app foreground/background.
- After a tile reports "stopped", it waits about 5 s before opening the channel again.
- If opening the channel fails, retry after 2 s, then 4 s, then 8 s (not 30 s). Then give up and show the existing error state.

**P1 (fast follow)**
- Also log failed opens and retries.

**P2 (design for, don't build)**
- A "soft recovery" step before a full reconnect. The log entry should record enough to decide later whether it's needed.

## 5. Success
- **Number:** automatic reconnects per hour of live multiview watching, counted from the new log entries. Baseline is about 18/hour; **target: 2 or fewer**, and no failed reopens in Jellyfin's log after a reconnect.
- **Question for Kush:** "In an hour of watching Fox in multiview, did a tile drop, and if so did it come back on its own within about 10 s?"

## 6. Acceptance checks
| # | Given / when / then | How checked |
|---|---|---|
| 1 Normal | Given a playing live tile, when its picture freezes for 31 s, then it reconnects once and writes one log entry with seconds frozen, seconds buffered and app state. | automated |
| 2 Edge | Given a playing live tile, when the picture freezes for 20 s then moves again, then no reconnect and no log entry. | automated |
| 3 Edge | Given a reconnect, when the "stopped" report finishes, then the new open starts no sooner than about 5 s after that report was sent. | automated |
| 4 Edge | Given a reopen whose first two attempts fail, when the third succeeds, then the attempts are about 2 s and 4 s apart and the tile plays. | automated |
| 5 Failure | Given a channel that fails every open, when the 8 s retry also fails, then the tile stops retrying and shows the error state with manual Reconnect. | automated |
| 6 Must not change | A paused live tile is never reconnected, and a movie/episode tile never auto-reconnects. | automated |
| 7 Must not change | Manual Reconnect from the tile menu still works and gives a fresh set of retries. | automated |
| 8 Real world | 30 min of Fox in multiview on the Mac: every drop has a log entry in Settings → Logs, and Jellyfin shows no failed reopen right after a stop. | by hand |

## 7. Open questions (defaults taken)
1. Do the quick retries count toward the existing limit of 3 automatic reconnects in a row? **Default: no.** They're one reconnect with its own 3 retries.
2. Does a channel that never shows a first frame still wait 30 s before reconnecting? **Default: yes.**
3. Is 30 s the right freeze limit? **Default: yes**, kept as one constant.
