import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Text } from "@/components/common/Text";
import {
  LIVE_SCORES_RAIL_HEIGHT,
  LIVE_SCORES_RAIL_PAGE_MS,
} from "@/constants/LiveScores";
import type { LiveScoresView } from "@/utils/atoms/liveScores";
import {
  chipsPerPage,
  hasLiveGame,
  railPage,
} from "@/utils/livescores/railItems";
import { FollowedChip, GameChip } from "./RailChip";

const UNAVAILABLE_KEYS = {
  network: "livescores.unavailable_network",
  format: "livescores.unavailable_format",
  stale: "livescores.unavailable_stale",
} as const;

interface Props {
  view: LiveScoresView;
  /** The rail's width, which decides how many other games fit a page. */
  width: number;
}

/**
 * The scores strip: the followed games first, then a page of every other
 * game, turning every 8 s when they don't all fit. Shown only while a game
 * is being played. For reading only: it takes no touches and offers the
 * remote nothing to focus, so it never pulls focus away from the video.
 */
export function ScoresRail({ view, width }: Props) {
  const { t } = useTranslation();
  const perPage = chipsPerPage(width, view.followed.length);
  const pages = Math.max(1, Math.ceil(view.others.length / perPage));
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (pages <= 1) return;
    const timer = setInterval(
      () => setPage((p) => p + 1),
      LIVE_SCORES_RAIL_PAGE_MS,
    );
    return () => clearInterval(timer);
  }, [pages]);

  const unavailable = view.status === "unavailable";
  if (!unavailable && !hasLiveGame([...view.followed, ...view.others])) {
    return null;
  }

  return (
    <View
      testID='scores-rail'
      pointerEvents='none'
      focusable={false}
      style={styles.rail}
    >
      {unavailable ? (
        <Text className='text-xs text-neutral-300'>
          {t(UNAVAILABLE_KEYS[view.reason ?? "network"])}
        </Text>
      ) : (
        <>
          {view.followed.map((game) => (
            <FollowedChip key={game.id} game={game} />
          ))}
          {view.followed.length > 0 && view.others.length > 0 && (
            <View style={styles.separator} />
          )}
          {railPage(view.others, perPage, page).map((game) => (
            <GameChip key={game.id} game={game} />
          ))}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    height: LIVE_SCORES_RAIL_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 8,
    overflow: "hidden",
    // A see-through panel: on Android TV a blur only tints, so the panel
    // carries its own colour.
    backgroundColor: "rgba(18,18,20,0.72)",
    borderColor: "rgba(255,255,255,0.18)",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
  },
  separator: {
    width: StyleSheet.hairlineWidth,
    height: 18,
    backgroundColor: "rgba(255,255,255,0.25)",
    marginHorizontal: 2,
  },
});
