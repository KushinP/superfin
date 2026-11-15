import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/common/Text";
import { MultiviewColors } from "@/constants/Colors";
import { LIVE_SCORES_DELAY_DEFAULT_S } from "@/constants/LiveScores";
import type { LiveScoresView, PinnedGame } from "@/utils/atoms/liveScores";
import { useSettings } from "@/utils/atoms/settings";
import {
  clampDelaySeconds,
  stepDelaySeconds,
} from "@/utils/livescores/delayBuffer";
import type { GameLeader, GameScore } from "@/utils/livescores/espnScoreboard";
import { gameStatusText } from "./gameStatusText";
import { GameChip } from "./RailChip";
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

function YourGame({
  pinned,
  delaySeconds,
}: {
  pinned: PinnedGame;
  delaySeconds: number;
}) {
  const { t } = useTranslation();
  const { game } = pinned;
  const scores = game && game.state !== "pre";
  return (
    <View style={[styles.card, { borderLeftColor: pinned.color }]}>
      <View style={styles.scoreRow}>
        <Text className='text-base text-neutral-300 font-semibold'>
          {pinned.teams.away}
        </Text>
        {scores && (
          <Text className='text-lg text-white font-bold'>
            {String(game.away.score)}
          </Text>
        )}
        <Text className='text-base text-neutral-300 font-semibold'>
          {pinned.teams.home}
        </Text>
        {scores && (
          <Text className='text-lg text-white font-bold'>
            {String(game.home.score)}
          </Text>
        )}
        {game && (
          <Text className='text-sm text-white'>{gameStatusText(t, game)}</Text>
        )}
        {game?.down && (
          <Text className='text-sm text-neutral-300'>{game.down.text}</Text>
        )}
      </View>
      {game ? (
        detailLines(t, game).map((line) => (
          <Text key={line} className='text-sm text-neutral-300'>
            {line}
          </Text>
        ))
      ) : (
        <Text className='text-sm text-neutral-400'>
          {t("livescores.waiting", { seconds: delaySeconds })}
        </Text>
      )}
    </View>
  );
}

function PanelButton({
  label,
  onPress,
  hasTVPreferredFocus,
}: {
  label: string;
  onPress: () => void;
  hasTVPreferredFocus?: boolean;
}) {
  const { focused, onFocus, onBlur } = useFocused();
  return (
    <Pressable
      accessibilityRole='button'
      onPress={onPress}
      onFocus={onFocus}
      onBlur={onBlur}
      hasTVPreferredFocus={hasTVPreferredFocus}
      style={{
        width: BUTTON_WIDTH,
        paddingVertical: 8,
        borderRadius: 8,
        alignItems: "center",
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
 * the spoiler delay and its controls, your games in full (last play, win
 * probability, drive, timeouts, leaders), then every other game. Each
 * detail shows only when ESPN gave it, and your games wait for the delay.
 */
export function ScoresPanel({ view }: { view: LiveScoresView }) {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSettings();
  const enabled = settings.liveScoresEnabled !== false;
  const delay = clampDelaySeconds(
    settings.liveScoresDelaySeconds ?? LIVE_SCORES_DELAY_DEFAULT_S,
  );

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
      ) : (
        <>
          <View style={styles.yourGames}>
            {view.pinned.map((pinned) => (
              <YourGame
                key={pinned.tileKey}
                pinned={pinned}
                delaySeconds={view.delaySeconds}
              />
            ))}
          </View>
          {view.others.length > 0 && (
            <View style={styles.others}>
              {view.others.map((game) => (
                <GameChip key={game.id} game={game} />
              ))}
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
  yourGames: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  card: {
    flexGrow: 1,
    flexBasis: 280,
    gap: 2,
    paddingLeft: 10,
    borderLeftWidth: 3,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    marginBottom: 2,
  },
  others: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
});
