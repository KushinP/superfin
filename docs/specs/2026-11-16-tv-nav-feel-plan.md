# Technical plan: TV navigation feel

Status: Approved (Gate 2). Kush: "go ahead", 2026-11-16.
Date: 2026-11-16
Branch: `kush/tv-nav-feel`
Spec: [2026-11-16-tv-nav-feel.md](2026-11-16-tv-nav-feel.md)

## 1. Decisions

- **A. Season card titles (P0-1).** `TVSeriesSeasonCard` gets its title and subtitle inside the focusable `Pressable`, below the zoomed poster, as #27 did for `TVPosterCard`. Android then scrolls the whole card, text included, into view. Seerr posters and episodes already use `TVPosterCard`; cast and channel cards already hold their text.
- **B. Tab bar ends (P0-3).** The tab row sits in a `TVFocusGuideView` with `trapFocusLeft` and `trapFocusRight`, so ← on the first tab and → on the last stay put. ↓ still reaches the page.
- **D. Home's top row.** ↓ from its first card moved right instead of down (bug session's ADB note). Find out why, and make ↓ leave the row downward.
- **E. Settings.** ↑ couldn't reach the tab bar: the disabled "Switch user" row stops the focus at SyncPlay. A disabled row stays reachable, or the screen gives ↑ a way past it.
- **F. Hero cards.** `TVHeroCarousel` cards get screen-reader names, as #27 gave `TVPosterCard`.
- **C + G. Presses during a scroll (P0-2).** First reproduce with exact timing on the TV, then try scrolling without animation on focus. This goes in a separate PR, shown to Kush before and after. Time-boxed: if it can't be reproduced or fixed, report back.

## 2. Files

| File | Change |
|---|---|
| `components/tv/TVSeriesSeasonCard.tsx` | Text inside the focusable part |
| `components/tv/TVNavBar.tsx` | A focus guide that traps ← and → |
| Home's top row / `TVHeroCarousel` | D, F |
| `app/(auth)/(tabs)/(home)/settings.tv.tsx` (or the row component) | E |
| Tests next to each | Checks 1 and 2, plus D, E and F |

## 3. Schema
None.

## 4. Dependencies
None.

## 5. Failure modes

- **A bigger focusable area changes which card ↑/↓ lands on:** checked on the TV.
- **The trap blocks a legitimate exit:** it only blocks sideways at the ends.

## 6. Test plan

| Check | Test |
|---|---|
| 1 | `TVSeriesSeasonCard.test.tsx`: the title is inside the focusable part |
| 2 | `TVNavBar.test.tsx`: the row traps ← and → |
| 3 | The existing TV tests still pass |
| 4 to 6 | Fire TV, ADB and screenshots |

## 7. Build order

1. A, B, D, E and F: one PR.
2. C and G: a separate PR.

## 8. Checkpoints
No schema and no dependencies.

## 9. Risks and undo
Revert the PR.
