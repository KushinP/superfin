import { Ionicons } from "@expo/vector-icons";
import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { getLibraryApi, getLiveTvApi } from "@jellyfin/sdk/lib/utils/api";
import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Input } from "@/components/common/Input";
import { ItemImage } from "@/components/common/ItemImage";
import { Text } from "@/components/common/Text";
import { Loader } from "@/components/Loader";
import { MultiviewColors } from "@/constants/Colors";
import {
  MULTIVIEW_PICKER_WIDTH,
  MULTIVIEW_RESUME_LIMIT,
  MULTIVIEW_SEARCH_DEBOUNCE,
  MULTIVIEW_SEARCH_LIMIT,
} from "@/constants/Multiview";
import { apiAtom, userAtom } from "@/utils/atoms/api";
import {
  filterChannels,
  type MultiviewPickerTab,
} from "@/utils/multiview/picker";
import { useFocused } from "./useFocused";

interface Props {
  visible: boolean;
  /** Item ids already on screen; shown but not pickable. */
  onScreen: string[];
  onPick: (itemId: string) => void;
  onClose: () => void;
}

const TAB_LABEL_KEYS: Record<MultiviewPickerTab, string> = {
  tv: "live_tv.title",
  media: "multiview.tab_media",
};

/**
 * What can go in a tile, on two tabs: the live channels, with what is on now,
 * and the library, which starts on what the user is part way through. One
 * search box serves both; it filters the channels in place and searches the
 * server for movies and episodes. Tuner limits are the server's to enforce; a
 * third live channel on a dual tuner fails in its tile with the server's
 * answer.
 */
export function MultiviewPicker({ visible, onScreen, onPick, onClose }: Props) {
  const { t } = useTranslation();
  const api = useAtomValue(apiAtom);
  const user = useAtomValue(userAtom);
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<MultiviewPickerTab>("tv");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const trimmedQuery = query.trim();

  useEffect(() => {
    const timeout = setTimeout(
      () => setDebouncedQuery(trimmedQuery),
      MULTIVIEW_SEARCH_DEBOUNCE,
    );
    return () => clearTimeout(timeout);
  }, [trimmedQuery]);

  // Each opening starts a fresh search; the tab stays where it was left.
  useEffect(() => {
    if (!visible) setQuery("");
  }, [visible]);

  const channels = useQuery({
    queryKey: ["multiview", "channels", user?.Id],
    enabled: visible && !!api && !!user?.Id,
    queryFn: async () => {
      const res = await getLiveTvApi(api!).getLiveTvChannels({
        userId: user?.Id,
        limit: 500,
        enableFavoriteSorting: true,
        addCurrentProgram: true,
        enableImageTypes: ["Primary"],
      });
      return res.data.Items ?? [];
    },
  });

  const resume = useQuery({
    queryKey: ["multiview", "resume", user?.Id],
    enabled: visible && !!api && !!user?.Id,
    queryFn: async () => {
      const res = await getLibraryApi(api!).getResumeItems({
        userId: user!.Id!,
        includeItemTypes: ["Movie", "Episode"],
        enableImageTypes: ["Primary", "Thumb"],
        limit: MULTIVIEW_RESUME_LIMIT,
      });
      return res.data.Items ?? [];
    },
  });

  // Movies and episodes only: a series or a season is not one stream, so it
  // cannot fill a tile.
  const search = useQuery({
    queryKey: ["multiview", "search", user?.Id, debouncedQuery],
    enabled:
      visible &&
      tab === "media" &&
      debouncedQuery.length > 0 &&
      !!api &&
      !!user?.Id,
    queryFn: async ({ signal }) => {
      const res = await getLibraryApi(api!).getItems(
        {
          userId: user?.Id,
          searchTerm: debouncedQuery,
          includeItemTypes: ["Movie", "Episode"],
          recursive: true,
          limit: MULTIVIEW_SEARCH_LIMIT,
          enableImageTypes: ["Primary", "Thumb"],
        },
        { signal },
      );
      return res.data.Items ?? [];
    },
  });

  const shownChannels = useMemo(
    () => filterChannels(channels.data ?? [], trimmedQuery),
    [channels.data, trimmedQuery],
  );
  const firstShownChannel = shownChannels.find(
    (c) => c.Id && !onScreen.includes(c.Id),
  )?.Id;

  // Where a remote starts: the first row that can still be added. A row
  // already on screen is disabled and cannot take focus.
  const firstAddable = (list: BaseItemDto[] | undefined) =>
    list?.find((i) => i.Id && !onScreen.includes(i.Id))?.Id;

  const row = (
    item: BaseItemDto,
    subtitle?: string | null,
    preferredId?: string,
  ) => {
    const added = !!item.Id && onScreen.includes(item.Id);
    return (
      <PickerRow
        key={item.Id}
        testID={`multiview-pick-${item.Id}`}
        disabled={added || !item.Id}
        onPress={() => item.Id && onPick(item.Id)}
        // A remote starts here, not on the dimmed side.
        hasTVPreferredFocus={
          Platform.isTV && !!item.Id && item.Id === preferredId
        }
        dimmed={added}
      >
        <View className='mr-3 rounded-lg overflow-hidden'>
          <ItemImage
            item={item}
            style={{ width: 48, height: 48, borderRadius: 8 }}
          />
        </View>
        <View className='flex-1'>
          <Text className='font-bold' numberOfLines={1}>
            {item.Type === "Episode" && item.SeriesName
              ? `${item.SeriesName}: ${item.Name}`
              : item.Name}
          </Text>
          {!!subtitle && (
            <Text className='text-neutral-400 text-xs' numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
        {added ? (
          <Text className='text-neutral-400 text-xs'>
            {t("multiview.on_screen")}
          </Text>
        ) : (
          <Ionicons name='add-circle-outline' size={22} color='white' />
        )}
      </PickerRow>
    );
  };

  const note = (text: string) => (
    <Text className='px-4 py-2 text-neutral-500'>{text}</Text>
  );
  const noMatches = note(t("multiview.no_matches", { query: trimmedQuery }));
  const spinner = (
    <View className='py-4 items-center'>
      <Loader />
    </View>
  );

  // Only the notes for an empty or loading channel list; the channels
  // themselves go in a virtualized list, since a server can have hundreds.
  const tvNote = () => {
    if (channels.isLoading) return spinner;
    if (channels.data?.length === 0) return note(t("live_tv.no_channels"));
    if (shownChannels.length === 0) return noMatches;
    return null;
  };
  const tvNoteContent = tab === "tv" ? tvNote() : null;

  const mediaList = () => {
    if (trimmedQuery) {
      // Until the pause after typing runs out, the last answer belongs to an
      // older search, so it is not shown.
      if (debouncedQuery !== trimmedQuery || search.isLoading) return spinner;
      if (search.data?.length === 0) return noMatches;
      return search.data?.map((i) => row(i, null, firstAddable(search.data)));
    }
    if (resume.isLoading) return spinner;
    if (resume.data?.length === 0)
      return note(t("multiview.nothing_in_progress"));
    return (
      <>
        <Text className='px-4 pt-2 pb-2 text-neutral-400 uppercase text-xs'>
          {t("multiview.continue_watching")}
        </Text>
        {resume.data?.map((i) => row(i, null, firstAddable(resume.data)))}
      </>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType='slide'
      transparent
      supportedOrientations={["landscape", "portrait"]}
      onRequestClose={onClose}
    >
      <View className='flex-1 flex-row'>
        <Pressable
          testID='multiview-picker-backdrop'
          className='flex-1'
          onPress={onClose}
          // On TV it would take focus first, and select would close the
          // picker; Back closes it there.
          focusable={!Platform.isTV}
          accessibilityLabel={t("multiview.close_picker")}
        />
        <View
          className='bg-neutral-900'
          style={{
            width: MULTIVIEW_PICKER_WIDTH,
            maxWidth: "70%",
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom,
            paddingRight: insets.right,
          }}
        >
          <View className='flex flex-row items-center justify-between px-4 mb-3'>
            <Text className='text-lg font-bold'>{t("multiview.add_tile")}</Text>
            <PickerRow
              onPress={onClose}
              hitSlop={8}
              compact
              accessibilityLabel={t("multiview.close_picker")}
            >
              <Ionicons name='close' size={24} color='white' />
            </PickerRow>
          </View>
          <View className='px-4'>
            <Input
              value={query}
              onChangeText={setQuery}
              placeholder={
                tab === "tv"
                  ? t("multiview.search_channels")
                  : t("multiview.search_media")
              }
              autoCorrect={false}
              autoCapitalize='none'
              returnKeyType='search'
              // On TV the Input is a fixed-height pill sized for TV text; the
              // phone padding ate into that height and cut "Search channels"
              // in half (Fire TV, 2026-11-17).
              extraClassName={
                Platform.isTV ? undefined : "bg-neutral-800 py-2.5"
              }
            />
          </View>
          <View
            accessibilityRole='tablist'
            className='flex flex-row mx-4 mt-3 mb-2 p-1 rounded-xl bg-neutral-800'
          >
            {(["tv", "media"] as const).map((option) => {
              const selected = option === tab;
              return (
                <PickerTab
                  key={option}
                  selected={selected}
                  onPress={() => setTab(option)}
                >
                  <Text
                    numberOfLines={1}
                    className={`text-sm font-semibold ${
                      selected ? "text-white" : "text-neutral-400"
                    }`}
                  >
                    {t(TAB_LABEL_KEYS[option])}
                  </Text>
                </PickerTab>
              );
            })}
          </View>
          {/* Taps reach a row while the keyboard is up, instead of only
              dismissing it. */}
          {tab === "tv" && !tvNoteContent ? (
            <FlashList
              data={shownChannels}
              keyExtractor={(c, i) => c.Id ?? String(i)}
              keyboardShouldPersistTaps='handled'
              renderItem={({ item: c }) =>
                row(c, c.CurrentProgram?.Name, firstShownChannel)
              }
            />
          ) : (
            <ScrollView keyboardShouldPersistTaps='handled'>
              {tab === "tv" ? tvNoteContent : mediaList()}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

/** A picker row or button that shows when the TV remote is on it. */
function PickerRow({
  children,
  dimmed,
  compact,
  ...props
}: React.ComponentProps<typeof Pressable> & {
  children: React.ReactNode;
  dimmed?: boolean;
  compact?: boolean;
}) {
  const { focused, onFocus, onBlur } = useFocused();
  return (
    <Pressable
      {...props}
      onFocus={onFocus}
      onBlur={onBlur}
      accessibilityRole='button'
      className={
        compact ? "rounded-full p-1" : "flex flex-row items-center px-4 py-2"
      }
      style={{
        opacity: dimmed ? 0.4 : 1,
        backgroundColor: focused ? MultiviewColors.focused : "transparent",
      }}
    >
      {children}
    </Pressable>
  );
}

/** One of the picker's Live TV / Media tabs. */
function PickerTab({
  selected,
  onPress,
  children,
}: {
  selected: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const { focused, onFocus, onBlur } = useFocused();
  return (
    <Pressable
      accessibilityRole='tab'
      accessibilityState={{ selected }}
      onPress={onPress}
      onFocus={onFocus}
      onBlur={onBlur}
      className={`flex-1 items-center py-1.5 rounded-lg ${
        selected ? "bg-neutral-600" : ""
      }`}
      style={
        focused
          ? { borderWidth: 2, borderColor: MultiviewColors.focusRing }
          : undefined
      }
    >
      {children}
    </Pressable>
  );
}
