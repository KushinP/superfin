package expo.modules.exoplayerplayer

import android.content.Context
import android.content.Intent
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.KeyEvent

/**
 * A media session that only listens for the remote's media keys.
 *
 * Fire OS hands ⏯ ⏪ ⏩ to the system's media-button session, never to the
 * app as key events: on a Fire TV (2026-11-15) every ⏯ press in multiview
 * went to Alexa's player ("Media button session is
 * com.amazon.vizzini/TtsPlayerServer") because SuperFin held no session.
 * Multiview's tiles and the JS player have none of their own, so this one
 * claims the keys while they're on screen and passes each one to JS by name.
 *
 * It reports "playing" whatever the tiles do: Fire OS only routes media keys
 * to an active session that says it's playing, and the tiles decide for
 * themselves what a key means.
 */
class MediaKeySession(private val context: Context, private val onKey: (String) -> Unit) {
    companion object {
        private const val TAG = "MediaKeySession"
    }

    private var session: MediaSession? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    fun start() {
        mainHandler.post { open() }
    }

    fun stop() {
        mainHandler.post { close() }
    }

    // Each open and close is logged: on the Fire TV (2026-11-15) the session
    // looked active on the home screen, with no player open, and nothing
    // said when it had been opened or by whom.
    private fun open() {
        if (session != null) return
        Log.i(TAG, "session opened")
        session = MediaSession(context, "SuperFinMediaKeys").apply {
            setCallback(callback, mainHandler)
            setPlaybackState(
                PlaybackState.Builder()
                    .setActions(
                        PlaybackState.ACTION_PLAY or
                            PlaybackState.ACTION_PAUSE or
                            PlaybackState.ACTION_PLAY_PAUSE or
                            PlaybackState.ACTION_FAST_FORWARD or
                            PlaybackState.ACTION_REWIND,
                    )
                    .setState(PlaybackState.STATE_PLAYING, 0L, 1f)
                    .build(),
            )
            isActive = true
        }
    }

    private fun close() {
        if (session != null) Log.i(TAG, "session closed")
        session?.apply {
            isActive = false
            release()
        }
        session = null
    }

    private val callback = object : MediaSession.Callback() {
        // ⏯ arrives as a raw media button. The base class would turn it into
        // onPlay or onPause from the state above, which is always "playing",
        // so every press would read as pause; the tile knows which it is.
        override fun onMediaButtonEvent(mediaButtonIntent: Intent): Boolean {
            val event = mediaButtonIntent.getParcelableExtra<KeyEvent>(Intent.EXTRA_KEY_EVENT)
                ?: return super.onMediaButtonEvent(mediaButtonIntent)
            val key = when (event.keyCode) {
                KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE, KeyEvent.KEYCODE_HEADSETHOOK -> "playPause"
                KeyEvent.KEYCODE_MEDIA_PLAY -> "play"
                KeyEvent.KEYCODE_MEDIA_PAUSE -> "pause"
                KeyEvent.KEYCODE_MEDIA_REWIND -> "rewind"
                KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> "fastForward"
                else -> return super.onMediaButtonEvent(mediaButtonIntent)
            }
            // One press, one action: the release arrives as its own event.
            if (event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) {
                Log.i(TAG, "media key $key")
                onKey(key)
            }
            return true
        }

        // Transport commands from other apps' controllers (onPlay, onPause
        // and the rest) are left to the base class, which ignores them.
        // Alexa's media agent attached to this session the moment playback
        // started on the Fire TV (2026-11-15), and nothing played after: a
        // command from it must not reach the player as if a key were pressed.
    }
}
