import { useQuery } from "@tanstack/react-query";
import { useAtom, useSetAtom } from "jotai";
import { useEffect, useMemo, useState } from "react";
import {
  LIVE_SCORES_DELAY_DEFAULT_S,
  LIVE_SCORES_POLL_IDLE_MS,
  LIVE_SCORES_POLL_LIVE_MS,
  LIVE_SCORES_SCOREBOARD_URL,
  LIVE_SCORES_STALE_MS,
} from "@/constants/LiveScores";
import {
  followedGameIdsAtom,
  type LiveScoresView,
  liveScoresViewAtom,
} from "@/utils/atoms/liveScores";
import { useSettings } from "@/utils/atoms/settings";
import { markExpectedError } from "@/utils/errors";
import {
  addSnapshot,
  clampDelaySeconds,
  delayedSnapshot,
  type Snapshot,
} from "@/utils/livescores/delayBuffer";
import {
  type GameScore,
  parseScoreboard,
} from "@/utils/livescores/espnScoreboard";
import {
  activeFollows,
  hasLiveGame,
  splitFollowed,
} from "@/utils/livescores/railItems";
import { writeDebugLog } from "@/utils/log";

/** ESPN answered with something parseScoreboard does not recognise. */
class ScoreboardFormatError extends Error {
  override name = "ScoreboardFormatError";
}

// Every failure is marked expected: ESPN's feed is unofficial, so it being
// down or changed is a known outcome the rail handles by saying so, not an
// app bug for Sentry, and on a 15 s poll it would be a flood.
const fetchScoreboard = async (signal: AbortSignal): Promise<GameScore[]> => {
  let response: Response;
  try {
    response = await fetch(LIVE_SCORES_SCOREBOARD_URL, { signal });
  } catch (error) {
    throw markExpectedError(error);
  }
  if (!response.ok) {
    throw markExpectedError(
      new Error(`ESPN scoreboard answered ${response.status}`),
    );
  }
  let games: GameScore[] | null = null;
  try {
    games = parseScoreboard(await response.json());
  } catch {
    // Not JSON at all: the same as JSON we cannot read.
  }
  if (!games) {
    throw markExpectedError(
      new ScoreboardFormatError("ESPN scoreboard is not in a known shape"),
    );
  }
  return games;
};

type Reason = NonNullable<LiveScoresView["reason"]>;

/**
 * Live NFL scores for every game on ESPN's board, for the screen that's
 * open (multiview, or the player on a live channel): one shared poll, held
 * back by the spoiler delay, with the viewer's followed games first.
 *
 * It no longer works out which game a channel shows from the guide: on the
 * Fire TV (2026-11-15) 49ers–Cowboys ran past its slot into "The OT", which
 * names no teams, and its score vanished. Every game is shown, and the
 * viewer picks theirs on the scores screen.
 *
 * Nothing is fetched while `active` is false or scores are turned off.
 */
export const useLiveScores = (active: boolean) => {
  const { settings } = useSettings();
  const enabled = active && settings.liveScoresEnabled !== false;
  const delayMs =
    clampDelaySeconds(
      settings.liveScoresDelaySeconds ?? LIVE_SCORES_DELAY_DEFAULT_S,
    ) * 1000;

  const query = useQuery({
    queryKey: ["livescores", "nfl", "scoreboard"],
    queryFn: ({ signal }) => fetchScoreboard(signal),
    enabled,
    // Never written to the disk cache: old scores on the next launch would
    // only mislead.
    gcTime: 0,
    retry: 1,
    // Fast while any game is in play, judged on the newest fetch, not the
    // delayed one, or the first half minute of a game would poll slowly.
    refetchInterval: (q) =>
      q.state.data && hasLiveGame(q.state.data)
        ? LIVE_SCORES_POLL_LIVE_MS
        : LIVE_SCORES_POLL_IDLE_MS,
  });

  const [buffer, setBuffer] = useState<Snapshot<GameScore[]>[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!query.data || !query.dataUpdatedAt) return;
    const fetched = { fetchedAt: query.dataUpdatedAt, data: query.data };
    setBuffer((b) => addSnapshot(b, fetched, Date.now(), delayMs));
    setNow(Date.now());
  }, [query.data, query.dataUpdatedAt, delayMs]);

  // So a device test can tell "ESPN had no games" from "nothing was asked".
  useEffect(() => {
    if (!query.data || !query.dataUpdatedAt) return;
    writeDebugLog("Live scores: fetched the scoreboard", {
      games: query.data.length,
      inProgress: query.data.filter((g) => g.state === "in").length,
    });
  }, [query.data, query.dataUpdatedAt]);

  // Wake exactly when the next fetched snapshot becomes old enough to show,
  // or when the newest one turns stale, rather than ticking every second.
  useEffect(() => {
    const latest = buffer[buffer.length - 1];
    if (!latest) return;
    const wakes: number[] = [];
    const staleAt = latest.fetchedAt + LIVE_SCORES_STALE_MS + 1;
    if (staleAt > now) wakes.push(staleAt);
    const pending = buffer.find((s) => s.fetchedAt > now - delayMs);
    if (pending) wakes.push(pending.fetchedAt + delayMs);
    if (wakes.length === 0) return;
    const wakeAt = Math.min(...wakes);
    // At least wakeAt, whatever the timer's accuracy: a clock left just short
    // of the line would never cross it, leaving an old score frozen.
    const timer = setTimeout(
      () => setNow(Math.max(Date.now(), wakeAt)),
      Math.max(0, wakeAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [buffer, now, delayMs]);

  const latest = buffer[buffer.length - 1];
  // Any doubt about the data hides every score: a failed or unreadable
  // fetch, or a newest fetch too old to trust.
  const unavailableReason: Reason | null = query.isError
    ? query.error instanceof ScoreboardFormatError
      ? "format"
      : "network"
    : latest && now - latest.fetchedAt > LIVE_SCORES_STALE_MS
      ? "stale"
      : null;
  const shown = delayedSnapshot(buffer, now, delayMs);

  const [followedIds, setFollowedIds] = useAtom(followedGameIdsAtom);
  // A followed game that's over, or gone from the board, stops leading.
  useEffect(() => {
    if (!shown) return;
    const kept = activeFollows(followedIds, shown.data);
    if (kept.length !== followedIds.length) setFollowedIds(kept);
  }, [shown, followedIds, setFollowedIds]);

  const delaySeconds = delayMs / 1000;
  const view = useMemo((): LiveScoresView | null => {
    if (!enabled) return null;
    if (unavailableReason) {
      return {
        status: "unavailable",
        reason: unavailableReason,
        waiting: false,
        followed: [],
        others: [],
        delaySeconds,
      };
    }
    if (!shown) {
      return {
        status: "ok",
        waiting: true,
        followed: [],
        others: [],
        delaySeconds,
      };
    }
    return {
      status: "ok",
      waiting: false,
      ...splitFollowed(shown.data, followedIds),
      delaySeconds,
    };
  }, [enabled, unavailableReason, shown, followedIds, delaySeconds]);

  const setView = useSetAtom(liveScoresViewAtom);
  useEffect(() => {
    setView(view);
  }, [view, setView]);
  // Gone with the screen: a scores screen opened later must not show these.
  useEffect(() => () => setView(null), [setView]);

  return { view };
};
