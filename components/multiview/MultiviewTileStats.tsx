import type { MediaSourceInfo } from "@jellyfin/sdk/lib/generated-client/models";
import { type RefObject, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Text } from "@/components/common/Text";
import { MULTIVIEW_STATS_INTERVAL } from "@/constants/Multiview";
import type { MpvPlayerViewRef } from "@/modules";
import type { TechnicalInfo } from "@/modules/mpv-player/src/MpvPlayer.types";
import { tileStatsRows } from "@/utils/multiview/tileStats";

interface Props {
  playerRef: RefObject<MpvPlayerViewRef | null>;
  mediaSource: MediaSourceInfo | undefined;
  qualityKey: string;
  tileOwnQuality: boolean;
}

/**
 * A tile's stats, over its top left corner: what the server sends and what
 * the player makes of it, refreshed every second while it is open.
 */
export function MultiviewTileStats({
  playerRef,
  mediaSource,
  qualityKey,
  tileOwnQuality,
}: Props) {
  const { t } = useTranslation();
  const [info, setInfo] = useState<TechnicalInfo | null>(null);

  useEffect(() => {
    let alive = true;
    const read = async () => {
      // ExoPlayer tiles have no such call; their overlay shows the server's half.
      const player = playerRef.current as
        | (MpvPlayerViewRef & {
            getTechnicalInfo?: () => Promise<TechnicalInfo>;
          })
        | null;
      if (!player?.getTechnicalInfo) return;
      try {
        const next = await player.getTechnicalInfo();
        if (alive) setInfo(next ?? null);
      } catch {
        // A player tearing down between two reads; the next read tries again.
      }
    };
    void read();
    const timer = setInterval(read, MULTIVIEW_STATS_INTERVAL);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [playerRef]);

  const rows = tileStatsRows({ qualityKey, tileOwnQuality, mediaSource, info });

  return (
    <View style={styles.panel} pointerEvents='none' testID='multiview-stats'>
      {rows.map((row) => (
        <Text key={row.label} className='text-xs text-white' numberOfLines={1}>
          <Text className='text-xs text-neutral-400'>{t(row.label)}: </Text>
          {row.translate ? t(row.value) : row.value}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: "absolute",
    top: 6,
    left: 6,
    maxWidth: "90%",
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
});
