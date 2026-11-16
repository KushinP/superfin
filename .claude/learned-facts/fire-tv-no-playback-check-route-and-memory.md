# Nothing Plays on the Fire TV: Check the Server Route and the TV's Memory First

**Date**: 2026-11-15
**Category**: tv, debugging
**Key files**: none (device and network)

## Detail

On 2026-11-15 nothing played in SuperFin on the Fire TV (black screen, MPV
loaded the file and stopped), and a new build was blamed for an hour. Then
the old build failed the same way. Two causes, neither in the app:

1. **The app was signed in through the public tunnel** (`jellyfin.mallick.cc`)
   at home. From about 20:30 the cloudflared log showed every
   `/Videos/…/stream` canceled, with the home uplink taken by qBittorrent
   seeding. Signing in at the LAN address (`http://192.168.1.157:8096`)
   fixed it.
2. **Then it stuttered on the LAN.** The Fire TV had 80 MB of RAM free and
   Amazon's `com.amazon.tv.turnstile` held a core at 100%. A restart (Select
   + Play for 5 s) fixed it. The official Jellyfin app played smoothly
   meanwhile, because ExoPlayer needs less than MPV.

Before blaming the app when nothing plays, check:
- the stream URL in logcat (`Video is being direct played: …`): LAN or tunnel?
- whether an older known-good build fails the same way;
- `adb shell cat /proc/meminfo` and `top`: free memory and stuck processes.
