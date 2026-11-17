# Spec: TV navigation lands where you expect, with the titles showing

Status: Approved (Gates 1 and 2). Kush: "approve" (Gate 1), "go ahead" (Gate 2), 2026-11-16.
Date: 2026-11-16
Branch: `kush/tv-nav-feel`

## 1. Problem

Kush: "for looking at seasons I have to click down one extra time just to get the view finder to show the text below the squares … same with seer"; "navigation and animations feel a bit sluggish and clunky".

**Evidence (Fire TV, ADB and screenshots, 2026-11-16):**
- **Titles hidden:** on Search and Seerr Discover rows, the focused row's poster ran to the screen's bottom edge, with its title and year off-screen. The next ↓ revealed them, with the focus already on the next row.
- **Falling out of the tab bar:** ← on the first tab (Home) dropped the focus into the page's first card and hid the tab bar. A second ← scrolled the page down.
- **Lost presses:** a second press within about a second, during a scroll, could skip a whole row on Home or do nothing.

## 2. Users and goals

**Users:** anyone using SuperFin with a Fire TV or Android TV remote.

**Goals:**
1. The row you're on is fully visible, poster and title, after one press.
2. Every press moves the focus exactly one step, even pressed quickly.
3. The tab bar holds the focus at its ends.

**Non-goals:**
- **Jank and speed.** That's the next spec, after measuring.
- **Redesigning screens** (pinned headers, Live TV's alignment, duplicate airings). Later.
- **Phones, iPad and Apple TV.** Apple TV shares the code and must not get worse.

## 3. User stories

1. As a TV user, I press ↓ into a row of posters and see each poster with its title, on the first press.
2. As a TV user, I press ↓ three times quickly and land three rows down.
3. As a TV user, I press ← on the Home tab and nothing happens.
4. **Edge:** the last row on a page scrolls fully into view, titles included.

## 4. Requirements

**P0:**
1. **Rows scroll so the focused card and its text are fully on screen,** on Home, Search, Seerr Discover, Live TV, and the series and Seerr pages (seasons, episodes, cast).
2. **A press made during a scroll moves one step** from where the focus really is.
3. **← on the first tab and → on the last tab keep the focus** in the tab bar.

**P1:** ↑ and ↓ keep roughly the same column.

## 5. Success

- **Measure:** extra presses needed on seasons, Seerr and Search rows. Today 1 per row; target 0.
- **Question for Kush:** "Does moving around still feel clunky?"

## 6. Acceptance checks

1. **Automated:** a focused card is focusable together with its title and subtitle, not just the poster.
2. **Automated:** ← on the first tab and → on the last tab leave the focus in the tab bar.
3. **Automated, must not change:** the existing TV focus tests still pass.
4. **By hand, Fire TV:** on Search/Seerr, Home, a series page's seasons and episodes, and Live TV, one ↓ shows the whole focused row with its titles.
5. **By hand, Fire TV:** 3 quick ↓ presses on Home land exactly 3 rows down.
6. **By hand, Fire TV:** ← on the Home tab does nothing.

## 7. Open questions (defaults)

1. **Space below the focused row:** its titles plus a small gap.
2. **Quick presses:** move the focus at once and let the scroll catch up.

## Changes

- 2026-11-16, while planning: P0-1 for `TVPosterCard` (Home, Search, Seerr rows) shipped in #27, from the bug session, and leaving the Search box in #28. This spec's work is what remains: the other card types, P0-2 and P0-3.
- 2026-11-17, step 2: rows were skipped at a calm 1.5 s pace too, not only on quick presses, because Android picked the next card by position across rows scrolled sideways. Each Home row (`InfiniteScrollingCollectionList.tv`) is now a `TVFocusGuideView` with `autoFocus`, as docs/tv-focus-guide.md recommends, which also covers P1 (keeping your place in a row). Settings' ↑ (E) waits for the upstream catch-up, which moves Settings into a "More" tab (#33, #34).
