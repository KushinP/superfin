# Catch SuperFin up with upstream Streamyfin

Status: Approved (Gates 1 and 2)
Date: 2026-11-16
Branch: `kush/upstream-catchup` (spec), then one branch per merge step

## 1. Problem

SuperFin is a fork of Streamyfin. Since the fork split off, upstream has shipped
**63 changes** that SuperFin doesn't have. SuperFin has **50** of its own that upstream
doesn't have (multiview, live scores, Live TV tab, Fire TV keys, Seerr on TV, the Mac
sidebar, the SuperFin name and icon).

- **Who feels it:** Kush, the only user, on a Fire TV, an iPhone, an iPad and a Mac.
- **What it costs today:** upstream bug fixes don't reach SuperFin. Among them: eight
  Android TV defects (#2409), "pages should never pull TV tab bar focus" (#2452),
  ExoPlayer getting stuck buffering, silent DTS-HD audio and next-episode stalls (#2418),
  library-grid edge presses on TV (#2419), Live TV in the native player (#2485), and a new
  **Auto** quality that measures the connection (#2388, #2482).
- **Why it's getting worse:** the daily robot that should offer these changes as a PR has
  failed for days, for two reasons: the changes conflict with SuperFin's, and GitHub
  refuses to let the robot push changes to upstream's workflow files without a special
  token. Every day upstream moves, the merge gets bigger.
- **Evidence:** a trial merge on 2026-11-16 gave 88 conflicted files. 58 of them are one
  folder renamed two different ways (see below). About 40 have real overlapping edits.

The two big upstream changes:

1. **Expo SDK 58** (#2458, #2473): the app framework and React Native TV move up a
   version. Every dependency moves with it.
2. **New tab layout** (inside #2458): upstream dropped the tab bar library the fork's tabs
   are built on (`react-native-bottom-tabs`) and moved to Expo Router's own native tabs.
   - **Phones and iPad:** four tabs (Home, Search, Libraries, **More**). Favorites,
     Watchlists, Downloads, Custom links, Sessions and Settings move into More.
   - **TV:** Home, Search, Favorites, Watchlists, Library, Settings. The Custom links tab
     is gone on TV.

## 2. Users and goals

**User:** Kush, watching on a Fire TV stick most of the time, and on an iPhone, iPad and
Mac.

**Goals**
1. SuperFin has every upstream change up to `a28d2e33` (2026-11-15).
2. Every SuperFin feature works the same as today, on the same devices.
3. The next daily sync is small again: once this lands, the robot's PR only carries new
   upstream work.

**Non-goals**
- **New features.** This only merges. Anything we'd like to improve goes on a list for
  later, so the merge stays reviewable.
- **Changing upstream's behavior** where it doesn't clash with a SuperFin feature. If
  upstream changed it and SuperFin never touched it, we take upstream's version, even if
  we'd have done it differently. Otherwise every sync fights the same battle.
- **Fixing the robot's token.** Only Kush can create the `UPSTREAM_SYNC_TOKEN` secret
  (it's a password for GitHub). The spec says how; Claude never handles it.
- **Fire TV testing by this session.** The other SuperFin session owns the Fire TV. This
  work hands it a build and a checklist.

**Later**
- Re-check the fork's own patches to libraries upstream upgraded, in case upstream's
  versions now make them unnecessary.

## 3. User stories

1. As Kush on the **Fire TV**, I want the top bar to still show **Live TV** next to
   Favorites, so I can get to the guide and multiview in one click.
2. As Kush on the Fire TV, I want **multiview, the scores rail and scores screen, the
   ⏯ ⏪ ⏩ remote keys and Seerr in TV Settings** to work exactly as today.
3. As Kush on an **iPhone or iPad**, I want upstream's new four-tab layout with More, plus
   **Live TV as a tab** when my server has Live TV.
4. As Kush on the **Mac**, I want the SuperFin sidebar on the left, as today.
5. As Kush, I want the app to still install as **SuperFin**, next to Streamyfin, with its
   own icon and green color.
6. As Kush on any device, I want upstream's fixes, and the new **Auto** quality, without
   losing my settings.
7. **Error case:** if my server has no Live TV, the Live TV tab stays hidden, as today.
8. **Error case:** if a step breaks something I only notice later, I can undo just that
   step.

## 4. Requirements

**P0 (must ship)**
- All 63 upstream changes are in SuperFin's `develop`, merged as merge commits (never
  squashed or rebased: a squash makes the next sync conflict on the same files again).
- Every SuperFin feature below still works:
  - multiview on iPhone, iPad, Mac (MPV) and Android TV and Fire TV (ExoPlayer);
  - live scores: the rail, the scores screen, scores in the player and the Scores button;
  - Fire TV media keys and ⏪ ⏩ in the player;
  - the player shutdown fix (closed players free their memory);
  - Seerr sign-in in TV Settings;
  - the Live TV tab and SuperFin's own Live TV guide (placed by air time, now line, day
    chips) and channels page;
  - the Mac sidebar, keyboard shortcuts and window size;
  - SuperFin's name, bundle id `com.kushagra.superfin`, `superfin://` links, icon, green;
  - the fork's tests (including the check that stops `@react-navigation/native` imports)
    and its learned facts.
- Settings saved on the device before the update still load after it. Nobody has to sign
  in again.
- The work lands in **three steps**, each its own PR, each with all checks green and an
  Android TV build that bundles:
  1. upstream's changes from before the SDK 58 move (18 changes, 12 conflicted files);
  2. the SDK 58 move and the new tabs (the big one);
  3. everything after it, up to today (React Native TV 0.88, Auto quality, Live TV in the
     native player, ExoPlayer fixes, and so on).

**P1 (fast follow)**
- `docs/conventions/upstream-sync.md` gets the new folder names and a row for each fork
  area that now differs from upstream (tabs, Mac sidebar).
- `CLAUDE.md` describes the new tabs and SDK 58.

**P2 (design for, don't build)**
- The daily robot works again once Kush adds the token. Nothing in this work should make
  its job harder: keep fork-only changes in fork-only files where we can.

## 5. Success

- **Number:** the next daily sync after this lands opens a PR with **0 conflicts**.
  Measured from that PR's body. Target: 0.
- **Question for Kush after a week:** "Has anything you use stopped working, or moved
  somewhere you didn't expect?"

## 6. Acceptance checks

| # | Given | When | Then | How |
| --- | --- | --- | --- | --- |
| A1 | the three PRs merged | I compare `develop` with upstream | upstream `a28d2e33` is part of `develop`'s history | automated (`git merge-base --is-ancestor`) |
| A2 | a phone build | the app opens | the bar shows Home, Search, Libraries, More, and Live TV when the server has it | automated (tab layout test) |
| A3 | an Android TV build | the app opens | the top bar shows Home, Search, Favorites, Live TV, Watchlists (if Streamystats is set), Library, Settings | automated (TV tab list test) + by hand on the Fire TV |
| A4 | a server with **no** Live TV | the app opens on a phone or TV | no Live TV tab | automated |
| A5 | the Fire TV | I open multiview with 2 live channels and press ⏯ ⏪ ⏩ | the focused tile pauses, rewinds, skips; the scores rail shows games | by hand (other session) |
| A6 | the Fire TV | I open TV Settings | Seerr sign-in is there and signs in | by hand (other session); the existing `TVSeerrSettings` tests stay green |
| A7 | settings saved by today's SuperFin | I install the merged build over it | my server, sign-in and settings are kept | automated (settings load test) + by hand |
| A8 | the merged code | I build the app config | name SuperFin, id `com.kushagra.superfin`, scheme `superfin` | automated (`app.config.test.ts`) |
| A9 | every step | before its PR | typecheck, unit tests, Biome, i18n check pass, and `EXPO_TV=1 bunx expo export --platform android` builds | automated |
| A10 | a closed player on Android TV | I close it and open another | the first player's memory is freed | automated (existing destroy tests stay green) |
| A11 (control) | any step | I read the diff | no SuperFin feature file (multiview, live scores, media keys, Seerr TV) lost lines it had, except where a conflict was resolved on purpose and noted in the PR | by hand (review) + existing tests |
| A12 (failure) | a step's PR merged and broke something | I revert that one merge commit | `develop` goes back to the step before, the other steps untouched | by hand |
| A13 | the Mac | the app opens | the SuperFin sidebar shows, and the tab bar doesn't | by hand (Kush, on the Mac) |

## 7. Open questions

1. **Live TV on phones:** its own tab (Home, Search, Live TV, Libraries, More: five in
   all), or a row inside More like Favorites?
   **Default:** its own tab, shown only when the server has Live TV.
2. **Custom links on TV:** upstream removed the Custom links tab from the TV bar (phones
   still have them in More). Do you use custom links on the Fire TV?
   **Default:** follow upstream and drop it on TV. Fewer differences means easier syncs.
3. **Mac sidebar:** the fork's sidebar hid the old library's tab bar. If upstream's new
   tabs can't hide their bar on the Mac, is it OK for the Mac to show upstream's tab bar
   until a follow-up fixes it?
   **Default:** try hard to keep the sidebar. If it can't be done in step 2, ship with the
   tab bar on the Mac and note it in the PR.

## Changes

- 2026-11-16: the build found things the spec did not name, recorded in the
  plan's Changes: a multiview memory risk on the Fire TV from upstream's
  ExoPlayer buffer (fixed), two iOS player compile errors (fixed), three
  upstream guide tests dropped with Kush's approval, and an Expo patch bump
  left for its own PR. A7 is covered by "settings saved before the upstream
  catch-up" in `utils/atoms/settings.test.ts`.
