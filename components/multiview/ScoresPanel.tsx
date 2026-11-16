import type { TFunction } from "i18next";
import { useAtom } from "jotai";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/common/Text";
import { MultiviewColors } from "@/constants/Colors";
import {
  LIVE_SCORES_DELAY_DEFAULT_S,
  LIVE_SCORES_MAX_FOLLOWED,
} from "@/constants/LiveScores";
import {
  followedGameIdsAtom,
  type LiveScoresView,
} from "@/utils/atoms/liveScores";
import { useSettings } from "@/utils/atoms/settings";
import {
  clampDelaySeconds,
  stepDelaySeconds,
} from "@/utils/livescores/delayBuffer";
import type { GameLeader, GameScore } from "@/utils/livescores/espnScoreboard";
import { toggleFollow } from "@/utils/livescores/railItems";
import { writeDebugLog } from "@/utils/log";
import { gameStatusText } from "./gameStatusText";
import { FollowedChip, GameChip } from "./RailChip";
import { useFocused } from "./useFocused";

const UNAVAILABLE_KEYS = {
  network: "livescores.unavailable_network",
  format: "livescores.unavailable_format",
  stale: "livescores.unavailable_stale",
} as const;

const LEADER_KEYS = {
  passing: "livescores.leader_passing",
  rushing: "livescores.leader_rushing",
  receiving: "livescores.leader_receiving",
} as const;

/**
 * Buttons side by side are one size: uneven neighbours read as a rendering
 * bug on a TV across a room (docs/conventions/tv.md).
 */
const BUTTON_WIDTH = Platform.isTV ? 220 : 150;

const percent = (share: number) => Math.round(share * 100);

const leaderLine = (t: TFunction, leader: GameLeader) =>
  t(LEADER_KEYS[leader.category], {
    name: leader.teamAbbr ? `${leader.name} (${leader.teamAbbr})` : leader.name,
    line: leader.line,
  });

/** The lines under a game's score, each only when ESPN gave it. */
const detailLines = (t: TFunction, game: GameScore): string[] => {
  const d = game.details;
  const lines: string[] = [];
  if (d.lastPlay) lines.push(t("livescores.last_play", { text: d.lastPlay }));
  if (d.winProbability) {
    lines.push(
      t("livescores.win_probability", {
        away: game.away.abbr,
        awayPct: percent(d.winProbability.away),
        home: game.home.abbr,
        homePct: percent(d.winProbability.home),
      }),
    );
  }
  if (d.drive) lines.push(t("livescores.drive", { drive: d.drive }));
  if (d.timeouts) {
    lines.push(
      t("livescores.timeouts", {
        away: game.away.abbr,
        awayCount: d.timeouts.away,
        home: game.home.abbr,
        homeCount: d.timeouts.home,
      }),
    );
  }
  for (const leader of d.leaders ?? []) lines.push(leaderLine(t, leader));
  return lines;
};

/** A game in full: score, clock, down, then each detail ESPN gave. */
function GameDetails({ game }: { game: GameScore }) {
  const { t } = useTranslation();
  const scores = game.state !== "pre";
  return (
    <>
      <View style={styles.scoreRow}>
        <Text className='text-base text-neutral-300 font-semibold'>
          {game.away.abbr}
        </Text>
        {scores && (
          <Text className='text-lg text-white font-bold'>
            {String(game.away.score)}
          </Text>
        )}
        <Text className='text-base text-neutral-300 font-semibold'>
          {game.home.abbr}
        </Text>
        {scores && (
          <Text className='text-lg text-white font-bold'>
            {String(game.home.score)}
          </Text>
        )}
        <Text className='text-sm text-white'>{gameStatusText(t, game)}</Text>
        {game.down && (
          <Text className='text-sm text-neutral-300'>{game.down.text}</Text>
        )}
      </View>
      {detailLines(t, game).map((line) => (
        <Text key={line} className='text-sm text-neutral-300'>
          {line}
        </Text>
      ))}
    </>
  );
}

/**
 * A game in the list that opens its details when selected. Its focus shows
 * as a white outline: the chip's light text would vanish on solid white.
 */
function SelectableGame({
  game,
  selected,
  onSelect,
  children,
}: {
  game: GameScore;
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  const { focused, onFocus, onBlur } = useFocused();
  return (
    <Pressable
      testID={`select-${game.id}`}
      accessibilityRole='togglebutton'
      accessibilityState={{ expanded: selected }}
      onPress={onSelect}
      onFocus={onFocus}
      onBlur={onBlur}
      style={[
        styles.selectable,
        selected && styles.selected,
        focused && styles.focusedGame,
      ]}
    >
      {children}
    </Pressable>
  );
}

function PanelButton({
  label,
  onPress,
  hasTVPreferredFocus,
  disabled,
}: {
  label: string;
  onPress: () => void;
  hasTVPreferredFocus?: boolean;
  disabled?: boolean;
}) {
  const { focused, onFocus, onBlur } = useFocused();
  return (
    <Pressable
      accessibilityRole='button'
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      onFocus={onFocus}
      onBlur={onBlur}
      hasTVPreferredFocus={hasTVPreferredFocus}
      style={{
        width: BUTTON_WIDTH,
        paddingVertical: 8,
        borderRadius: 8,
        alignItems: "center",
        opacity: disabled ? 0.5 : 1,
        // Focused, solid white like multiview's toolbar buttons.
        backgroundColor: focused
          ? MultiviewColors.focusRing
          : "rgba(255,255,255,0.12)",
      }}
    >
      <Text
        className={focused ? "text-sm text-black" : "text-sm text-white"}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * The scores screen's content, the same on a phone sheet and the TV panel:
 * the spoiler delay and its controls, the followed games, every other game,
 * and the selected game in full (last play, win probability, drive,
 * timeouts, leaders) with Follow or Unfollow. The first followed game is
 * selected until another is. Every game waits for the delay.
 *
 * The one Follow / Unfollow button stays put while its label changes, so
 * the TV focus isn't lost: a button that vanished under it would leave
 * Android TV with nothing focused.
 */
export function ScoresPanel({ view }: { view: LiveScoresView }) {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSettings();
  const enabled = settings.liveScoresEnabled !== false;
  const delay = clampDelaySeconds(
    settings.liveScoresDelaySeconds ?? LIVE_SCORES_DELAY_DEFAULT_S,
  );
  const [followedIds, setFollowedIds] = useAtom(followedGameIdsAtom);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const games = [...view.followed, ...view.others];
  const selected =
    games.find((g) => g.id === selectedId) ?? view.followed[0] ?? null;
  const isFollowed = !!selected && followedIds.includes(selected.id);
  const atLimit = !isFollowed && followedIds.length >= LIVE_SCORES_MAX_FOLLOWED;

  const toggle = (game: GameScore) => {
    const next = toggleFollow(followedIds, game.id);
    setFollowedIds(next);
    // Keep it selected, so its button keeps the focus.
    setSelectedId(game.id);
    writeDebugLog("Live scores: follows changed", {
      game: game.id,
      followed: next,
    });
  };

  return (
    <View style={styles.panel}>
      <View style={styles.controls}>
        <Text className='text-sm text-neutral-300' style={styles.status}>
          {t("livescores.delay_status", { seconds: delay })}
        </Text>
        <PanelButton
          label={t("livescores.delay_more")}
          onPress={() =>
            updateSettings({
              liveScoresDelaySeconds: stepDelaySeconds(delay, 1),
            })
          }
          hasTVPreferredFocus
        />
        <PanelButton
          label={t("livescores.delay_less")}
          onPress={() =>
            updateSettings({
              liveScoresDelaySeconds: stepDelaySeconds(delay, -1),
            })
          }
        />
        <PanelButton
          label={enabled ? t("livescores.turn_off") : t("livescores.turn_on")}
          onPress={() => updateSettings({ liveScoresEnabled: !enabled })}
        />
      </View>

      {view.status === "unavailable" ? (
        <Text className='text-sm text-neutral-300'>
          {t(UNAVAILABLE_KEYS[view.reason ?? "network"])}
        </Text>
      ) : view.waiting ? (
        <Text className='text-sm text-neutral-400'>
          {t("livescores.waiting", { seconds: view.delaySeconds })}
        </Text>
      ) : (
        <>
          {view.followed.length > 0 && (
            <View style={styles.games}>
              {view.followed.map((game) => (
                <SelectableGame
                  key={game.id}
                  game={game}
                  selected={selected?.id === game.id}
                  onSelect={() => setSelectedId(game.id)}
                >
                  <FollowedChip game={game} />
                </SelectableGame>
              ))}
            </View>
          )}
          {view.others.length > 0 && (
            <View style={styles.games}>
              {view.others.map((game) => (
                <SelectableGame
                  key={game.id}
                  game={game}
                  selected={selected?.id === game.id}
                  onSelect={() => setSelectedId(game.id)}
                >
                  <GameChip game={game} />
                </SelectableGame>
              ))}
            </View>
          )}
          {selected && (
            <View testID={`details-${selected.id}`} style={styles.card}>
              <GameDetails game={selected} />
              <View style={styles.followRow}>
                <PanelButton
                  label={
                    isFollowed
                      ? t("livescores.unfollow")
                      : t("livescores.follow")
                  }
                  onPress={() => toggle(selected)}
                  disabled={atLimit}
                />
                {atLimit && (
                  <Text className='text-sm text-neutral-400'>
                    {t("livescores.follow_limit")}
                  </Text>
                )}
              </View>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 12,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  status: {
    flexGrow: 1,
  },
  games: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  selectable: {
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "transparent",
  },
  selected: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  focusedGame: {
    borderColor: MultiviewColors.focusRing,
  },
  card: {
    gap: 2,
    paddingLeft: 10,
    borderLeftWidth: 3,
    borderLeftColor: "rgba(255,255,255,0.6)",
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    marginBottom: 2,
  },
  followRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
});
