# Spec: The remote's playback keys reach SuperFin on Fire TV

Status: Approved (Gate 1). Kush: "approve", 2026-11-15.
Date: 2026-11-15
Branch: `kush/firetv-media-keys`
Follows: `docs/specs/2026-11-15-multiview-tv-remote-keys.md` (PR #15), which works in tests but not on the device.

## 1. Problem

Kush: "Play and pause and forward and rewind for media in multiview like movies and tv not workign on fire tv". PR #15 didn't fix it on the Fire TV.

**Evidence (Fire TV, develop @ e5abf850, 2026-11-15 19:43):**
- The Spider-Man movie tile was focused, and ⏯ was pressed about 20 times. Nothing happened.
- The device log shows each press handed to Amazon's device-control service: "Received Key name: PLAY_PAUSE, code: 85".
- `dumpsys media_session` reports the media button session as Alexa's player (`com.amazon.vizzini/TtsPlayerServer`). SuperFin has no media session.
- So on Fire OS the media keys go to the system's media-button session, never to the app as key events, and PR #15's `useTVEventHandler` handler never fires. Its unit tests fake the key event, so they skip this step.
- The native full-screen player has a media session (`MediaSessionController.kt`), which is why ⏯ works there. Multiview and the app's own player (used for all live TV) have none.

## 2. Users and goals

**User:** Kush with the Fire TV remote.

**Goals**
- ⏯ ⏪ ⏩ work on the focused movie or episode tile in multiview.
- They also work in the app's own full-screen player (live TV in single view).

**Non-goals**
- **Live tiles in multiview:** they still ignore the keys, as today.
- **Lock screen or notification controls on phones:** not asked for.
- **The native player:** it already works.

## 3. User stories

1. As Kush, with a movie tile focused in multiview, ⏯ pauses and plays it, and ⏪ ⏩ seek it.
2. As Kush, with one movie tile and one live tile, ⏯ controls the movie whichever tile is focused.
3. As Kush, watching live TV full screen, ⏯ pauses and resumes it.
4. As Kush, after I leave SuperFin's player, ⏯ goes back to whatever the system does.

## 4. Requirements

**P0**
1. While multiview is open on Android TV, SuperFin holds an active media session. ⏯ goes to the focused movie or episode tile, or to the only one if there's just one. ⏪ goes back 10 s, ⏩ forward 30 s.
2. The app's own full-screen player does the same while it's open on Android TV.
3. The session is released when the screen closes.
4. Phones, the iPad, Apple TV and the native player are unchanged.

## 5. Success

- **Measure:** ⏯ ⏪ ⏩ work on the Fire TV in multiview and in single view. Today 0 of 3; target 3 of 3.
- **Question for Kush:** "Can you pause and skip with the remote now?"

## 6. Acceptance checks

1. Multiview opening starts the session, and closing releases it. **Automated.**
2. A session play/pause pauses and plays the focused tile; seek back and forward move it 10 s and 30 s. **Automated.**
3. With only one movie tile, the keys reach it even while a live tile is focused. **Automated.**
4. **Must not change:** with only a live tile, the keys do nothing. **Automated.**
5. On the Fire TV, ⏯ ⏪ ⏩ work on a movie tile and in single-view live TV. **By hand.**

## 7. Open questions

None. Risk: Fire OS might still prefer Alexa's session. Check 5 settles that.
