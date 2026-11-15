import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { LIVE_SCORES_KICKOFF_GRACE_MS } from "@/constants/LiveScores";
import type { GameScore } from "./espnScoreboard";
import { NFL_TEAMS } from "./nflTeams";

/**
 * The guide fields matching reads. IsSports is carried but not trusted on
 * its own: baseball's Cardinals and Giants are sports too.
 */
export type ProgramInfo = Pick<
  BaseItemDto,
  "Name" | "EpisodeTitle" | "Overview" | "IsSports" | "StartDate" | "EndDate"
>;

export interface MatchResult {
  gameId: string;
  /** Why, for the debug log Kush reads when a tile shows the wrong game. */
  via: "title" | "overview" | "network" | "sticky";
}

export interface MatchInput {
  program: ProgramInfo | null | undefined;
  games: readonly GameScore[];
  /** The channel's network from Kush's own mapping, if he set one. */
  network?: string | null;
  /** The game this tile showed last time, kept while it is still on. */
  previous?: string | null;
}

const FOOTBALL = /\b(nfl|football)\b/i;

const escapeRegExp = (word: string) =>
  word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordIn = (text: string, word: string) =>
  new RegExp(`\\b${escapeRegExp(word)}\\b`, "i").test(text);

/** The teams a piece of guide text names, by abbreviation. */
const teamsNamed = (text: string, games: readonly GameScore[]): Set<string> => {
  const named = new Set<string>();
  if (!text) return named;
  for (const team of NFL_TEAMS) {
    if (team.names.some((name) => wordIn(text, name))) named.add(team.abbr);
  }
  // The board's own nicknames too, in case ESPN renames a team before the
  // list above catches up.
  for (const game of games) {
    for (const team of [game.home, game.away]) {
      if (wordIn(text, team.nickname)) named.add(team.abbr);
    }
  }
  return named;
};

const time = (iso: string | null | undefined) => {
  const ms = iso ? Date.parse(iso) : Number.NaN;
  return Number.isNaN(ms) ? null : ms;
};

/** Kickoff falls in the program's slot (a pregame show's slot included). */
const inSlot = (program: ProgramInfo, game: GameScore) => {
  const start = time(program.StartDate);
  const end = time(program.EndDate);
  const kickoff = time(game.start);
  if (start === null || end === null || kickoff === null) return true;
  return kickoff >= start - LIVE_SCORES_KICKOFF_GRACE_MS && kickoff < end;
};

/** No network known on either side is no disagreement. */
const onNetwork = (game: GameScore, network: string | null | undefined) =>
  !network ||
  game.networks.length === 0 ||
  game.networks.some((n) => n.toLowerCase() === network.toLowerCase());

/**
 * The one game the named teams point at. Null when they point at none, at
 * more than one, or name a team outside that game.
 */
const gameNamed = (
  named: Set<string>,
  games: readonly GameScore[],
): GameScore | null => {
  const hits = games.filter(
    (g) => named.has(g.home.abbr) || named.has(g.away.abbr),
  );
  if (hits.length !== 1) return null;
  const [game] = hits;
  for (const abbr of named) {
    if (abbr !== game.home.abbr && abbr !== game.away.abbr) return null;
  }
  return game;
};

const titleOf = (program: ProgramInfo) =>
  `${program.Name ?? ""} ${program.EpisodeTitle ?? ""}`;

/**
 * The listing says it is football. Only this gates polling ESPN at all, so a
 * Tuesday of news and movies costs no request.
 */
export const looksLikeFootball = (
  program: ProgramInfo | null | undefined,
): program is ProgramInfo => !!program && FOOTBALL.test(titleOf(program));

const freshMatch = ({
  program,
  games,
  network,
}: MatchInput): MatchResult | null => {
  if (!looksLikeFootball(program)) return null;
  const fits = (g: GameScore) => inSlot(program, g) && onNetwork(g, network);

  // The title first: an overview often recaps last week's opponent, so it
  // is only read when the title names no team at all.
  const tiers = [
    ["title", titleOf(program)],
    ["overview", program.Overview ?? ""],
  ] as const;
  for (const [via, text] of tiers) {
    const named = teamsNamed(text, games);
    if (named.size === 0) continue;
    // Teams named but no single fitting game: refuse, rather than fall back
    // on the network and show a game the listing did not name.
    const game = gameNamed(named, games);
    return game && fits(game) ? { gameId: game.id, via } : null;
  }

  if (!network) return null;
  const onAir = games.filter(fits);
  return onAir.length === 1 ? { gameId: onAir[0].id, via: "network" } : null;
};

/**
 * The game a live TV tile is showing, from its guide program, or null when
 * that is not certain. A wrong score is worse than none, so any doubt is a
 * null. Once matched, a tile keeps its game while it is still being played,
 * since a game that overruns its slot is still on air after the guide has
 * moved to the next listing.
 */
export const matchGame = (input: MatchInput): MatchResult | null => {
  const previous = input.games.find((g) => g.id === input.previous);
  if (previous) {
    if (previous.state !== "post") {
      return { gameId: previous.id, via: "sticky" };
    }
    // A final stays up until the guide moves on from that game.
    const named = input.program
      ? teamsNamed(titleOf(input.program), [previous])
      : new Set<string>();
    if (named.has(previous.home.abbr) || named.has(previous.away.abbr)) {
      return { gameId: previous.id, via: "sticky" };
    }
  }
  return freshMatch(input);
};
