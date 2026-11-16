# Fire OS Sends the Remote's Media Keys to a Media Session, Not the App

**Date**: 2026-11-15
**Category**: native, tv
**Key files**: `modules/exoplayer-player/android/src/main/java/expo/modules/exoplayerplayer/MediaKeySession.kt`, `modules/exoplayer-player/src/mediaKeys.ts`, `hooks/useTVEventHandler.ts`, `hooks/useMediaKeySession.ts`

## Detail

On a Fire TV the remote's ⏯ ⏪ ⏩ never reach the focused window as key
events. Amazon's device-control service logs `Received Key name: PLAY_PAUSE,
code: 85` and hands the key to the system's media-button session. An app
without a `MediaSession` never sees the key, so `useTVEventHandler` never
fires. PR #15 handled `playPause` in multiview, passed its unit tests (which
fake the key event) and did nothing on the device. `dumpsys media_session`
showed Alexa's player as the media-button session.

The app now holds a session while multiview or the JS player is mounted
(`useMediaKeySession`). Its keys reach `useTVEventHandler` as the usual
`HWEvent`s, so handlers don't care which way a key came.

Traps:
- **Alexa's ExternalMediaPlayerAgent attaches a controller the moment the
  session goes active.** The session acts only on `onMediaButtonEvent` key
  presses and ignores `onPlay`, `onPause` and the other transport commands,
  so another app's command can't reach the player as if a key were pressed.
- **The JS player's `useRemoteControl` only knew ⏯ and the arrows.** ⏪ ⏩
  arrive as `rewind` and `fastForward`, and need their own case.
- **A unit test that fakes `useTVEventHandler` can't prove a remote key
  works.** Check on the device: `adb logcat -s MediaKeySession` logs every
  open, close and key, and `dumpsys media_session` names the media-button
  session.
