import { useAtomValue } from "jotai";
import { View } from "react-native";
import { ScoresRail } from "@/components/multiview/ScoresRail";
import { TVControlButton } from "@/components/tv/TVControlButton";
import { liveScoresViewAtom } from "@/utils/atoms/liveScores";

/**
 * The scores rail in the TV player's controls, for a live channel: it shows
 * and hides with the controls, so it never sits over the picture uninvited.
 * Reads what the player's useLiveScores wrote; nothing while scores are off.
 */
export function PlayerScoresRail({
  isLiveTV,
  width,
}: {
  isLiveTV: boolean;
  width: number;
}) {
  const view = useAtomValue(liveScoresViewAtom);
  if (!isLiveTV || !view) return null;
  return (
    <View testID='player-scores-rail' style={{ width, marginBottom: 12 }}>
      <ScoresRail view={view} width={width} />
    </View>
  );
}

/**
 * The TV player's Scores button, for a live channel while scores are on. It
 * opens the same scores screen as multiview's.
 */
export function PlayerScoresButton({
  isLiveTV,
  onPress,
  focusable,
  hasTVPreferredFocus,
}: {
  isLiveTV: boolean;
  onPress: () => void;
  focusable: boolean;
  hasTVPreferredFocus: boolean;
}) {
  const view = useAtomValue(liveScoresViewAtom);
  if (!isLiveTV || !view) return null;
  return (
    <View testID='player-scores-button'>
      <TVControlButton
        icon='american-football'
        onPress={onPress}
        focusable={focusable}
        hasTVPreferredFocus={hasTVPreferredFocus}
        size={24}
      />
    </View>
  );
}
