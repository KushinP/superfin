import type {
  BaseItemDto,
  BaseItemDtoQueryResult,
} from "@jellyfin/sdk/lib/generated-client/models";
import { getLiveTvApi } from "@jellyfin/sdk/lib/utils/api";
import { useInfiniteQuery, useQueries } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ItemImage } from "@/components/common/ItemImage";
import { Text } from "@/components/common/Text";
import { HourHeader } from "@/components/livetv/HourHeader";
import { LiveTVGuideRow } from "@/components/livetv/LiveTVGuideRow";
import { ChannelRowColors, GuideColors } from "@/constants/Colors";
import {
  LIVE_TV_GUIDE_CHANNEL_WIDTH,
  LIVE_TV_GUIDE_CHANNELS_PAGE,
  LIVE_TV_GUIDE_DAYS,
  LIVE_TV_GUIDE_HEADER_HEIGHT,
  LIVE_TV_GUIDE_HOUR_WIDTH,
  LIVE_TV_GUIDE_LOAD_AHEAD,
  LIVE_TV_GUIDE_ROW_HEIGHT,
} from "@/constants/LiveTv";
import { useLiveTvClock } from "@/hooks/useLiveTvClock";
import { apiAtom, userAtom } from "@/providers/JellyfinProvider";
import {
  guideDays,
  guideHours,
  guideWindow,
  nowLineOffset,
  startOfHour,
} from "@/utils/livetv/guideLayout";
import { channelNumber } from "@/utils/livetv/nowNext";

const channelIds = (page: BaseItemDtoQueryResult | undefined) =>
  (page?.Items ?? [])
    .map((channel) => channel.Id)
    .filter((id): id is string => !!id);

// Covered by components/livetv/liveTvGuidePage.test.tsx.
export default function LiveTvGuidePage() {
  const [api] = useAtom(apiAtom);
  const [user] = useAtom(userAtom);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const now = useLiveTvClock();
  const [dayIndex, setDayIndex] = useState(0);

  // Rebuilt at midnight and on the hour, not on every tick of the clock.
  const today = new Date(now).toDateString();
  const days = useMemo(() => guideDays(now, LIVE_TV_GUIDE_DAYS), [today]);
  const day = days[dayIndex] ?? days[0];
  const hour = startOfHour(now);
  const window = useMemo(() => guideWindow(day, now), [day, hour]);
  // The programs are asked for by the whole day, not by the window: the
  // window moves on every hour, and a query keyed on it emptied every row
  // until the refetch landed. The rows cut the day to the window themselves.
  const dayStart = day.getTime();
  const dayEnd = window.end;
  const width = guideHours(window).length * LIVE_TV_GUIDE_HOUR_WIDTH;
  const nowLine = nowLineOffset(now, window, LIVE_TV_GUIDE_HOUR_WIDTH);

  const channels = useInfiniteQuery({
    queryKey: ["livetv", "guide", "channels"],
    queryFn: async ({ pageParam }) => {
      const res = await getLiveTvApi(api!).getLiveTvChannels({
        startIndex: pageParam,
        limit: LIVE_TV_GUIDE_CHANNELS_PAGE,
        enableFavoriteSorting: true,
        userId: user?.Id,
        addCurrentProgram: false,
        enableUserData: false,
        enableImageTypes: ["Primary"],
      });
      return res.data;
    },
    initialPageParam: 0,
    getNextPageParam: (last, all) =>
      (last.Items?.length ?? 0) < LIVE_TV_GUIDE_CHANNELS_PAGE
        ? undefined
        : all.length * LIVE_TV_GUIDE_CHANNELS_PAGE,
    // The page can mount before the api is restored.
    enabled: !!api,
  });
  const pages = channels.data?.pages ?? [];

  // One programs request per page of channels, so loading more channels does
  // not fetch the ones already on screen again.
  const programs = useQueries({
    queries: pages.map((page) => {
      const ids = channelIds(page);
      return {
        queryKey: ["livetv", "guide", "programs", dayStart, ids],
        queryFn: async () => {
          const res = await getLiveTvApi(api!).getPrograms({
            getProgramsDto: {
              MinEndDate: new Date(dayStart).toISOString(),
              MaxStartDate: new Date(dayEnd).toISOString(),
              ChannelIds: ids,
              ImageTypeLimit: 1,
              EnableImages: false,
              SortBy: ["StartDate"],
              EnableTotalRecordCount: false,
              EnableUserData: false,
            },
          });
          return res.data.Items ?? [];
        },
        // The channels can come back from the persisted cache before the api.
        enabled: !!api && ids.length > 0,
      };
    }),
  });

  const scrollX = useSharedValue(0);
  const onHorizontalScroll = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });
  const horizontal = useRef<ScrollViewInstance>(null);

  // Another day opens at its start, not where the last one was left.
  useEffect(() => {
    horizontal.current?.scrollTo({ x: 0, animated: false });
    scrollX.value = 0;
  }, [dayIndex]);

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = channels;
  const onVerticalScroll = useCallback(
    ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
      const left =
        contentSize.height - contentOffset.y - layoutMeasurement.height;
      if (left < LIVE_TV_GUIDE_LOAD_AHEAD && hasNextPage && !isFetchingNextPage)
        fetchNextPage();
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  );

  return (
    <View style={styles.page}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.daysBar}
        contentContainerStyle={styles.days}
      >
        {days.map((d, index) => (
          <Pressable
            key={d.getTime()}
            onPress={() => setDayIndex(index)}
            accessibilityRole='button'
            accessibilityState={{ selected: index === dayIndex }}
            style={[styles.chip, index === dayIndex && styles.chipSelected]}
          >
            <Text
              style={[
                styles.chipLabel,
                index === dayIndex && styles.chipLabelSelected,
              ]}
            >
              {index === 0
                ? t("live_tv.today")
                : d.toLocaleDateString([], {
                    weekday: "short",
                    day: "numeric",
                  })}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        nestedScrollEnabled
        // The page sits below the Live TV bar, not under the header: an
        // automatic inset opened it scrolled under the bar.
        contentInsetAdjustmentBehavior='never'
        onScroll={onVerticalScroll}
        scrollEventThrottle={100}
        testID='guide-scroll'
        contentContainerStyle={{
          paddingLeft: insets.left,
          paddingRight: insets.right,
          paddingBottom: insets.bottom + 96,
        }}
      >
        <View style={styles.grid}>
          {/* Outside the horizontal scroll, so the channels stay put. */}
          <View style={styles.channels}>
            <View style={styles.corner} />
            {pages.flatMap((page) =>
              (page.Items ?? []).map((channel) => (
                <ChannelTile key={channel.Id} channel={channel} />
              )),
            )}
          </View>
          <Animated.ScrollView
            ref={horizontal as never}
            horizontal
            showsHorizontalScrollIndicator={false}
            onScroll={onHorizontalScroll}
            scrollEventThrottle={16}
          >
            <View style={{ width }}>
              <HourHeader window={window} />
              {pages.map((page, index) =>
                (page.Items ?? []).map((channel) => (
                  <LiveTVGuideRow
                    key={channel.Id}
                    channel={channel}
                    programs={programs[index]?.data}
                    window={window}
                    now={now}
                    scrollX={scrollX}
                  />
                )),
              )}
              {nowLine !== null && (
                <View
                  testID='guide-now-line'
                  pointerEvents='none'
                  style={[styles.nowLine, { left: nowLine }]}
                />
              )}
            </View>
          </Animated.ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

const ChannelTile = ({ channel }: { channel: BaseItemDto }) => {
  const number = channelNumber(channel);
  return (
    <View style={styles.channel}>
      <View style={styles.logo}>
        <ItemImage
          item={channel}
          style={styles.logoImage}
          contentFit='contain'
        />
      </View>
      {number && <Text style={styles.number}>{number}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1 },
  // A ScrollView shrinks by default; this one keeps the height of its chips.
  daysBar: { flexGrow: 0, flexShrink: 0 },
  days: { gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  chip: {
    paddingHorizontal: 12,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
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
  grid: { flexDirection: "row" },
  channels: { width: LIVE_TV_GUIDE_CHANNEL_WIDTH },
  corner: {
    height: LIVE_TV_GUIDE_HEADER_HEIGHT,
    backgroundColor: GuideColors.header,
  },
  channel: {
    height: LIVE_TV_GUIDE_ROW_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  logo: {
    width: 48,
    height: 36,
    borderRadius: 8,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ChannelRowColors.tile,
  },
  logoImage: { width: 40, height: 30 },
  number: {
    fontSize: 10,
    color: GuideColors.time,
    fontVariant: ["tabular-nums"],
  },
  nowLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    borderRadius: 1,
    backgroundColor: GuideColors.nowLine,
  },
});
