export type GameState = "pre" | "in" | "post";

export interface TeamScore {
  id: string;
  abbr: string;
  score: number;
  /** "Chiefs": the word guide titles use most, and unique in the NFL. */
  nickname: string;
  /** "Kansas City": never enough on its own ("New York" is two teams). */
  location: string;
  displayName: string;
}

export interface GameDown {
  /** ESPN's own short text, "2nd & 9" or "1st & Goal". */
  text: string;
  /** The team with the ball; missing on some kickoffs. */
  possessionAbbr?: string;
  redZone: boolean;
}

/** One NFL game as the score bug needs it, from one scoreboard fetch. */
export interface GameScore {
  id: string;
  /** Scheduled kickoff, ISO. */
  start: string;
  state: GameState;
  /** ESPN's status name, such as STATUS_HALFTIME. */
  statusName: string;
  /** ESPN's short status line, "14:55 - 3rd" or "11/15 - 4:05 PM EST". */
  detail: string;
  period: number;
  clock: string;
  home: TeamScore;
  away: TeamScore;
  /** Only while the ball is live: at halftime ESPN still sends the old down. */
  down?: GameDown;
  /** Networks carrying it, "CBS" or "Fox". */
  networks: string[];
}

const STATES: readonly string[] = ["pre", "in", "post"];

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** A score arrives as a string ("14"); anything else is not a score. */
const score = (v: unknown): number | null => {
  if (typeof v !== "string" || !/^\d+$/.test(v)) return null;
  return Number(v);
};

const team = (competitor: unknown): (TeamScore & { side: string }) | null => {
  if (!isObject(competitor) || !isObject(competitor.team)) return null;
  const t = competitor.team;
  const fields = {
    side: str(competitor.homeAway),
    id: str(t.id),
    abbr: str(t.abbreviation),
    score: score(competitor.score),
    nickname: str(t.name),
    location: str(t.location),
    displayName: str(t.displayName),
  };
  if (Object.values(fields).some((v) => v === null)) return null;
  return fields as TeamScore & { side: string };
};

const strip = ({ side: _side, ...rest }: TeamScore & { side: string }) => rest;

const down = (
  situation: unknown,
  statusName: string,
  teams: TeamScore[],
): GameDown | undefined => {
  // Only while the ball is live: halftime and quarter breaks keep the last
  // down in the feed, which would read as a play about to happen.
  if (statusName !== "STATUS_IN_PROGRESS" || !isObject(situation)) {
    return undefined;
  }
  const text = str(situation.shortDownDistanceText);
  if (!text) return undefined;
  const possession = str(situation.possession);
  const possessionAbbr = teams.find((t) => t.id === possession)?.abbr;
  return {
    text,
    ...(possessionAbbr ? { possessionAbbr } : {}),
    redZone: situation.isRedZone === true,
  };
};

const game = (event: unknown): GameScore | null => {
  if (!isObject(event) || !isObject(event.status)) return null;
  const status = event.status;
  if (!isObject(status.type)) return null;
  const state = str(status.type.state);
  const statusName = str(status.type.name);
  const detail = str(status.type.shortDetail);
  const period = num(status.period);
  const clock = str(status.displayClock);
  const id = str(event.id);
  const start = str(event.date);
  if (
    !state ||
    !STATES.includes(state) ||
    !statusName ||
    detail === null ||
    period === null ||
    clock === null ||
    !id ||
    !start
  ) {
    return null;
  }

  const competition = Array.isArray(event.competitions)
    ? event.competitions[0]
    : null;
  if (!isObject(competition) || !Array.isArray(competition.competitors)) {
    return null;
  }
  const teams = competition.competitors.map(team);
  const home = teams.find((t) => t?.side === "home");
  const away = teams.find((t) => t?.side === "away");
  if (teams.length !== 2 || !home || !away) return null;

  const networks = Array.isArray(competition.broadcasts)
    ? competition.broadcasts.flatMap((b) =>
        isObject(b) && Array.isArray(b.names)
          ? b.names.filter((n): n is string => typeof n === "string")
          : [],
      )
    : [];

  const gameDown = down(competition.situation, statusName, [home, away]);
  return {
    id,
    start,
    state: state as GameState,
    statusName,
    detail,
    period,
    clock,
    home: strip(home),
    away: strip(away),
    ...(gameDown ? { down: gameDown } : {}),
    networks,
  };
};

/**
 * Every game on ESPN's NFL scoreboard, or null when the feed is not what we
 * know. All or nothing: one unreadable game means the format changed, and a
 * half-read board could put a wrong score on screen.
 */
export const parseScoreboard = (raw: unknown): GameScore[] | null => {
  if (!isObject(raw) || !Array.isArray(raw.events)) return null;
  const games: GameScore[] = [];
  for (const event of raw.events) {
    const parsed = game(event);
    if (!parsed) return null;
    games.push(parsed);
  }
  return games;
};
