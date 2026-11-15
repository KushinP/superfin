# Live scores overlay and fantasy players: technical plan (Gate 2)

Status: Approved (Gate 2)
Date: 2026-11-15
Branch: `kush/live-scores-overlay` (worktree `~/superfin-live-scores`, from `develop`)
Product spec: `docs/specs/2026-11-15-live-scores-overlay.md` (Approved, Gate 1, commit 81265f00)

## Context

Kush approved the product spec: a score bug on live NFL multiview tiles with a spoiler delay (P0), ESPN fantasy "my players" and scoring toasts (P1), and a ticker parked (P2). This plan picks how to build it. Every external fact below was checked live today (2026-11-15, a Sunday with games on), not from memory, except where marked **unverified**.

### What was checked live today
- **ESPN scoreboard** `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard`: public, no login, about 187 KB. 14 games today. Each game has `id`, `date`, `shortName` ("KC @ ATL"), `status` (`type.state` = pre/in/post, `type.name` such as `STATUS_HALFTIME`, `displayClock`, `period`), competitors with `homeAway`, `score`, and team `abbreviation`, `displayName`, `location`, `name` (nickname, e.g. "Chiefs"), `id`. `situation` has `down`, `distance`, `yardLine`, `isRedZone` and timeouts. `broadcasts[].names` (e.g. `["CBS"]`).
  - **Seven games were on CBS or Fox at the same time.** The network alone almost never identifies a game, so matching must rely on team names in the guide.
  - **Unverified:** `situation.possession` and `downDistanceText` (all games were at halftime when checked). Slice 1 records a live-play sample to confirm them before the bug shows possession.
- **ESPN game summary** `.../nfl/summary?event=<id>`: public, about 406 KB. `scoringPlays` name players only in free text ("Andy Borregales 33 Yd Field Goal"), with no player IDs. But `boxscore.players[].statistics[]` lists each athlete by `athlete.id` with counted stats: `passingTouchdowns`, `rushingTouchdowns`, `receivingTouchdowns`, `kickReturnTouchdowns`, `puntReturnTouchdowns`, `interceptionTouchdowns`, `defensiveTouchdowns`, and kicking `fieldGoalsMade/fieldGoalAttempts`.
- **ESPN fantasy** `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/2026/segments/0/leagues/<id>?view=mRoster`: without cookies a private league returns 401 `AUTH_LEAGUE_NOT_VISIBLE`. **Unverified until Kush's cookies are in place:** the roster layout (`teams[].roster.entries[].playerId`, `lineupSlotId`, `playerPoolEntry.player.fullName`) and that fantasy `playerId` equals the box score's `athlete.id`. Slice 7 checks both against one real player before anything is built on them.
- **Jellyfin** (server source, `DtoService.cs`/`LiveTvManager.cs`, `DtoOptions.AddCurrentProgram = true` by default): looking up a channel includes its current program. But a tile looks it up only once at start, so the guide data would go stale. Programs carry `Name`, `EpisodeTitle`, `Overview`, `IsSports`, `StartDate`, `EndDate`.

## 1. Architecture decisions

1. **Where scores are fetched: in the app, one poller per multiview screen.**
   - Alternatives: (a) a server service that polls and the TV reads from it; (b) each tile polls.
   - Why: the scoreboard needs no secret, the Fire TV is the only viewer, and the server box is short on memory. One hook, mounted once in `multiview.tsx`, owns a single React Query query (`["livescores","nfl","scoreboard"]`). However many tiles show games, there is one fetch per interval (A7).
2. **When it polls.**
   - Only while the setting is on and at least one tile's current program looks like football (`IsSports`, or the title or episode title contains "NFL" or "Football").
   - Every 15 s while any matched game is in progress, and every 5 min before kickoff to catch the start.
   - Otherwise it doesn't poll (A3, A11).
   - `gcTime: 0`, so scores are never saved to the on-disk query cache. The cache only saves queries whose `gcTime` isn't 0 (`utils/queryPersistence.ts:6`), and old scores reappearing on relaunch would be confusing.
3. **The spoiler delay: a buffer of timestamped snapshots, not a timer per score.**
   - Each successful fetch is stored with the time it arrived.
   - The bug shows the newest snapshot that is at least `delay` seconds old.
   - Alternative: delay each change with `setTimeout`. That's fragile, because Android pauses JS timers in the background (learned fact `android-js-timers-pause-in-background`).
   - The buffer can only err late, never early. Polling every 15 s with a 30 s delay means a change shows 30–45 s after ESPN reported it.
   - A tile shows no bug until the first snapshot is `delay` old, so opening multiview mid-game never flashes a current score. (Consistency fix 4.)
4. **Where the current program comes from: a new shared guide hook.**
   - `useChannelsNow(channelIds)` makes one `getPrograms` call for all tiles' channels.
   - It asks for programs that started before now and end after now, with `Fields: ["Overview"]`, refreshed every 5 min and at the nearest program end.
   - It follows the pattern of `hooks/useChannelsNowNext.ts`: sorted IDs give a stable query key.
   - Alternative: read `CurrentProgram` from the tile's one-off item lookup. Rejected because it goes stale when the program changes.
5. **Matching: strict, and silent when unsure.** This is a pure function in `utils/livescores/matchGame.ts`.
   - It searches the program's `Name + EpisodeTitle + Overview` for NFL team nicknames ("Chiefs") and full names ("Kansas City Chiefs").
   - It matches when both teams of one game are named. It also matches when exactly one team is named and no team from another game is.
   - It refuses if the channel has a network mapping and the game's broadcast is on a different network.
   - It refuses if the program's time window doesn't overlap the game's start.
   - **Sticky:** once a tile is matched, it keeps that game until the game is final and the guide has moved on. This covers a game that overruns its guide slot, such as the late CBS game listed while the early one is in overtime.
   - City-only names ("New York") never count alone.
6. **Where the bug is drawn: a separate overlay layer.**
   - `MultiviewScoreLayer` draws the bugs above the tiles, using the same `tileFrames` positions, with `pointerEvents="none"`.
   - `MultiviewTile` isn't changed. Its props and React key are untouched, so the video player can't reconnect or re-render because of scores (P0-8).
   - This also keeps the diff away from the tile render block that `kush/fire-tv-promote-in-place` changes (fewer merge conflicts).
7. **"Scores unavailable": shown by the score layer when that tile's Stats are turned on.**
   - The screen already knows which tiles have stats on.
   - This avoids changing `MultiviewTileStats`. (Consistency fix 2.)
8. **Fantasy secrets: a small roster service on the Ubuntu box, no app access to cookies.**
   - `server/fantasy-roster/fantasy_roster.py` uses Python 3's standard library only (no packages).
   - It reads `ESPN_S2`, `ESPN_SWID`, `ESPN_LEAGUE_ID`, `ESPN_TEAM_ID` and `ESPN_SEASON` from its own `.env`.
   - It answers one LAN request, `GET /roster`, with names, athlete IDs, team and starter/bench, cached for 10 minutes. It runs under systemd with `MemoryMax=32M`.
   - Alternatives: (a) put cookies in the app (rejected: they would ship inside the APK, or need typing on a TV and sit on the device); (b) the service also polls game stats (rejected: more work on a busy box, and the app already has the public feed).
   - League ID and team move from app settings to the service's `.env`. (Consistency fix 1.)
9. **Detecting "my player scored": compare box score counts.**
   - The app fetches a game's summary only when that game's score changes in the scoreboard, plus once 60 s later for stat corrections. That's a handful of 400 KB fetches per game, not one every 15 s.
   - It compares per-athlete touchdown and field-goal counts for rostered players with the previous fetch.
   - The first fetch of each game only sets a baseline, so opening multiview mid-game doesn't flood toasts.
   - Duplicates are prevented by a session set keyed on athlete, stat and new count (A9).
   - Team defense (D/ST) uses the team's interception, defensive and return touchdowns.
   - Each toast fires once its detection time is `delay` old, using the same buffer clock.
10. **How it's tested without the network.**
    - Recorded ESPN responses, trimmed to 2–3 games, are saved as test fixtures. A fake fetch replays them in sequence, and Jest fake timers stand in for the clock.
    - No test calls ESPN or the box.
    - The Python service has its own `unittest` file with a fake ESPN response, run by hand: `python3 -m unittest`. Jest can't run it, so it's marked by hand.

## 2. Components and files

**New, P0**
| File | One job |
|---|---|
| `constants/LiveScores.ts` | Feed URLs, the 15 s / 5 min polling intervals, delay default/min/max/step (30/0/90/5), data older than 120 s counts as stale, a buffer cap of 20 snapshots |
| `utils/livescores/espnScoreboard.ts` | Turn raw scoreboard JSON into `GameScore[]`; return `null` if any required field is missing or the wrong type (no partial data) |
| `utils/livescores/delayBuffer.ts` | Add a snapshot, pick the newest one at least `delay` old, drop old ones |
| `utils/livescores/matchGame.ts` | Program + channel network + games → game ID or null, with the sticky rule |
| `utils/livescores/nflTeams.ts` | The 32 teams: abbreviation, location, nickname (a static list; scoreboard names are also used) |
| `utils/livescores/scoreBugText.ts` | "2nd & 8", "Q2 3:12", "Half", "Final", "Final/OT", "1st & Goal" |
| `hooks/useChannelsNow.ts` | Current program per channel, one shared request |
| `hooks/useLiveScores.ts` | The one poller: query + buffer + matches → per-tile `ScoreView`, `"unavailable"` with a reason, or nothing |
| `components/multiview/ScoreBug.tsx` | The bug's look: a translucent strip at the top-left, TV text sizes from `useScaledTVTypography` |
| `components/multiview/MultiviewScoreLayer.tsx` | Places a `ScoreBug` (or the "Scores unavailable" chip when Stats are on) over each tile's frame |
| `utils/livescores/__fixtures__/*.json` | Trimmed real responses (pre, in-play, halftime, final, malformed) |

**Changed, P0**
- `app/(auth)/multiview.tsx`:
  - mount `useLiveScores` and `<MultiviewScoreLayer>` after the tiles block;
  - add one menu item, "Score delay (30 s)", which opens a second sheet with "+5 s", "−5 s" and "Turn live scores off";
  - menu indices and `destructiveButtonIndex` shift by one.
- `utils/atoms/settings.ts`: the new settings in section 3, with defaults.
- `components/settings/PlaybackControlsSettings.tsx` (mobile) and `app/(auth)/(tabs)/(home)/settings.tv.tsx` (TV): an on/off toggle and the delay stepper. CLAUDE.md requires both: a setting without UI is dead.
- `translations/en.json`: new keys, whole sentences only.
- `docs/conventions/constants.md`: a row for `LiveScores.ts`.
- `CLAUDE.md`:
  - add ESPN to the external services list;
  - add `server/` to the layout table (it's a new top-level directory).

**New, P1**
| File | One job |
|---|---|
| `server/fantasy-roster/fantasy_roster.py` | Read `.env`, call the ESPN fantasy roster with the cookies, return `[{athleteId, name, proTeam, slot}]`, cache 10 min; on 401 return `{"error":"espn_auth"}` with status 502; never log the cookies |
| `server/fantasy-roster/test_fantasy_roster.py` | Parsing, the 401 path, and a check that cookies don't appear in any output |
| `server/fantasy-roster/README.md` | Setup on the box, the systemd unit (`MemoryMax=32M`), undo steps |
| `utils/livescores/espnBoxscore.ts` | Summary JSON → scoring counts per athlete and per team D/ST |
| `utils/livescores/scoringEvents.ts` | Previous counts + new counts + roster → new scoring events (baseline and dedupe) |
| `utils/livescores/fantasyRoster.ts` | Validate the service's response |
| `hooks/useFantasyAlerts.ts` | Roster query (10 min), summary fetch when a score changes, delayed toasts, the one-time "sign-in expired" or "service unreachable" toast, and a stat line per game |

**Data flow (P0), step by step**
1. `multiview.tsx` knows each tile's `itemId`. For a live channel, that's the channel ID.
2. `useChannelsNow(channelIds)` gives each channel's current program (every 5 min, and at the program's end).
3. `useLiveScores` decides whether to poll (step 2 of decision 2). The single scoreboard query runs, `espnScoreboard` parses it, and the result is pushed into the delay buffer with `Date.now()`.
4. For each tile: `matchGame(program, network, games)`, sticky per tile key, gives a game ID. The game's state is read from the delayed snapshot.
5. `MultiviewScoreLayer` draws the bug at the tile's frame.
- **Cost:** one 187 KB request every 15 s while a game is on (about 45 MB per hour of games, on the TV's internet). Nothing hits the Jellyfin server except the guide request it already serves.

**Data flow (P1)**
1. `useFantasyAlerts` gets the roster from the box (`fantasyRosterUrl`) every 10 min while multiview is open and scores are on.
2. When a game's score changes in a fresh snapshot, and that game has a rostered player, it fetches that game's summary.
3. `espnBoxscore` and then `scoringEvents` turn it into events, each queued with its detection time.
4. Once an event is `delay` old, it shows a `toast` like "Josh Allen: rushing TD · BUF 21–17", with the score taken from the matching delayed snapshot.

## 3. Schema

There's no database: this feature stores nothing on the server and adds no Jellyfin data. What's persisted is app settings (MMKV, through `settingsAtom`) and the service's `.env`. Everything else is memory only, for one screen session.

**App settings (persisted, added only, existing keys untouched)**
| Key | Type | Default | Meaning | Constraint |
|---|---|---|---|---|
| `liveScoresEnabled` | boolean | `true` | Show score bugs on multiview tiles; `false` means no score requests at all | — |
| `liveScoresDelaySeconds` | number | `30` | How far behind real time the bug and toasts run | clamped to 0–90, rounded to a multiple of 5 on read and write |
| `liveScoresChannelNetworks` | `Record<channelId, string>` | `{}` | Kush's own mapping of a channel to a network (e.g. WCBS → "CBS"); used only to reject or confirm a match | values from a fixed list: CBS, FOX, NBC, ABC, ESPN, Prime Video, NFL Network; unknown values ignored |
| `fantasyRosterUrl` | string | `""` | Address of the roster service on the LAN; empty means fantasy is off | must start with `http://` or `https://`; otherwise treated as empty |

None of these is secret, so none goes in the sensitive list in `settingsOverrides.ts`.

**Service `.env` on the box (never in git, never in the app)**: `ESPN_S2`, `ESPN_SWID`, `ESPN_LEAGUE_ID`, `ESPN_TEAM_ID`, `ESPN_SEASON`, `PORT` (default 8790). `.env` stays gitignored, and the README only lists the names.

**In memory per multiview session (not stored)**
- Snapshot buffer: `{fetchedAt: ms, games: GameScore[]}`, at most 20.
- `GameScore`:
  - `id`, `state` (pre/in/post), `statusName`, `period`, `clock`;
  - `home`/`away` as `{abbr, score, nickname, location}`;
  - `down?`, `distance?`, `yardLine?`, `possessionAbbr?`, `redZone`;
  - `networks[]`, `start`.
- Sticky matches: `tileKey → gameId`.
- Manual picks (P1-5): `tileKey → gameId`, cleared when the program changes.
- P1 only: baseline counts per game and athlete, the set of event keys already toasted, and the queued events.

**Stored vs derived:** only the 4 settings above are stored. Every displayed value is derived from the most recent delayed snapshot.

**Check against acceptance tests:**
- A1 to A8 are computable from the snapshots, matches and settings.
- A9 and A10 from roster, counts, the toasted set and the service's error.
- A11 from the "should poll" decision plus a fetch counter in the test.
- A12 holds by design, because the app never receives the cookies.
- The success measure is by hand.

## 4. Dependencies

**None new.**
- The app uses `fetch`, React Query, Jotai and `sonner-native` (all present).
- The service uses Python 3's standard library (`http.server`, `urllib`, `json`), so there's no `pip install`.
- What's on the box (checked at the deploy checkpoint, not now): `python3 --version` must be 3.8 or newer, which Ubuntu has shipped since 20.04.

## 5. Failure modes

- **ESPN changes or breaks the feed.** The parser returns `null` for anything missing or mistyped, and the tile shows nothing; with Stats on, "Scores unavailable: unexpected data". Bugs return on the next good fetch (A8).
- **Network down, timeout or HTTP error.** Retry on the next interval with no React Query retry storm (`retry: 1`). The last snapshot is kept only while it's under 120 s old. After that the bug hides rather than freezing on an old score.
- **Ugly guide titles:**
  - "NFL Football" with no teams: match only through the network mapping and a unique game, otherwise nothing.
  - Overview mentions a third team: refused (A4).
  - "NFL Postgame" during an overrun: the sticky rule keeps the right game.
  - Pregame show: matches, and the bug shows the kickoff time.
  - Duplicate channels (an HD and an SD copy of one station): each tile matches on its own.
- **Silent failures, and how each is caught:**
  - **Wrong game shown.** Prevented by the strict rule. A debug log line on each new match ("tile X → KC @ ATL because 'Chiefs','Falcons' in EpisodeTitle") lets Kush report a mismatch. The success measure counts these.
  - **Score shown early.** The buffer can only pick snapshots at least `delay` old; a test pins that :29 shows old and :30 shows new (A2).
  - **Frozen bug** after polling stops in the background: hidden by the 120 s staleness check.
  - **Toast for the wrong player** after an ESPN stat correction. Accepted: it's rare, and no retraction is shown.
  - **Toast flood** on opening mid-game: prevented by the baseline-first rule.
  - **Polling when it shouldn't.** A test counts fetches with scores off and with no football program (A11).
- **Fantasy service down, or cookies expired.** One toast per session ("ESPN fantasy sign-in expired: update the cookies on the server" or "Fantasy service unreachable"). Fantasy then stays off until multiview is reopened, and the score bug is unaffected (A10).
- **Clock:** fetch time and display time both use the TV's own clock, so its accuracy doesn't matter.

## 6. Test plan

All Jest tests use fixtures and fake timers, with no network.
| Check | Test | Runs |
|---|---|---|
| A1 normal | `MultiviewScoreLayer.test.tsx` "shows both teams, score, quarter, clock and down for a matched in-play game, and keeps it with the toolbar hidden" + `scoreBugText.test.ts` | Jest; plus by hand on Fire TV |
| A2 spoiler delay | `delayBuffer.test.ts` "at delay−1 s shows the old snapshot, at delay shows the new"; `useLiveScores.test.ts` "a tile shows nothing until the first snapshot is delay old" | Jest, fake timers |
| A3 not a game | `useLiveScores.test.ts` "no football program, no scoreboard fetch"; `matchGame.test.ts` "Local News at 6 → null" | Jest |
| A4 ambiguous | `matchGame.test.ts` "'NFL Football' with two CBS games → null", "overview naming a third team → null" | Jest |
| A5 program change | `matchGame.test.ts` "sticky until final and guide moved on", "overrun keeps the early game" | Jest |
| A6 delay change | `multiviewScoreMenu.test.tsx` "+5 s sets 35 and the tile's player key is unchanged" | Jest; plus by hand |
| A7 one poll | `useLiveScores.test.ts` "4 matched tiles, 2 min → 8 fetches at 15 s, not 32" | Jest |
| A8 failure | `espnScoreboard.test.ts` malformed fixture → null; `useLiveScores.test.ts` "fetch error hides bugs, Stats shows unavailable, recovers on next good fetch", "older than 120 s → hidden" | Jest |
| A9 fantasy toast | `scoringEvents.test.ts` "rushing TD for a starter → one event; same counts 5 more times → none; first fetch → baseline only"; `useFantasyAlerts.test.ts` "toast fires at delay, once" | Jest |
| A10 fantasy failure | `useFantasyAlerts.test.ts` "espn_auth → one toast, bug unaffected"; `test_fantasy_roster.py` "401 → 502 espn_auth, no cookie in body or log" | Jest; Python by hand |
| A11 control | the existing `multiview.test.ts`, `MultiviewTile.test.tsx` and `multiviewScreen` tests unchanged and passing; `useLiveScores.test.ts` "setting off → zero fetches" | Jest |
| A12 secrets | `test_fantasy_roster.py` no-leak check; by hand: search the built APK's JS bundle for the cookie values (there should be nothing) | by hand |

Before each commit: `bun run test:unit` on the touched specs. Before calling it done: `/test-gate` (which runs `bun run test`).

## 7. AI features

Not applicable: no model is involved. Matching rules are plain code with fixed tests.

## 8. Build order

Each slice is about 300 lines or fewer and ends in a passing commit. P0 comes first.
1. **Scoreboard parsing and the delay buffer.** Constants, `espnScoreboard`, `delayBuffer`, `scoreBugText`, fixtures, tests. Before writing the parser, record one live-play scoreboard sample to confirm the possession and down text fields. (A2 unit, A8 parse)
2. **Matching.** `nflTeams`, `matchGame`, `useChannelsNow`, tests. (A3, A4, A5)
3. **The poller.** `useLiveScores`, the 2 P0 settings with defaults, tests. (A2, A3, A7, A8, A11)
4. **On screen.** `ScoreBug`, `MultiviewScoreLayer`, `multiview.tsx` wiring and the delay menu, translations, tests. (A1, A6)
5. **Settings UI and docs.** Mobile and TV toggles and the delay stepper; `constants.md` and `CLAUDE.md`. → **P0 complete.** Fire TV check by hand (build checkpoint below).
6. **Channel → network mapping.** Setting, a TV picker and the match hook-up. **Cut first if time runs out**: team names alone cover the normal case.
7. **(P1) Roster service.** Python service, its tests, README. Confirm the unverified roster layout and the ID match against Kush's real league. (A10 server side)
8. **(P1) Scoring detection.** `espnBoxscore`, `scoringEvents`, `fantasyRoster`, tests. (A9)
9. **(P1) Alerts on screen.** `useFantasyAlerts`, toasts, a one-line "my players" stat line under the bug, the `fantasyRosterUrl` setting and its UI. (A9, A10)
10. **(P1) Manual game pick.** The tile menu item "Choose game…". **Cut second.**

The ticker (P2) isn't built. `useLiveScores` already exposes all games, so a ticker can read the same data later.

## 9. Checkpoints

**Approving Gate 2 covers:** the 4 settings in section 3 and "no new dependencies" in section 4.

**Still needing Kush's separate approval during the build:**
- **API keys / secrets (slice 7):** putting the ESPN cookies into the service's `.env` on the box. Kush or his brother types them, and Claude never reads or prints them.
- **Deploy (slice 7):** installing the Python file and systemd unit on the brother's Ubuntu box.
- **Build/CI (after slice 5 and slice 9):**
  - pushing the branch and opening a PR so CI builds the Fire TV APK;
  - installing it with `adb`, which isn't on the Mac yet, so installing it is its own checkpoint.
- **Any settings or dependency change not listed in sections 3–4.**

## 10. Risks and undo

- **Existing multiview users:**
  - With scores off, or no football, nothing polls and nothing draws (A11). The tile component isn't touched.
  - Undo: turn the setting off, or revert the branch.
  - The `multiview.tsx` menu index shift is the one risky edit, covered by a menu test.
- **Merge with `kush/fire-tv-promote-in-place`:** that branch changes the tile render block in `multiview.tsx` (11 lines). This plan adds code after that block and in the menu. Expect a small, mechanical conflict at most.
- **Server box:** the service is capped at 32 MB by systemd and stops with `systemctl disable --now`. Removing it is deleting one folder and one unit file.
- **ESPN blocking or changing feeds:** the bug hides itself. The source sits behind `espnScoreboard`, so another source can be swapped in (P2-5).

## 11. Consistency pass

Product spec changes to be saved in the same commit, under a `## Changes` heading:
1. **P1-1:** the fantasy league ID and team are set in the roster service's `.env` on the box, not in app settings. Only the service address is an app setting.
2. **P0-7:** "Scores unavailable" appears on the tile when its Stats are turned on, drawn by the score layer. The result is the same as the spec described.
3. **A5:** the bug stays on its game until the game is final *and* the guide has moved on. This handles a game that overruns its guide slot.
4. **P0-3:** a tile shows no bug until the delay has passed since multiview opened, so opening mid-game never flashes a live score.
5. **P1-2:** the "my players in this game" panel is a single stat line under the bug, not a separate panel.
6. **Open question 3** (channel → network mapping) is resolved as an optional setting built in slice 6, cut first.

Checked:
- Every acceptance test maps to a named test.
- Every stored value supports a test.
- The no-polling control (A11) matches decision 2.
- The "no secrets in the app" requirement (A12) matches decision 8.
