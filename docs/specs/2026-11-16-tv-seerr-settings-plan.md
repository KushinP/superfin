# Technical plan: Seerr on the Fire TV

Status: Approved (Gate 2). Kush: "approve", 2026-11-16.
Date: 2026-11-16
Branch: `kush/tv-seerr-settings`
Spec: [2026-11-16-tv-seerr-settings.md](2026-11-16-tv-seerr-settings.md)

## 1. Architecture decisions

**A. One shared sign-in.**
- **Decision:** the phone's sign-in moves out of `components/settings/Seerr.tsx` into `utils/seerrSignIn.ts`: the address check, Quick Connect, the API key, the password, and the account-switch guard. The phone and the TV both call it.
- **Rejected:** a TV copy, which would drift and lose the subtle guards.
- **Phone:** it behaves the same; its existing tests guard that.

**B. The TV section.**
- **Decision:** `components/settings/TVSeerrSettings.tsx`, built from the TV parts the settings already use:
  - `TVSectionHeader`;
  - `TVSettingsTextInput` for the address and the password;
  - `TVSettingsOptionButton` for Sign in and Sign out.
- **Where:** its own "Seerr" section in `settings.tv.tsx`.
- **Locked address:** an address locked by the server plugin shows as read-only.

**C. What turns the TV's Seerr screens on.** Nothing changes: they turn on from the saved address and sign-in.

## 2. Components and files

| File | Job |
|---|---|
| `utils/seerrSignIn.ts` (new) | The sign-in, moved from the phone screen |
| `components/settings/Seerr.tsx` | Calls it (phone) |
| `components/settings/TVSeerrSettings.tsx` (new) | The TV section |
| `app/(auth)/(tabs)/(home)/settings.tv.tsx` | Shows the section |
| `components/settings/TVSeerrSettings.test.tsx` (new) | Checks 1 to 4 and 6 |

**External calls:** only the ones the phone makes: the typed address, Seerr's test and sign-in, and Jellyfin's Quick Connect.

## 3. Schema
None. It uses the same `seerrServerUrl` and `seerrApiKey` settings and the same Seerr user store.

## 4. Dependencies
None.

## 5. Failure modes

- **A wrong address, or not a Seerr server:** an error shows, and nothing is saved.
- **A wrong password:** an error shows, and nothing is saved.
- **The account changes mid sign-in:** the shared guard (`currentUserId`).

## 6. Test plan

| Check | Test |
|---|---|
| 1 | `TVSeerrSettings.test.tsx`: "Quick Connect on: signs in with no password and saves the address" |
| 2 | Same file: "Quick Connect off: asks for the password, and the right one signs in", "a wrong password shows the error and saves nothing" |
| 3 | Same file: "an address that isn't a Seerr server shows the error and saves nothing" |
| 4 | Same file: "signed in: shows the address, and Sign out clears the sign-in" |
| 5 | `components/settings/Seerr.test.tsx`, unchanged and passing |
| 6 | Same file: "an address the server's plugin locked shows and can't be edited" |
| 7 | Fire TV, by hand |

## 7. Build order

1. The shared sign-in, with the phone's tests passing.
2. The TV section, with tests.
3. A local Android bundle check, the PR, and the CI build.

## 8. Checkpoints
Covered by this approval: no schema and no dependencies. It reuses the existing Seerr sign-in rather than adding a new one.

## 9. Risks and undo

- **Risk:** the move could break the phone's sign-in. Its tests guard that.
- **Undo:** revert the PR.
