# Spec: The remote's playback keys work in multiview on TV

Status: Approved (Gates 1 and 2). Kush: "approve", 2026-11-15.
Date: 2026-11-15
Branch: kush/multiview-tv-remote-keys

## 1. Problem
Kush: "Play and pause and forward and rewind for media in multiview like movies and tv not workign on fire tv".

- **Who feels it:** Kush, watching movies or episodes in multiview on the Fire TV. Every time he wants to pause or skip, he can't. The only way is to leave multiview.
- **Evidence (code, 2026-11-15):**
  - Multiview never listens to the remote's playback keys. The full player does (`useRemoteControl.ts`, `playPause`).
  - The tile's on-screen controls sit inside the tile's own full-size focus target, so the D-pad can't reach them. Android focus search moves to neighbours, not into the current view.
  - Not yet confirmed on the device; check 6 does that.

## 2. Users and goals
Users: Kush with the Fire TV remote.

Goals:
- Pause and resume a movie or episode tile with the remote's ⏯ key.
- Go back 10 s with ⏪ and forward 30 s with ⏩, the same steps as the tile's own buttons.

Non-goals:
- **Live channels:** no pause or skip, as today.
- **Captions on TV:** not asked for this time. It can be added to the TV tile menu later.
- **Hold-to-scrub:** a long seek while a key is held. The full player has it; one step per press is enough here.
- **Phones and the iPad:** unchanged.

## 3. User stories
1. As Kush, with a movie tile highlighted, I press ⏯ and it pauses; I press it again and it plays.
2. As Kush, I press ⏪ or ⏩ and the highlighted tile jumps back 10 s or forward 30 s.
3. As Kush, a key press only affects the tile I'm on, never the others.

## 4. Requirements
- **P0:** on TV, the focused movie or episode tile handles `playPause`, `play`, `pause`, `rewind` and `fastForward`. Live channel tiles and tiles that aren't focused ignore them. A key press brings back the labels and toolbar, as a touch does.
- **P1:** none.
- **P2:** Captions in the TV tile menu, and hold-to-scrub.

## 5. Success
- **Measure:** the remote's playback keys work on a focused movie tile on the Fire TV. Today 0 of 3 keys work; target 3 of 3.
- **Question for Kush:** "Can you pause and skip in multiview without leaving it?"

## 6. Acceptance checks
1. Given a focused, playing movie tile on TV, when ⏯ is pressed, then it pauses; pressed again, it plays. **Automated.**
2. Given a focused movie tile on TV, when ⏪ or ⏩ is pressed, then it seeks by −10 s or +30 s. **Automated.**
3. Given the discrete Play and Pause keys, then they play or pause the focused tile. **Automated.**
4. Given a movie tile that is not focused, when a playback key is pressed, then nothing happens to it. **Automated.**
5. **Must not change:** given a focused live channel tile, when a playback key is pressed, then nothing happens. **Automated.**
6. Given the Fire TV with two movie or episode tiles, when the remote's ⏯, ⏪ and ⏩ are pressed on the highlighted tile, then it pauses, plays and seeks, and the other tile keeps playing. **By hand.**

## 7. Open questions
- None. Default: seek steps are the tile buttons' 10 s back and 30 s forward.
