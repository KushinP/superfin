/**
 * Every NFL team by ESPN's abbreviation, with the words a guide listing uses
 * for it. Kept here, not only read off the scoreboard, so a team that is not
 * playing today is still recognised: an overview that mentions one is about
 * more than one game, and we refuse to guess from it.
 *
 * Nicknames only. A city alone never counts: "New York" and "Los Angeles" are
 * two teams each.
 */
export const NFL_TEAMS: readonly { abbr: string; names: readonly string[] }[] =
  [
    { abbr: "ARI", names: ["Cardinals"] },
    { abbr: "ATL", names: ["Falcons"] },
    { abbr: "BAL", names: ["Ravens"] },
    { abbr: "BUF", names: ["Bills"] },
    { abbr: "CAR", names: ["Panthers"] },
    { abbr: "CHI", names: ["Bears"] },
    { abbr: "CIN", names: ["Bengals"] },
    { abbr: "CLE", names: ["Browns"] },
    { abbr: "DAL", names: ["Cowboys"] },
    { abbr: "DEN", names: ["Broncos"] },
    { abbr: "DET", names: ["Lions"] },
    { abbr: "GB", names: ["Packers"] },
    { abbr: "HOU", names: ["Texans"] },
    { abbr: "IND", names: ["Colts"] },
    { abbr: "JAX", names: ["Jaguars", "Jags"] },
    { abbr: "KC", names: ["Chiefs"] },
    { abbr: "LV", names: ["Raiders"] },
    { abbr: "LAC", names: ["Chargers"] },
    { abbr: "LAR", names: ["Rams"] },
    { abbr: "MIA", names: ["Dolphins"] },
    { abbr: "MIN", names: ["Vikings"] },
    { abbr: "NE", names: ["Patriots", "Pats"] },
    { abbr: "NO", names: ["Saints"] },
    { abbr: "NYG", names: ["Giants"] },
    { abbr: "NYJ", names: ["Jets"] },
    { abbr: "PHI", names: ["Eagles"] },
    { abbr: "PIT", names: ["Steelers"] },
    { abbr: "SF", names: ["49ers", "Niners"] },
    { abbr: "SEA", names: ["Seahawks"] },
    { abbr: "TB", names: ["Buccaneers", "Bucs"] },
    { abbr: "TEN", names: ["Titans"] },
    { abbr: "WSH", names: ["Commanders"] },
  ];
