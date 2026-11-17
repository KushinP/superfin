# Technical plan: catch SuperFin up with upstream Streamyfin

Status: Approved (Gate 2)
Date: 2026-11-16
Spec: [2026-11-16-upstream-catchup.md](2026-11-16-upstream-catchup.md)
Branches: `kush/upstream-catchup` (spec and step 1), `kush/upstream-sync-2`,
`kush/upstream-sync-3`

Gate 1 settled the open questions on their defaults: Live TV is its own phone tab when the
server has it; the TV Custom links tab goes, as upstream did; the Mac keeps its sidebar.

## 1. Architecture decisions

**Merge in three steps, at upstream's own commits.**
- Alternatives: one merge of everything (88 conflicts in one PR, impossible to review), or
  cherry-picking upstream commits one by one (rewrites their history, so the next daily
  sync sees them as new and conflicts again).
- Why: upstream's history from here is a straight line of squashed PRs, so merging at
  `48f52339` (the last commit before SDK 58), then `793ecbbf` (SDK 58 and the tabs), then
  the tip keeps upstream's commits exactly as they are, and each PR stays reviewable.
  Trial merges: step 1 has 12 conflicted files; step 2, 71 before step 1 lands.

**Merge commits only.** Each step is `git merge --no-ff <upstream commit>` and its PR merges
into `develop` with a merge commit, never squash or rebase
(`docs/conventions/upstream-sync.md`).

**One name for the shared route folder:**
`(home,libraries,search,more,tv-favorites,tv-watchlists,livetv)`.
- This folder holds pages that open inside whichever tab you're in (a series, a person,
  the Live TV screen). Its name lists the tabs. SuperFin added `livetv`; upstream replaced
  `favorites,watchlists` with `more,tv-favorites,tv-watchlists`. The union is upstream's
  name plus `livetv`.
- Alternative: rename upstream's folder back. Rejected: every future upstream change to
  those 16 pages would conflict.

**Live TV becomes one more tab in upstream's tab system, not a separate one.**
- Phones and iPad: one `NativeTabs.Trigger name='(livetv)'`, hidden when the server has no
  Live TV, placed between Search and Libraries.
- Android TV and Fire TV: `(livetv)` added to upstream's TV tab list in `utils/tvTabs.ts`,
  after Favorites, only when the server has Live TV. `tvTabGroups` and `isTVTabGone` take
  a `liveTv` flag alongside `watchlists`, so leaving a Live TV tab that disappears sends
  you Home the way upstream already does for Watchlists.
- Apple TV: same native trigger as phones, hidden without Live TV.
- Expo Router requires every tab folder to sort after `(home)`
  (upstream's learned fact `shared-route-from-outside-tabs-lands-in-first-group`).
  `(livetv)` does.

**The Mac sidebar stays, on upstream's new tabs.** Expo Router 58's `NativeTabs` has a
`hidden` prop that hides the whole tab bar (checked in `expo-router@58.0.30`
`build/native-tabs/types.d.ts`). The Mac passes `hidden` and draws `MacSidebar` beside
it, as it does today with the old library's `tabBarHidden`. The sidebar's items point at
upstream's new places: Favorites, Watchlists and Settings open inside `(more)`. Custom
links are dropped from the sidebar, matching TV.

**Conflicts: SuperFin's version for SuperFin features, upstream's for the rest.** Where a
file has both, combine them line by line. Specifically:
- SuperFin's Live TV guide (`LiveTVGuideRow`, `HourHeader`) keeps its layout; upstream's
  fixes to those files are carried over where they still apply, and each one dropped is
  named in the PR.
- `app.json`, `app.config.ts`, icons, colors: SuperFin's identity, upstream's everything
  else.
- `package.json` and `bun.lock`: upstream's versions. The lock file is never hand-merged:
  take upstream's, then `bun i` to regenerate it.
- `CLAUDE.md` and the learned facts: upstream's text plus the fork's rows.

**Commits are run by Kush.** The commit check hook runs `bun run test`, and one multiview
test hangs on this Mac. For each commit I stage everything, run the checks myself, show
the output, and give Kush the exact `git commit` and `git push` commands.

## 2. Components and files

**Step 1** (merge `48f52339`, 18 upstream changes). Conflicts: `.github/workflows/build-apps.yml`,
`CLAUDE.md`, `app.config.test.ts`, `app.config.ts`, the two watchlist pages,
`app/_layout.tsx` (upstream's start-up speed-up; the fork's multiview and scores-modal
screens and push project id are kept), `bun.lock`, `components/Loader.tsx`,
`docs/conventions/constants.md`, `package.json`, `utils/tvDiscovery/payload.ts`.

**Step 2** (merge `793ecbbf`, Expo SDK 58 and the tabs). Expected conflicts, beyond those
step 1 removes: the 16 shared pages (the folder name), `app/(auth)/(tabs)/_layout.tsx`, the
four music library pages, `hooks/useTVBackHandler.ts`, `hooks/useTVEventHandler.ts`
(Fire TV media keys), `components/MediaSourceButton.tsx`, `test-utils/reanimated.ts`,
`app.json`, the Live TV guide test, `package.json`, `bun.lock`. Then fork changes, each
its own commit:
- `app/(auth)/(tabs)/_layout.tsx`, `utils/tvTabs.ts` (+ test): the Live TV tab;
- `app/(auth)/(tabs)/(livetv)/_layout.tsx`: moved to Expo Router 58's `anchor` setting
  (upstream's layouts did the same);
- `components/MacSidebar.tsx`, `utils/macSidebar.ts` (+ test): the sidebar on the new tabs;
- every link that names a removed group (`(favorites)`, `(watchlists)`, `(settings)`,
  `(custom-links)`, the old shared folder) points at its new place. Found by search, and
  checked by a test that fails on any link to a folder that no longer exists;
- `app/(auth)/(tabs)/(more)/settings.tv.tsx`: Seerr in TV Settings kept;
- `CLAUDE.md`: tab groups, stack versions, the native module list (`CLAUDE.test.ts`
  checks these);
- `.claude/learned-facts/`: upstream deletes `ios27-sdk-tab-bar-items-display-order` and
  `swiftui-foreach-evicts-hidden-tabs`, which were about the removed library. We take the
  deletion. `sidebar-adaptable-breaks-in-a-mac-window` is updated to the new tabs.
- `patches/react-native-bottom-tabs@1.4.0.patch` and its test go with the library.

**Step 3** (merge the tip, `a28d2e33` or newer). Expected conflicts:
`app/(auth)/player/direct-player.tsx`, `ExoPlayerView.kt`, `useRemoteControl` and its
test, `buildNativePlayerConfig.ts`, `utils/atoms/settings.ts`, `constants/Playback.ts`,
`PlaybackControlsSettings.tsx`, the Live TV guide, MPV on iOS (`PlayerEngine.swift`,
`MpvPlayerModule.swift`), `HeroCarouselContent.kt`, `ItemContent.tv.tsx`. Then:
- multiview's quality picker and `utils/multiview/tileBitrate.ts`: read the quality list
  from its new home (`constants/Playback.ts`, `utils/bitrate.ts`). A tile never streams
  at Auto: Auto measures one connection for one player, and four tiles share the link.
  The multiview quality setting keeps its fixed choices;
- the player destroy fix and media keys: re-checked against upstream's ExoPlayer stall
  fixes (#2418) and the native iOS player key handling (#2344).

External calls: none new. Every check runs offline.

## 3. Schema

There's no database. What's stored is the settings saved on each device (MMKV, a small
key-value store) and the signed-in server and user.

- **Kept as they are:** every setting SuperFin has today, including the fork's
  `multiviewMaxBitrate`, `liveScoresEnabled`, `liveScoresDelaySeconds`,
  `ambientBackgrounds`. Their names and meanings don't change.
- **Added by upstream:** `autoBitrateRatio`, `autoBitrateTtlMinutes`,
  `autoBitrateInNetworkMin`, `autoBitrateAdapt`, `matchRefreshRate`. A device without
  them gets their defaults.
- **Changed default, not changed data:** upstream's default quality becomes Auto. A device
  that saved a quality keeps it. Only a fresh install starts on Auto.
- **Never overwritten:** the saved server, sign-in, and any saved setting.
- **Links:** `superfin://` links into removed folders (for example a Favorites link) stop
  resolving. Nothing outside the app stores those links today, except Android TV home-screen
  recommendations, which use item links (`utils/tvDiscovery/payload.ts`) that don't name
  a tab folder.

## 4. Dependencies

Gate 2 approves upstream's `package.json` and `bun.lock` as they stand at the step's
upstream commit. SuperFin adds no packages of its own (its only changes were SDK 57 patch
versions, which upstream's SDK 58 versions replace).

- **Version moves:** 71 packages, led by `expo` 57 → 58.0.23, `expo-router` → ~58.0.30,
  `react-native` → `react-native-tvos@0.88.1-0`, `jest-expo` → ~58.0.14.
- **Added by upstream:** `@expo/repack-app` (CI repacks JS into earlier builds),
  `@react-native/jest-preset` (tests), `expo-file-system`, `react-native-drax` (drag and
  drop for the music queue).
- **Removed by upstream:** `@bottom-tabs/react-navigation`, `react-native-bottom-tabs`,
  `@react-native-community/cli`, `react-native-circular-progress`,
  `react-native-collapsible`, `react-native-country-flag`, `react-native-device-info`,
  `react-native-draggable-flatlist`, `react-native-url-polyfill`,
  `react-native-volume-manager`, `zod`. No SuperFin-only code uses any of them (checked:
  the fork's own lines import none). Upstream's own files that used them are rewritten in
  the same merge.

**Workflow files** (Gate 2 covers these as the CI checkpoint): upstream's changes to
`.github/` are taken, with the fork's guards kept. Upstream adds
`.github/actions/repack/`, `e2e-tier1-android.yml` and `native-tests.yml`. Any job that
needs upstream's secrets (the signed iOS build and its repack, which use `EXPO_TOKEN`) gets
the `if: github.repository == 'streamyfin/streamyfin'` guard, as the convention says.

## 5. Failure modes

- **A link to a folder that no longer exists.** Expo Router doesn't fail a build for it;
  the app shows "page not found". Caught by: a new test that lists every route folder
  under `app/` and fails on any `/(auth)/(tabs)/(name)` link in the code naming one that
  isn't there.
- **A conflict resolved by taking one side whole, losing the other's lines.** Looks fine,
  passes tests if nothing covers it. Caught by: for each SuperFin feature file, a
  `git diff develop` per step, read by me and listed in the PR ("lines changed in
  SuperFin files, and why").
- **Bundler-only breaks** (#22 broke every build with an import while every test passed).
  Caught by: `EXPO_TV=1 bunx expo export --platform android` before each PR, plus the
  existing `noReactNavigationImports` test.
- **The fork's patched packages:** `react-native-track-player`, `react-native-google-cast`
  and `react-native-udp` patches must still apply to upstream's versions. If a patch fails,
  `bun i` says so; we stop and look.
- **Native code that only a device build compiles** (Kotlin, Swift). The JS bundle check
  doesn't compile it. Caught by: the PR's CI Android TV build, and the Fire TV checklist
  handed to the other session.
- **Multiview at Auto quality:** if a tile ever got Auto, four players would each measure
  the link and step on each other. Caught by a test in `tileBitrate.test.ts`.
- **Upstream moves during the work.** Step 3 takes the newest tip at the time and says
  which.

On any of these: stop, don't open the PR, and tell Kush.

## 6. Test plan

| Check | Test |
| --- | --- |
| A1 | `git merge-base --is-ancestor a28d2e33 origin/develop` after step 3, pasted in the PR |
| A2, A4 | the tab layout test: phone triggers with and without Live TV (extends upstream's tabs test) |
| A3, A4 | `utils/tvTabs.test.ts`: TV list with and without Live TV and Watchlists, and `isTVTabGone` for Live TV |
| A5, A6, A10 | existing tests: multiview, live scores, `MediaKeySession`/`mediaKeys`, `useRemoteControl`, `TVSeerrSettings`, the player destroy tests, all green; Fire TV checks by hand by the other session |
| A7 | existing settings tests, plus one that loads today's saved settings (with fork keys) into the merged atom and gets them back |
| A8 | `app.config.test.ts` |
| A9 | `bun run typecheck`, `bun run test:unit`, `bun run check`, `bun run i18n:check`, `EXPO_TV=1 bunx expo export --platform android`, each step |
| A11 | per-step diff review of SuperFin files, in the PR |
| A12 | by hand: the PR states the revert command for that step |
| A13 | `utils/macSidebar.test.ts` for the items; Kush on the Mac by hand |
| links | the new route-folder link test (section 5) |

The fake-timer multiview test that hangs here: I run the suite with it skipped on the
command line only (`--testPathIgnorePatterns`), never edited out, and say so. CI runs it.

## 7. AI features

None.

## 8. Build order

Each step ends in a passing PR. Merge commits are large by nature (they carry upstream's
work); the fork's own changes after each merge stay under ~300 lines per commit.

1. **Step 1, `kush/upstream-catchup`:** the spec and this plan (their own commit), then
   the merge of `48f52339`. PR 1.
2. **Step 2, `kush/upstream-sync-2`** (from step 1): the merge of `793ecbbf` with the
   folder rename, then one commit each for: the Live TV tab, the Mac sidebar, the links
   and their test, docs and learned facts. PR 2, based on PR 1.
3. **Step 3, `kush/upstream-sync-3`** (from step 2): the merge of the tip, then the
   multiview quality fix and anything else the checks find. PR 3, based on PR 2.
4. **Hand-off:** a Fire TV checklist for the other session, in the shared notes folder.

If time runs short, the steps stand alone: step 1 is useful without 2 and 3.

## 9. Checkpoints

Gate 2 covers: the stored settings in section 3 (additions only, no data rewritten),
upstream's dependency changes in section 4, upstream's workflow changes with the fork's
guards, and deleting the two react-native-bottom-tabs learned facts and the
react-native-bottom-tabs patch along with the library.

Still needing their own approval during the build: any dependency or setting not listed
here, any deploy, deleting anything else that isn't scratch, and anything touching
sign-in or keys beyond taking upstream's code as is. The `UPSTREAM_SYNC_TOKEN` secret is
Kush's to create. To lift both limits, make a fine-grained GitHub token on
KushinP/superfin with Contents, Pull requests and Workflows set to read and write, and save
it as a repository secret with that name. I never see it.

## 10. Risks and undo

- **Something breaks on a device after a step lands.** Undo: revert that step's merge
  commit on `develop` (`git revert -m 1 <merge commit>`), as a PR. The earlier steps stay.
- **Each merge into `develop` cancels its running app build**
  (`develop-merge-cancels-tv-build`). Merge the three PRs back to back and wait for one
  build, or install a PR's own build first.
- **Fire TV behavior that only shows on the device** (focus, keys, memory). The other
  session tests each step's build before Kush merges the next.
- **Upstream moves on before step 3 lands:** the daily sync then opens a PR with the new
  commits on top. That's the normal, small, sync again.

## 11. Consistency pass

- Spec P0 said "Live TV tab and SuperFin's own guide". The plan keeps the guide's layout
  and lists upstream guide fixes it drops, rather than promising all of them. Matches A11.
- Spec open question 2 (TV custom links) → plan drops them on TV and on the Mac sidebar
  too, so the Mac and TV agree. Noted in section 1.
- Spec A13 (Mac sidebar, tab bar hidden) → plan section 1 names the `hidden` prop that
  makes it possible.
- Spec said the robot's token is out of scope → plan section 9 only explains how Kush
  makes it.

## Changes

- 2026-11-16, step 1: upstream moved notification setup into
  `hooks/useNotificationRegistration.ts` with Streamyfin's EAS project written
  in. The hook asks for a push token only with the build's own project
  (`utils/pushProjectId`), as SuperFin did before; two tests cover it.
- 2026-11-16, step 2: Jest 30 (SDK 58) no longer hangs on
  `multiviewScores.test.tsx`, but the commit hook's `expo-doctor` fails: 26
  Expo packages are a patch or two behind SDK 58's newest, upstream's tip
  included. CI runs doctor as non-blocking. Kush committed from his terminal;
  the patch bump is a separate PR after the merge, with its own approval.
- 2026-11-16, step 2: the Live TV tab, Mac sidebar and dead-link test landed
  as one commit, not three (a commit command ran with both sets staged).
- 2026-11-16, step 2: the Mac sidebar is loaded only on the Mac. Imported at
  the top of the tab layout, it pulled the item code into every layout test
  and into phone and TV start-up.
- 2026-11-16, step 3: not in the plan, found in the merge:
  - ExoPlayer: upstream's bounded buffer pool (#2418) would hold ~384 MB for
    four multiview tiles in a 256 MB heap. A tile gets a quarter of the pool
    and 10s ahead.
  - The iOS player's keys: upstream's `PlayerKeyboardPolicy` and SuperFin's
    `PlayerKeyBindings` both declared `PlayerKeyAction` and both overrode
    `keyCommands`, which does not compile. Upstream's owns space and the
    arrows; SuperFin's keeps ↑ ↓, M and Esc.
  - The phone scores sheet caps its own height at half the window: upstream's
    shared sheet dropped snap points.
  - Three upstream tests of the phone guide SuperFin replaced were dropped,
    approved by Kush; the clock change cases now test SuperFin's guide.
- 2026-11-16: develop's #27, #28 and #29 were merged into each step branch
  while the PRs were prepared, combining `TVPosterCard.test.tsx`.
