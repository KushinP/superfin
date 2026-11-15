# Technical plan: The remote's playback keys work in multiview on TV

Status: Approved (Gate 2). Kush: "approve", 2026-11-15.
Date: 2026-11-15
Branch: kush/multiview-tv-remote-keys
Spec: [2026-11-15-multiview-tv-remote-keys.md](2026-11-15-multiview-tv-remote-keys.md)

## 1. Architecture decisions
**A. Where the keys are handled.**
- **Decision:** in `MultiviewTile`. Each tile listens with the existing `useTVEventHandler` hook (`hooks/useTVEventHandler.ts`, a no-op off TV) and acts only while it has focus (`useFocused`).
- **Alternative:** one listener on the screen that routes keys to the focused tile. Rejected: the screen would need each tile's player ref. The tile already owns its player and knows its focus.
- **Why:** small, local, and reuses the tile's own play, pause and seek code.

**B. Which tiles.**
- **Decision:** focused, ready, not ended, and not a live channel (`state.item.Type !== "TvChannel"`), the same rule as `hasControls` minus `showLabel`. Keys work even while the labels are hidden.

**C. Key names.** react-native-tvos sends `playPause`, `play`, `pause`, `rewind` and `fastForward` (`ReactAndroidHWInputDeviceHelper.kt`). Act on the key-down only (`eventKeyAction` 0, or unset on platforms that don't send it), so one press is one action.

## 2. Components and files
| File | Job |
|---|---|
| `components/multiview/MultiviewTile.tsx` | `useTVEventHandler` handler: on the focused tile, the playback keys pause, play or seek through the existing `control(...)` wrapper, which also calls `onInteract` to bring the toolbar back. |
| `components/multiview/MultiviewTile.test.tsx` | Tests for checks 1-5, with `@/hooks/useTVEventHandler` mocked to capture the handler. |

External calls: none.

## 3. Schema
None.

## 4. Dependencies
None.

## 5. Failure modes
- **Two tiles think they're focused:** focus is per view, and `useFocused` tracks onFocus and onBlur.
- **Key-up also fires:** only key-down is acted on.
- **The paused state is out of step with the player:** pause and play use the tile's existing `paused` state, as the on-screen button does.

## 6. Test plan
| Check | Test | File |
|---|---|---|
| 1 | "⏯ pauses and plays the focused tile" | MultiviewTile.test.tsx |
| 2 | "⏪ and ⏩ seek the focused tile" | same |
| 3 | "Play and Pause keys" | same |
| 4 | "a tile without focus ignores the keys" | same |
| 5 | "a live channel ignores the keys" | same |
| 6 | Fire TV, by the fork session | by hand |

## 7. AI eval integrity
Not applicable.

## 8. Build order
1. Spec commit.
2. Failing tests.
3. Handler.
4. Checks, PR, CI build, device check.

## 9. Checkpoints
None beyond push and PR, which are approved for this flow. No device install from this session: the fork session owns adb.

## 10. Risks and undo
- **A key press on a focused tile now changes playback.** Intended.
- **Undo:** revert the commit.
