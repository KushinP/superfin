# Spec: Seerr works on the Fire TV

Status: Approved (Gates 1 and 2). Kush: "approce" (Gate 1), "approve" (Gate 2), 2026-11-16.
Date: 2026-11-16
Branch: `kush/tv-seerr-settings`

## 1. Problem

Kush: "i want seerr to wor on fire tv". He set up Seerr on his server, and SuperFin is only on his Fire TV for now.

**Evidence (code, 2026-11-16):**
- The TV has Seerr Discover, Seerr search results, Seerr item pages and the request screen (`components/seerr/tv/`, `components/search/TVSearchPage.tsx`).
- The TV settings have no Seerr entry. Only the phone has one (`components/settings/Seerr.tsx`).
- On TV the address can only arrive from the Streamyfin plugin on the Jellyfin server, so on a Fire TV without it, Seerr never turns on.

## 2. Users and goals

**Users:** anyone using SuperFin on a Fire TV or Android TV with their own Seerr server. Kush is the first.

**Goals:**
1. Connect SuperFin on the TV to any Seerr server once, with the remote.
2. Search for a title the Jellyfin server doesn't have, and request it from the TV.

**Non-goals:**
- **Building in any particular server or address.** Nothing in the app is specific to Kush; each person types their own.
- **Changing Seerr servers.** That's server-side.
- **Phone, iPad and Mac.** They already have this.
- **New request features.** The existing TV request screen stays as it is.
- **Custom headers for Seerr on TV.** Later, if someone needs them.

## 3. User stories

1. As a TV user, I open **Settings → Seerr**, type my Seerr address with the on-screen keyboard, and press **Sign in**. With Jellyfin's Quick Connect on, no password is needed; otherwise I'm asked for my Jellyfin password.
2. As a TV user, once signed in, Search shows Seerr results for titles the server doesn't have, with **Request**.
3. As a TV user, I see that I'm connected (the address and my Seerr name), and can **Sign out**.
4. **Error:** a wrong address, or a server that isn't Seerr, says so on screen and saves nothing.

## 4. Requirements

**P0:**
- **Its own "Seerr" row in the TV settings,** opening a Seerr section with:
  - an address field (empty by default);
  - Sign in;
  - the connected state;
  - Sign out.
- **The same sign-in as the phone, reused, not rewritten.** It checks the address is a Seerr server, uses Quick Connect when available, and falls back to the password.
- **Once signed in, the existing TV Seerr screens appear,** with no other change.
- **An address set and locked by the server's plugin** shows, and can't be edited.

**P1:** an API key instead of a password, as the phone allows.

## 5. Success

- **Measure:** on a Fire TV, from Settings to a sent request in under 2 minutes, and the request shows up in Seerr.
- **Question for Kush:** "Could you request something from the TV without help?"

## 6. Acceptance checks

1. **Automated:** a Seerr address that answers, with Quick Connect on, signs in with no password, and is saved.
2. **Automated:** with Quick Connect off, a password is asked for. The right one signs in; a wrong one shows an error and saves nothing.
3. **Automated:** an address that isn't a Seerr server shows "couldn't reach Seerr" and saves nothing.
4. **Automated:** Sign out clears the Seerr sign-in, and the Seerr screens and search results go away.
5. **Automated, must not change:** the phone's Seerr settings behave exactly as before.
6. **Automated:** an address locked by the server plugin shows and can't be edited.
7. **By hand, Fire TV:** sign in, search for a missing title, request it, and see it in Seerr.

## 7. Open questions

None. The row is its own entry in the TV settings, per Kush.
