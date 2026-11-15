import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LIVE_SCORES_DELAY_DEFAULT_S,
  LIVE_SCORES_POLL_IDLE_MS,
  LIVE_SCORES_POLL_LIVE_MS,
  LIVE_SCORES_SCOREBOARD_URL,
  LIVE_SCORES_STALE_MS,
} from "@/constants/LiveScores";
import { useChannelsNow } from "@/hooks/useChannelsNow";
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
  looksLikeFootball,
  type MatchResult,
  matchGame,
} from "@/utils/livescores/matchGame";
import { writeDebugLog } from "@/utils/log";

/** A multiview tile, as far as scores care: its key and what it plays. */
export interface LiveScoreTile {
  key: string;
  /** For a live TV tile, the channel's id. */
  itemId: string;
}

export type TileScore =
  | { kind: "game"; game: GameScore; via: MatchResult["via"] }
  | { kind: "unavailable"; reason: "network" | "format" | "stale" };

/** ESPN answered with something parseScoreboard does not recognise. */
class ScoreboardFormatError extends Error {
  override name = "ScoreboardFormatError";
}

// Every failure is marked expected: ESPN's feed is unofficial, so it being
// down or changed is a known outcome the bug handles by hiding, not an app
// bug for Sentry, and on a 15 s poll it would be a flood.
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

const NO_CHANNELS: string[] = [];

/**
 * Live NFL scores for the multiview's tiles: one shared ESPN poll however
 * many tiles show games, held back by the spoiler delay. A tile gets a game
 * once its guide listing matches one and the first fetch is a delay old,
 * "unavailable" when scores cannot be trusted, and nothing otherwise.
 * Nothing is fetched while the setting is off or no tile shows football.
 */
export const useLiveScores = (tiles: LiveScoreTile[]) => {
  const { settings } = useSettings();
  const enabled = settings.liveScoresEnabled !== false;
  const delayMs =
    clampDelaySeconds(
      settings.liveScoresDelaySeconds ?? LIVE_SCORES_DELAY_DEFAULT_S,
    ) * 1000;

  // The screen hands a new array every render; key on what is in it.
  const tilesKey = tiles.map((t) => `${t.key}=${t.itemId}`).join("|");
  const stableTiles = useMemo(() => tiles, [tilesKey]);
  const channelIds = useMemo(
    () =>
      enabled ? [...new Set(stableTiles.map((t) => t.itemId))] : NO_CHANNELS,
    [enabled, stableTiles],
  );
  const programs = useChannelsNow(channelIds);

  const footballTiles = useMemo(
    () =>
      enabled
        ? stableTiles.filter((t) => looksLikeFootball(programs.get(t.itemId)))
        : [],
    [enabled, stableTiles, programs],
  );

  // Read by refetchInterval, which runs outside render.
  const programsRef = useRef(programs);
  programsRef.current = programs;
  const footballRef = useRef(footballTiles);
  footballRef.current = footballTiles;

  const query = useQuery({
    queryKey: ["livescores", "nfl", "scoreboard"],
    queryFn: ({ signal }) => fetchScoreboard(signal),
    enabled: footballTiles.length > 0,
    // Never written to the disk cache: old scores on the next launch would
    // only mislead.
    gcTime: 0,
    retry: 1,
    // Fast while a game on screen is in play, judged on the newest fetch,
    // not the delayed one, or the first half minute of a game would poll
    // slowly.
    refetchInterval: (q) => {
      const games = q.state.data;
      const live = footballRef.current.some((tile) => {
        const match = games
          ? matchGame({ program: programsRef.current.get(tile.itemId), games })
          : null;
        return games?.find((g) => g.id === match?.gameId)?.state === "in";
      });
      return live ? LIVE_SCORES_POLL_LIVE_MS : LIVE_SCORES_POLL_IDLE_MS;
    },
  });

  const [buffer, setBuffer] = useState<Snapshot<GameScore[]>[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!query.data || !query.dataUpdatedAt) return;
    const fetched = { fetchedAt: query.dataUpdatedAt, data: query.data };
    setBuffer((b) => addSnapshot(b, fetched, Date.now(), delayMs));
    setNow(Date.now());
  }, [query.data, query.dataUpdatedAt, delayMs]);

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
  // Any doubt about the data hides every bug (A8): a failed or unreadable
  // fetch, or a newest fetch too old to trust.
  type Reason = Extract<TileScore, { kind: "unavailable" }>["reason"];
  const unavailableReason: Reason | null = query.isError
    ? query.error instanceof ScoreboardFormatError
      ? "format"
      : "network"
    : latest && now - latest.fetchedAt > LIVE_SCORES_STALE_MS
      ? "stale"
      : null;
  const shown = delayedSnapshot(buffer, now, delayMs);

  // Each tile's game, kept from one render to the next so a game that
  // overruns its guide slot stays on its tile (see matchGame).
  const stickyRef = useRef(new Map<string, string>());
  const matches = useMemo(() => {
    const found = new Map<string, MatchResult>();
    if (!shown) return found;
    for (const tile of footballTiles) {
      const match = matchGame({
        program: programs.get(tile.itemId),
        games: shown.data,
        previous: stickyRef.current.get(tile.key),
      });
      if (match) found.set(tile.key, match);
    }
    return found;
  }, [shown, footballTiles, programs]);

  useEffect(() => {
    for (const [key, match] of matches) {
      if (stickyRef.current.get(key) !== match.gameId) {
        const program: BaseItemDto | undefined = programs.get(
          footballTiles.find((t) => t.key === key)?.itemId ?? "",
        );
        // So a wrong game on a tile can be traced to the listing that led
        // to it.
        writeDebugLog("Live scores: matched a tile to a game", {
          tile: key,
          game: match.gameId,
          via: match.via,
          title: [program?.Name, program?.EpisodeTitle].filter(Boolean),
        });
      }
    }
    stickyRef.current = new Map(
      [...matches].map(([key, match]) => [key, match.gameId]),
    );
  }, [matches, programs, footballTiles]);

  const byTile = useMemo(() => {
    const result = new Map<string, TileScore>();
    for (const tile of footballTiles) {
      if (unavailableReason) {
        result.set(tile.key, {
          kind: "unavailable",
          reason: unavailableReason,
        });
        continue;
      }
      const match = matches.get(tile.key);
      const game = shown?.data.find((g) => g.id === match?.gameId);
      if (match && game) {
        result.set(tile.key, { kind: "game", game, via: match.via });
      }
    }
    return result;
  }, [footballTiles, unavailableReason, matches, shown]);

  return { tiles: byTile, games: shown?.data ?? [] };
};
