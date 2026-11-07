// Logic lives in utils/multiview/multiview.ts and hooks/useMultiviewTileStream.ts,
// covered by their specs next to them.
import { useActionSheet } from "@expo/react-native-action-sheet";
import { Ionicons } from "@expo/vector-icons";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  AppState,
  findNodeHandle,
  Platform,
  Pressable,
  useWindowDimensions,
  View,
} from "react-native";
import { SystemBars } from "react-native-edge-to-edge";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/common/Text";
import { MultiviewPicker } from "@/components/multiview/MultiviewPicker";
import { MultiviewTile } from "@/components/multiview/MultiviewTile";
import { useFocused } from "@/components/multiview/useFocused";
import { useMultiviewQualityPicker } from "@/components/multiview/useMultiviewQualityPicker";
import { MultiviewColors } from "@/constants/Colors";
import {
  MULTIVIEW_MAX_TILES,
  MULTIVIEW_TOOLBAR_HIDE_DELAY,
  MULTIVIEW_TV_TOOLBAR_BUTTON,
} from "@/constants/Multiview";
import useRouter from "@/hooks/useAppRouter";
import { useOrientation } from "@/hooks/useOrientation";
import { useInvalidatePlaybackProgressCache } from "@/hooks/useRevalidatePlaybackProgressCache";
import { useScreenKeyCommands } from "@/hooks/useScreenKeyCommands";
import type { KeyCommand } from "@/modules/key-commands";
import { OrientationLock } from "@/packages/expo-screen-orientation";
import { isMultiviewAvailable } from "@/utils/multiview/availability";
import {
  addTile,
  applyMultiviewKey,
  clearTileQualities,
  emptyMultiview,
  isTileMuted,
  MULTIVIEW_HEAR_KEY_PREFIX,
  MULTIVIEW_LAYOUT_KEY,
  type MultiviewState,
  playNext,
  promoteTile,
  reconnectTile,
  removeTile,
  setTileQuality,
  tapWhileToolbar,
  tileFrames,
  tilePlayerKey,
  toggleAllAudio,
  toggleLayout,
} from "@/utils/multiview/multiview";

const KEEP_AWAKE_TAG = "multiview";

/**
 * How long, in ms, after the TV quality sheet closes before the quality button
 * takes the focus back: the sheet's route has to be gone first.
 */
const TV_FOCUS_RETURN_DELAY = 300;

/**
 * The route can still be reached by a deep link where multiview cannot run,
 * so there it goes straight back instead of opening tiles that cannot play.
 */
export default function MultiviewRoute() {
  return isMultiviewAvailable(Platform) ? <MultiviewScreen /> : <GoBack />;
}

function GoBack() {
  const router = useRouter();
  useEffect(() => {
    router.back();
  }, [router]);
  return null;
}

function MultiviewScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { lockOrientation, unlockOrientation } = useOrientation();
  const { showActionSheetWithOptions } = useActionSheet();
  const { itemIds } = useLocalSearchParams<{ itemIds?: string }>();

  // Leaving refreshes Continue Watching and the rest, as the full player does
  // when it stops: the tiles' stop reports move resume points and watched
  // states. Read through a ref, since the function changes every render.
  const revalidateProgressCache = useInvalidatePlaybackProgressCache();
  const revalidateRef = useRef(revalidateProgressCache);
  revalidateRef.current = revalidateProgressCache;
  useEffect(
    () => () => {
      void revalidateRef.current();
    },
    [],
  );

  const nextKey = useRef(0);
  const newKey = () => `tile-${nextKey.current++}`;
  const [state, setState] = useState<MultiviewState>(() =>
    (itemIds ?? "")
      .split(",")
      .filter(Boolean)
      .reduce((s, id) => addTile(s, id, newKey()), emptyMultiview),
  );
  const [pickerOpen, setPickerOpen] = useState(state.tiles.length === 0);
  const [toolbarVisible, setToolbarVisible] = useState(true);
  // Bumped by a tile's playback control, so the hide timer starts over even
  // when the press changes nothing in the multiview state.
  const [lastTouch, setLastTouch] = useState(0);
  // With a TV remote: the toolbar stays while one of its buttons has focus,
  // or it would vanish from under the focus and leave nothing focused.
  const [toolbarFocused, setToolbarFocused] = useState(false);
  // Remote focus links between the tiles and the toolbar on top of them,
  // which Android's focus search cannot find from one another.
  const [toolbarHandle, setToolbarHandle] = useState<number | null>(null);
  const [firstTileHandle, setFirstTileHandle] = useState<number | null>(null);
  // Tiles showing their stats overlay, by tile key. Screen state only: stats
  // are for looking into a stall, not something to keep across visits.
  const [statsTiles, setStatsTiles] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const quality = useMultiviewQualityPicker();
  // A closed TV option sheet leaves Android TV with nothing focused (see the
  // android-tv-modal-close-loses-focus fact), so the button that opened it
  // takes the focus back once this screen is on top again.
  const qualityButton = useRef<View>(null);
  const qualityOpened = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!Platform.isTV || !qualityOpened.current) return;
      qualityOpened.current = false;
      const timer = setTimeout(
        () =>
          (
            qualityButton.current as
              | (View & { requestTVFocus?: () => void })
              | null
          )?.requestTVFocus?.(),
        TV_FOCUS_RETURN_DELAY,
      );
      return () => clearTimeout(timer);
    }, []),
  );

  useEffect(() => {
    void lockOrientation(OrientationLock.LANDSCAPE);
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG);
    // iOS drops the lock while the app is in the background, as the full
    // player's layout notes; put it back on return.
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") void lockOrientation(OrientationLock.LANDSCAPE);
    });
    return () => {
      subscription.remove();
      void unlockOrientation();
      deactivateKeepAwake(KEEP_AWAKE_TAG);
    };
  }, [lockOrientation, unlockOrientation]);

  // The toolbar fades out so it does not sit over the video; any touch brings
  // it back. It stays while the picker is open.
  useEffect(() => {
    if (
      !toolbarVisible ||
      toolbarFocused ||
      pickerOpen ||
      state.tiles.length === 0
    )
      return;
    const timer = setTimeout(
      () => setToolbarVisible(false),
      MULTIVIEW_TOOLBAR_HIDE_DELAY,
    );
    return () => clearTimeout(timer);
  }, [toolbarVisible, toolbarFocused, pickerOpen, state, lastTouch]);

  // Keys 1 to 4 hear a tile and G switches the layout, on an iPad or the
  // Mac with a keyboard.
  useScreenKeyCommands(
    [
      ...Array.from({ length: MULTIVIEW_MAX_TILES }, (_, i) => ({
        id: `${MULTIVIEW_HEAR_KEY_PREFIX}${i + 1}`,
        input: String(i + 1),
        modifiers: [] as KeyCommand["modifiers"],
        title: t("multiview.hear_tile", { number: i + 1 }),
      })),
      {
        id: MULTIVIEW_LAYOUT_KEY,
        input: "g",
        modifiers: [],
        title: t("multiview.change_layout"),
      },
    ],
    (id) => {
      setState((s) => applyMultiviewKey(s, id));
      setToolbarVisible(true);
      setLastTouch(Date.now());
    },
  );

  const onTileInteract = useCallback(() => {
    setToolbarVisible(true);
    setLastTouch(Date.now());
  }, []);

  const onTilePress = useCallback(
    (key: string) => {
      setState((s) => tapWhileToolbar(s, key, toolbarVisible));
      setToolbarVisible(true);
      setLastTouch(Date.now());
    },
    [toolbarVisible],
  );

  // Read by the menu through a ref, so the callback stays the same while the
  // tiles change.
  const stateRef = useRef(state);
  stateRef.current = state;
  const statsRef = useRef(statsTiles);
  statsRef.current = statsTiles;

  const onTileLongPress = useCallback(
    (key: string) => {
      const tile = stateRef.current.tiles.find((t) => t.key === key);
      if (!tile) return;
      const statsOn = statsRef.current.has(key);
      // Make main, Quality, Stats, Reconnect, Remove, Cancel.
      const options = [
        t("multiview.make_main"),
        t("multiview.tile_quality", {
          quality: tile.quality?.key ?? quality.quality,
        }),
        statsOn ? t("multiview.stats_hide") : t("multiview.stats_show"),
        t("multiview.reconnect"),
        t("multiview.remove_tile"),
        t("common.cancel"),
      ];
      showActionSheetWithOptions(
        {
          options,
          destructiveButtonIndex: 4,
          cancelButtonIndex: 5,
        },
        (index) => {
          if (index === 0) setState((s) => promoteTile(s, key));
          if (index === 1) {
            quality.openTile(tile.quality, (next) =>
              setState((s) => setTileQuality(s, key, next)),
            );
          }
          if (index === 2) {
            setStatsTiles((current) => {
              const next = new Set(current);
              if (statsOn) next.delete(key);
              else next.add(key);
              return next;
            });
          }
          if (index === 3) setState((s) => reconnectTile(s, key));
          if (index === 4) setState((s) => removeTile(s, key));
        },
      );
    },
    [showActionSheetWithOptions, t, quality],
  );

  const area = {
    left: insets.left,
    top: insets.top,
    width: width - insets.left - insets.right,
    height: height - insets.top - insets.bottom,
  };
  const frames = tileFrames(
    state.layout,
    state.tiles.length,
    area.width,
    area.height,
  );
  const full = state.tiles.length >= MULTIVIEW_MAX_TILES;

  return (
    <View className='flex-1 bg-black'>
      <SystemBars hidden />
      <View
        style={{
          position: "absolute",
          left: area.left,
          top: area.top,
          width: area.width,
          height: area.height,
        }}
      >
        {state.tiles.map((tile, i) =>
          frames[i] ? (
            <MultiviewTile
              // The item and the reconnect count are part of the key: a tile
              // that moves on to the next episode, or is reconnected, starts
              // over as a fresh player and closes the old stream.
              key={tilePlayerKey(tile)}
              itemId={tile.itemId}
              frame={frames[i]}
              muted={isTileMuted(state, tile.key)}
              heard={state.audio === tile.key && state.tiles.length > 1}
              showLabel={toolbarVisible}
              onPress={() => onTilePress(tile.key)}
              onLongPress={() => onTileLongPress(tile.key)}
              onInteract={onTileInteract}
              onPlayNext={(itemId) =>
                setState((s) => playNext(s, tile.key, itemId))
              }
              onRemove={() => setState((s) => removeTile(s, tile.key))}
              // Moving between tiles with a remote brings the toolbar and
              // the labels back, as a touch does.
              onFocusChange={(focused) => focused && onTileInteract()}
              hasTVPreferredFocus={Platform.isTV && i === 0}
              nextFocusUp={toolbarHandle ?? undefined}
              onTargetRef={i === 0 ? setFirstTileHandle : undefined}
              quality={tile.quality}
              qualityKey={tile.quality?.key ?? quality.quality}
              showStats={statsTiles.has(tile.key)}
            />
          ) : null,
        )}
      </View>

      {state.tiles.length === 0 && !pickerOpen && (
        <View className='flex-1 items-center justify-center'>
          <Text className='text-neutral-400 mb-4'>{t("multiview.empty")}</Text>
        </View>
      )}

      {(toolbarVisible || toolbarFocused || state.tiles.length === 0) && (
        <View
          className='flex flex-row items-center'
          style={{
            position: "absolute",
            top: insets.top + 8,
            right: insets.right + 8,
            gap: 8,
          }}
        >
          <ToolbarButton
            onHandle={setToolbarHandle}
            onFocusChange={setToolbarFocused}
            nextFocusDown={firstTileHandle ?? undefined}
            icon='add'
            label={t("multiview.add_tile")}
            disabled={full}
            onPress={() => setPickerOpen(true)}
          />
          <ToolbarButton
            onFocusChange={setToolbarFocused}
            nextFocusDown={firstTileHandle ?? undefined}
            icon={state.layout === "grid" ? "albums-outline" : "grid-outline"}
            label={t("multiview.change_layout")}
            disabled={state.tiles.length < 2}
            onPress={() => setState(toggleLayout)}
          />
          <ToolbarButton
            onFocusChange={setToolbarFocused}
            nextFocusDown={firstTileHandle ?? undefined}
            icon={state.audio === "all" ? "volume-high" : "volume-medium"}
            label={
              state.audio === "all"
                ? t("multiview.audio_one")
                : t("multiview.audio_all")
            }
            disabled={state.tiles.length < 2}
            onPress={() => setState(toggleAllAudio)}
          />
          <ToolbarButton
            buttonRef={qualityButton}
            onFocusChange={setToolbarFocused}
            nextFocusDown={firstTileHandle ?? undefined}
            icon='speedometer-outline'
            label={t("multiview.quality", { quality: quality.quality })}
            disabled={quality.locked}
            onPress={() => {
              qualityOpened.current = true;
              setLastTouch(Date.now());
              // A quality for all tiles replaces the ones set per tile.
              quality.openShared(() => setState(clearTileQualities));
            }}
          />
          <ToolbarButton
            onFocusChange={setToolbarFocused}
            nextFocusDown={firstTileHandle ?? undefined}
            icon='close'
            label={t("multiview.close")}
            onPress={() => router.back()}
          />
        </View>
      )}

      <MultiviewPicker
        visible={pickerOpen}
        onScreen={state.tiles.map((tile) => tile.itemId)}
        onPick={(itemId) => {
          setState((s) => addTile(s, itemId, newKey()));
          setPickerOpen(false);
          setToolbarVisible(true);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}

function ToolbarButton({
  icon,
  label,
  disabled,
  onPress,
  onFocusChange,
  onHandle,
  buttonRef,
  nextFocusDown,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  disabled?: boolean;
  onPress: () => void;
  onFocusChange?: (focused: boolean) => void;
  /** This button's view, for the tiles' Up to reach. */
  onHandle?: (handle: number | null) => void;
  /** This button's view, for the screen to give the focus back to. */
  buttonRef?: RefObject<View | null>;
  nextFocusDown?: number;
}) {
  const { focused, onFocus, onBlur } = useFocused(onFocusChange);
  // Bigger on a TV, seen from the sofa.
  const size = Platform.isTV ? MULTIVIEW_TV_TOOLBAR_BUTTON : 40;
  return (
    <Pressable
      ref={(view) => {
        if (buttonRef) buttonRef.current = view;
        onHandle?.(view ? findNodeHandle(view) : null);
      }}
      nextFocusDown={nextFocusDown}
      onPress={onPress}
      onFocus={onFocus}
      onBlur={onBlur}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole='button'
      accessibilityLabel={label}
      className='items-center justify-center rounded-full'
      style={{
        width: size,
        height: size,
        // Focused, a button turns solid white like the TV top bar's tabs:
        // an outline on a small dark circle was too faint across a room.
        backgroundColor: focused
          ? MultiviewColors.focusRing
          : "rgba(38,38,38,0.8)",
        opacity: disabled ? 0.4 : 1,
        transform: [{ scale: focused ? 1.12 : 1 }],
      }}
    >
      <Ionicons
        name={icon}
        size={Math.round(size * 0.55)}
        color={focused ? "black" : "white"}
      />
    </Pressable>
  );
}
