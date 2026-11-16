# Technical plan: Fire TV media keys reach SuperFin

Status: Approved (Gate 2). Kush: "approve", 2026-11-15.
Date: 2026-11-15
Branch: `kush/firetv-media-keys`
Spec: [2026-11-15-firetv-media-keys.md](2026-11-15-firetv-media-keys.md)

## 1. Architecture decisions

**A. Where the media session lives.**
- **Decision:** in the existing `exoplayer-player` native module: start and stop functions, and one event that names the key.
- **How:** it uses Android's built-in `android.media.session.MediaSession`, which `MediaSessionController.kt` already uses, so there's no new dependency.
- **Inside the session:** it reports "playing" and lists the actions it accepts: play, pause, play/pause, fast forward and rewind. Fire OS only hands media keys to a session that's active and playing.
- **Rejected:** a new native module. It's more build wiring plus a CLAUDE.md change, for about 80 lines.

**B. How the keys reach the existing code.**
- **Decision:** `hooks/useTVEventHandler.ts` also listens to the session's events and passes each one on as the same `HWEvent` PR #15 handles (`playPause`, `play`, `pause`, `rewind`, `fastForward`, key-down). The multiview tiles and the full player's `useRemoteControl` work unchanged.
- **Rejected:** a handler path per screen. More code, and it could disagree with PR #15.

**C. Opening and closing.**
- **Decision:** `useMediaKeySession()` starts the session on mount and stops it on unmount. It's called in `multiview.tsx` and `direct-player.tsx`, and only does something on Android TV.

**D. Double presses.**
- **Decision:** a press that arrives both as a key event and through the session within 300 ms is handled once.

**E. The only movie tile.**
- **Decision:** with exactly one movie or episode tile, that tile also takes the keys while it isn't focused, as long as no other playable tile is focused. A live tile alone still ignores them.

## 2. Files

| File | Job |
|---|---|
| `modules/exoplayer-player/android/.../MediaKeySession.kt` (new) | Holds the session and sends the key event |
| `.../ExoPlayerModule.kt` | Start, stop and the key event |
| `modules/exoplayer-player/index.ts` | Exposes them to JS |
| `hooks/useMediaKeySession.ts` (new) | Starts on mount and stops on unmount; Android TV only |
| `hooks/useTVEventHandler.ts` | Session keys arrive as key events, each press once |
| `app/(auth)/multiview.tsx`, `components/multiview/MultiviewTile.tsx` | Opens the session; the only movie tile takes the keys |
| `app/(auth)/player/direct-player.tsx` | Opens the session |

**External calls:** none.

## 3. Schema
None.

## 4. Dependencies
None.

## 5. Failure modes
- **Fire OS still routes to Alexa.** Only the device can show it (check 5). Fallback: also take audio focus while one movie plays. That's a separate change and comes back to Kush first.
- **The session stays open after leaving.** Stop runs on unmount, and the native side releases it when the module is destroyed.
- **Double handling.** The 300 ms rule, with a test.

## 6. Test plan

| Check | Test |
|---|---|
| 1 | `useMediaKeySession.test.ts`: starts, stops, and does nothing off Android TV; plus a multiview screen test |
| 2 | `useTVEventHandler.test.ts`: a session play/pause arrives as `playPause`; `MultiviewTile.test.tsx` |
| 3 | `MultiviewTile.test.tsx`: the only movie tile takes the keys while the live tile is focused |
| 4 | `MultiviewTile.test.tsx`: a live tile alone ignores them |
| 5 | Fire TV, by hand, through the Fire TV session |

## 7. AI eval integrity
Not applicable.

## 8. Build order
1. The native session and JS wrapper, with tests. Native code compiles only in CI, so the Android build on the PR is its check.
2. Routing in `useTVEventHandler`, handling each press once.
3. Multiview's only-tile rule, and both screens opening the session.
4. Checks, PR, CI build, then the Fire TV install and test.

## 9. Checkpoints
Gate 2 covers no schema, no dependencies, and the native change in `exoplayer-player`. Installing on the TV is still asked for first, through the Fire TV session.

## 10. Risks and undo
- **Risk:** Fire OS routing is only proven on the device.
- **Undo:** revert the PR.
