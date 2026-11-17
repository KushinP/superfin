import { Ionicons } from "@expo/vector-icons";
import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { getLiveTvApi } from "@jellyfin/sdk/lib/utils/api";
import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/common/Text";
import { ChannelNowNextRow } from "@/components/livetv/ChannelNowNextRow";
import { ChannelRowColors, Colors } from "@/constants/Colors";
import {
  LIVE_TV_CHANNELS_LIMIT,
  LIVE_TV_NOW_NEXT_STALE_MS,
} from "@/constants/LiveTv";
import useRouter from "@/hooks/useAppRouter";
import { useChannelsNowNext } from "@/hooks/useChannelsNowNext";
import { usePlayMedia } from "@/hooks/usePlayMedia";
import { apiAtom, userAtom } from "@/providers/JellyfinProvider";
import { isMultiviewAvailable } from "@/utils/multiview/availability";

type Filter = "all" | "favorites";

export default function LiveTvChannelsPage() {
  const [api] = useAtom(apiAtom);
  const [user] = useAtom(userAtom);
  const { t } = useTranslation();
  const router = useRouter();
  const playMedia = usePlayMedia();
  const [filter, setFilter] = useState<Filter>("all");

  const { data: channels } = useQuery({
    queryKey: ["livetv", "channels"],
    queryFn: async () => {
      const res = await getLiveTvApi(api!).getLiveTvChannels({
        startIndex: 0,
        limit: LIVE_TV_CHANNELS_LIMIT,
        enableFavoriteSorting: true,
        userId: user?.Id,
        // The program on now comes with each channel; next is asked for below.
        addCurrentProgram: true,
        enableUserData: true,
        enableImageTypes: ["Primary"],
      });
      return res.data;
    },
    // What is on now changes; keep it in step with the next programs.
    refetchInterval: LIVE_TV_NOW_NEXT_STALE_MS,
  });

  const all = channels?.Items ?? [];
  const favorites = useMemo(
    () => all.filter((channel) => channel.UserData?.IsFavorite),
    [all],
  );
  const shown = filter === "favorites" ? favorites : all;
  const ids = useMemo(
    () => all.map((channel) => channel.Id).filter((id): id is string => !!id),
    [all],
  );
  const { next, now } = useChannelsNowNext(ids);

  const play = useCallback(
    (channel: BaseItemDto) => {
      if (!channel.Id) return;
      playMedia({ itemId: channel.Id, offline: false }, { item: channel });
    },
    [playMedia],
  );

  const showMultiview = isMultiviewAvailable(Platform);

  return (
    <View className='flex flex-1'>
      {/* Above the list, not its header: FlashList keeps its first row in
          view when a header gets its height after the first layout, which
          opened the page with the chips scrolled off. */}
      <View style={styles.toolbar}>
        <FilterChip
          label={t("live_tv.filter_all")}
          selected={filter === "all"}
          onPress={() => setFilter("all")}
        />
        {favorites.length > 0 && (
          <FilterChip
            label={t("live_tv.filter_favorites")}
            selected={filter === "favorites"}
            onPress={() => setFilter("favorites")}
          />
        )}
        {/* Multiview renders several MPV players at once, which only the
            iOS player allows; see isMultiviewAvailable. */}
        {showMultiview && (
          <Pressable
            onPress={() => router.push("/multiview")}
            accessibilityRole='button'
            accessibilityLabel={t("multiview.open")}
            style={[styles.chip, styles.multiview]}
          >
            <Ionicons name='grid' size={13} color={Colors.primaryLight} />
            <Text style={styles.chipLabel}>{t("multiview.chip")}</Text>
          </Pressable>
        )}
      </View>
      <FlashList
        data={shown}
        keyExtractor={(channel) => channel.Id ?? ""}
        extraData={{ next, now }}
        renderItem={({ item }) => (
          <ChannelNowNextRow
            channel={item}
            next={item.Id ? next.get(item.Id) : undefined}
            now={now}
            onPress={play}
          />
        )}
      />
    </View>
  );
}

const FilterChip = ({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole='button'
    accessibilityState={{ selected }}
    style={[styles.chip, selected && styles.chipSelected]}
  >
    <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
      {label}
    </Text>
  </Pressable>
);

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    height: 30,
    borderRadius: 15,
    backgroundColor: ChannelRowColors.tile,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ChannelRowColors.tileEdge,
  },
  chipSelected: {
    backgroundColor: ChannelRowColors.selectedChip,
    borderColor: ChannelRowColors.selectedChip,
  },
  chipLabel: { fontSize: 13, fontWeight: "600" },
  chipLabelSelected: { color: ChannelRowColors.selectedChipText },
  multiview: { marginLeft: "auto" },
});
