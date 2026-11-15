import { useActionSheet } from "@expo/react-native-action-sheet";
import { Ionicons } from "@expo/vector-icons";
import { getShowApi } from "@jellyfin/sdk/lib/utils/api";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AppState,
  findNodeHandle,
  type HWEvent,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "@/components/common/Text";
import { Loader } from "@/components/Loader";
import { Colors, MultiviewColors } from "@/constants/Colors";
import {
  MULTIVIEW_ADJACENT_EPISODES,
  MULTIVIEW_EOF_PAUSE_TOLERANCE,
  MULTIVIEW_LIVE_STALL_RECONNECT,
  MULTIVIEW_LIVE_START_RECONNECT,
  MULTIVIEW_SEEK_BACK_SECONDS,
  MULTIVIEW_SEEK_FORWARD_SECONDS,
  MULTIVIEW_STALL_DELAY,
} from "@/constants/Multiview";
import { useMultiviewTileStream } from "@/hooks/useMultiviewTileStream";
import { useTVEventHandler } from "@/hooks/useTVEventHandler";
import { ExoPlayerView, MpvPlayerView, type MpvPlayerViewRef } from "@/modules";
import { apiAtom, userAtom } from "@/utils/atoms/api";
import {
  applyMpvSubtitleSelection,
  compareTracksForMenu,
  getExternalSubtitleUrl,
  isBurnedInSubtitle,
} from "@/utils/jellyfin/subtitleUtils";
import { writeToLog } from "@/utils/log";
import { multiviewEngine } from "@/utils/multiview/availability";
import type { TileFrame, TileQuality } from "@/utils/multiview/multiview";
import { createPlaybackStartWatch } from "@/utils/multiview/playbackStart";
import { isAtEnd, nextEpisodeIn } from "@/utils/multiview/tilePlayback";
import { MultiviewTileStats } from "./MultiviewTileStats";
import { useFocused } from "./useFocused";

interface Props {
  itemId: string;
  frame: TileFrame;
  muted: boolean;
  /** Draws the outline that marks the tile being heard. */
  heard: boolean;
  /**
   * When false the name, the speaker badge and the playback controls are
   * hidden with the toolbar.
   */
  showLabel: boolean;
  onPress: () => void;
  /** Opens the tile's menu, with the item's name once it is known. */
  onLongPress: (name?: string) => void;
  /** A playback control was used; keeps the toolbar and controls up. */
  onInteract?: () => void;
  /** Plays this item in the tile's place: the next episode, once one ends. */
  onPlayNext?: (itemId: string) => void;
  /** Takes the tile off the screen. */
  onRemove?: () => void;
  /** The TV remote's focus arrived on the tile or left it. */
  onFocusChange?: (focused: boolean) => void;
  /** Where a TV remote starts. */
  hasTVPreferredFocus?: boolean;
  /**
   * Where Up goes with a TV remote: the toolbar sits inside the tile, not
   * above it, so Android's own focus search never finds it.
   */
  nextFocusUp?: number;
  /** The tile's focusable view, for the toolbar's Down to come back to. */
  onTargetRef?: (handle: number | null) => void;
  /**
   * Each new value moves the TV focus to this tile: a closed TV menu leaves
   * Android TV with nothing focused (android-tv-modal-close-loses-focus).
   */
  focusRequest?: number;
  /** This tile's own quality cap; unset, it follows the shared setting. */
  quality?: TileQuality;
  /** The cap in force, own or shared, for the stats overlay. */
  qualityKey?: string;
  /** Shows what the server sends and what the player decodes. */
  showStats?: boolean;
  /**
   * A live channel stopped receiving video, or never started: the screen
   * reconnects it (autoReconnectTile).
   */
  onStuck?: () => void;
  /** The tile's video moves: its automatic reconnects start over. */
  onPlaying?: () => void;
}

// Several players at once: MPV on iOS; on Android TV, ExoPlayer, since
// Android's MPV allows one video per process (see isMultiviewAvailable).
const TilePlayer =
  multiviewEngine(Platform) === "exoplayer" ? ExoPlayerView : MpvPlayerView;

export function MultiviewTile({
  itemId,
  frame,
  muted,
  heard,
  showLabel,
  onPress,
  onLongPress,
  onInteract,
  onPlayNext,
  onRemove,
  onFocusChange,
  hasTVPreferredFocus,
  nextFocusUp,
  onTargetRef,
  focusRequest,
  quality,
  qualityKey,
  showStats,
  onStuck,
  onPlaying,
}: Props) {
  const { t } = useTranslation();
  const { showActionSheetWithOptions } = useActionSheet();
  const api = useAtomValue(apiAtom);
  const user = useAtomValue(userAtom);
  const playerRef = useRef<MpvPlayerViewRef>(null);
  // React clears playerRef before effect cleanups run on unmount, so the
  // cleanup that frees the decoder reads the last player seen from here.
  const lastPlayer = useRef<MpvPlayerViewRef | null>(null);
  const setPlayer = useCallback((player: MpvPlayerViewRef | null) => {
    playerRef.current = player;
    if (player) lastPlayer.current = player;
  }, []);
  const { state, onPosition, onPaused } = useMultiviewTileStream(
    itemId,
    quality,
  );
  // Read when the source is built and from onLoad: a mute that arrives over
  // the bridge after an autoplaying file has started is heard for a moment.
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const readySource = state.status === "ready" ? state.source : undefined;
  // One object per stream: a new source object makes the native view reload.
  // The mute is read once, at load; later changes go through setMute.
  const source = useMemo(
    () => readySource && { ...readySource, muted: mutedRef.current },
    [readySource],
  );
  const isChannel = state.status === "ready" && state.item.Type === "TvChannel";
  // The stream URL arrives well before the first frame of a live channel, so
  // the spinner stays until playback is seen to move, not until the URL.
  // One watch per stream: a stream reopened in place (a server URL or bitrate
  // change) starts from its first frame again.
  const playbackStarted = useMemo(() => createPlaybackStartWatch(), [source]);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [seeking, setSeeking] = useState(false);
  // When the current stream was handed to the player, for the log of a
  // channel that never shows a first frame.
  const sourceSetAt = useRef(Date.now());
  // A new stream object means a reload: wait for its first frame again.
  useEffect(() => {
    sourceSetAt.current = Date.now();
    setPlaying(false);
  }, [source]);
  // Seconds of video the player last said it had buffered; undefined when it
  // never says (ExoPlayer), so the log does not read that as "ran dry".
  const bufferedSeconds = useRef<number | undefined>(undefined);
  const [stalled, setStalled] = useState(false);
  const [ended, setEnded] = useState(false);
  // The server hears a finished tile as paused, as it hears a paused one.
  useEffect(() => onPaused(paused || ended), [paused, ended, onPaused]);
  const lastPosition = useRef<number | null>(null);
  const duration = useRef(0);
  const lastMoveAt = useRef(Date.now());
  // A live channel has no end: its duration can grow with the live edge.
  const stoppedAtEnd = (tolerance?: number) =>
    !isChannel &&
    lastPosition.current !== null &&
    isAtEnd(lastPosition.current, duration.current, tolerance);

  useEffect(() => {
    void playerRef.current?.setMute(muted);
  }, [muted]);

  const target = useRef<View>(null);
  useEffect(() => {
    if (focusRequest === undefined) return;
    (
      target.current as (View & { requestTVFocus?: () => void }) | null
    )?.requestTVFocus?.();
  }, [focusRequest]);

  // Free the decoder as soon as the tile goes, not when the view is collected:
  // with several players up, the next tile may need that memory right away.
  useEffect(
    () => () => {
      void lastPlayer.current?.destroy();
    },
    [],
  );

  // A stream that stops delivering sends no more ticks, so the stall is
  // noticed by a clock rather than by a tick. A pause is not a stall, and
  // neither is a file that has simply played to its end: the embedded player
  // sends no end event, it just stops ticking.
  useEffect(() => {
    if (!playing || paused) return;
    const timer = setInterval(() => {
      if (Date.now() - lastMoveAt.current > MULTIVIEW_STALL_DELAY) {
        if (stoppedAtEnd()) setEnded(true);
        else setStalled(true);
      }
    }, MULTIVIEW_STALL_DELAY / 4);
    return () => clearInterval(timer);
  }, [playing, paused]);

  const onProgress = useCallback(
    (position: number, total: number, cacheSeconds?: number) => {
      onPosition(position);
      duration.current = total;
      if (typeof cacheSeconds === "number") {
        bufferedSeconds.current = cacheSeconds;
      }
      if (position !== lastPosition.current) {
        lastPosition.current = position;
        lastMoveAt.current = Date.now();
        setStalled(false);
        setEnded(false);
      }
      if (!playing && playbackStarted(position)) setPlaying(true);
    },
    [onPosition, playing, playbackStarted],
  );

  // Read through refs: the screen passes new functions every render, and the
  // timers below must not restart for that.
  const onStuckRef = useRef(onStuck);
  onStuckRef.current = onStuck;
  const onPlayingRef = useRef(onPlaying);
  onPlayingRef.current = onPlaying;

  useEffect(() => {
    if (playing) onPlayingRef.current?.();
  }, [playing]);

  // A live channel whose server stops sending keeps its connection open and
  // MPV waits for it without end, logging nothing; only a fresh connection
  // brings the channel back. So a channel stalled past the live cushion, or
  // one that never shows a first frame, asks to be reconnected. A pause is
  // the user's, and is left alone.
  const itemName = state.status === "ready" ? state.item.Name : undefined;
  useEffect(() => {
    if (!isChannel || paused) return;
    if (playing && !stalled) return;
    const timer = setTimeout(
      () => {
        // Why the picture froze is still unknown (spec 2026-11-08): what was
        // buffered and whether the app was in front tell a starved stream
        // from a stuck player from a backgrounded app.
        const since = playing ? lastMoveAt.current : sourceSetAt.current;
        writeToLog("WARN", "multiview: live tile stuck, reconnecting", {
          itemId,
          name: itemName,
          started: playing,
          frozenSeconds: Math.round((Date.now() - since) / 100) / 10,
          bufferedSeconds: bufferedSeconds.current ?? "unknown",
          appState: AppState.currentState,
        });
        onStuckRef.current?.();
      },
      playing ? MULTIVIEW_LIVE_STALL_RECONNECT : MULTIVIEW_LIVE_START_RECONNECT,
    );
    return () => clearTimeout(timer);
  }, [isChannel, paused, playing, stalled, itemId, itemName]);

  // Asked for only once an episode has ended, the one moment it is wanted.
  const nextEpisode = useQuery({
    queryKey: ["multiview", "next", itemId],
    enabled:
      ended &&
      !!api &&
      state.status === "ready" &&
      state.item.Type === "Episode" &&
      !!state.item.SeriesId,
    queryFn: async () => {
      if (state.status !== "ready" || !state.item.SeriesId) return null;
      const res = await getShowApi(api!).getEpisodes({
        seriesId: state.item.SeriesId,
        adjacentTo: itemId,
        userId: user?.Id,
        limit: MULTIVIEW_ADJACENT_EPISODES,
      });
      return nextEpisodeIn(res.data.Items, itemId);
    },
  });

  const playAgain = () => {
    setEnded(false);
    lastMoveAt.current = Date.now();
    void playerRef.current?.seekTo(0);
    void playerRef.current?.play();
  };

  const control = (action: () => void) => () => {
    onInteract?.();
    action();
  };

  const showCaptions = () => {
    const player = playerRef.current;
    if (!player || state.status !== "ready") return;
    // The server's own list, named as the full player names it. A stream the
    // server burns in cannot be switched on without restarting the stream.
    const subtitleStreams = (state.mediaSource?.MediaStreams ?? []).filter(
      (s) => s.Type === "Subtitle",
    );
    const tracks = subtitleStreams
      .filter((s) => !isBurnedInSubtitle(s))
      .sort(compareTracksForMenu);
    if (tracks.length === 0) {
      showActionSheetWithOptions(
        {
          title: t("multiview.no_captions"),
          options: [t("common.cancel")],
          cancelButtonIndex: 0,
        },
        () => {},
      );
      return;
    }
    const cancel = tracks.length + 1;
    showActionSheetWithOptions(
      {
        title: t("multiview.captions"),
        options: [
          t("multiview.captions_off"),
          ...tracks.map(
            (track) =>
              track.DisplayTitle ||
              track.Language ||
              t("multiview.captions_track", { number: track.Index }),
          ),
          t("common.cancel"),
        ],
        cancelButtonIndex: cancel,
      },
      (index) => {
        if (index === undefined || index === cancel) return;
        // The same resolution as the full player, which matches the server's
        // stream to MPV's own track by identity, not by position.
        void applyMpvSubtitleSelection(player, {
          subtitleStreams,
          jellyfinSubtitleIndex:
            index === 0 ? -1 : (tracks[index - 1].Index ?? -1),
          getExpectedExternalUrl: (sub) =>
            getExternalSubtitleUrl(sub, {
              offline: false,
              basePath: api?.basePath,
            }),
        });
      },
    );
  };

  const waiting =
    state.status === "loading" ||
    (state.status === "ready" &&
      !ended &&
      (!playing || seeking || (stalled && !paused)));
  // A live channel has no pause, no skip and no captions to offer here.
  const canControl =
    !ended && state.status === "ready" && state.item.Type !== "TvChannel";
  const hasControls = showLabel && canControl;
  const next = nextEpisode.data;

  const { focused, onFocus, onBlur } = useFocused(onFocusChange);

  // The remote's playback keys act on the tile it is on. The on-screen
  // buttons are out of a TV remote's reach: they sit inside the tile's own
  // focus target, and Android's focus search only moves to its neighbours,
  // so on a Fire TV play, pause, forward and rewind did nothing.
  const remoteKey = useRef<(evt: HWEvent) => void>(() => {});
  remoteKey.current = (evt) => {
    if (!focused || !canControl) return;
    // One press, one action: the release comes as a second event.
    if (evt.eventKeyAction !== undefined && evt.eventKeyAction !== 0) return;
    const player = playerRef.current;
    if (evt.eventType === "playPause") {
      control(() => void (paused ? player?.play() : player?.pause()))();
    } else if (evt.eventType === "play") {
      control(() => void player?.play())();
    } else if (evt.eventType === "pause") {
      control(() => void player?.pause())();
    } else if (evt.eventType === "rewind") {
      control(() => void player?.seekBy(-MULTIVIEW_SEEK_BACK_SECONDS))();
    } else if (evt.eventType === "fastForward") {
      control(() => void player?.seekBy(MULTIVIEW_SEEK_FORWARD_SECONDS))();
    }
  };
  const onRemoteKey = useCallback((evt: HWEvent) => remoteKey.current(evt), []);
  useTVEventHandler(onRemoteKey);

  return (
    <View
      testID='multiview-tile'
      style={[
        styles.tile,
        {
          left: frame.left,
          top: frame.top,
          width: frame.width,
          height: frame.height,
        },
        // Like the labels, the outline goes after the toolbar's delay: left
        // on, it framed the tile for as long as it played.
        heard && showLabel && styles.heard,
        // White, apart from the green of the tile being heard. It goes with
        // the labels: with one tile the focus never leaves it, and the ring
        // stayed on screen for good.
        focused && showLabel && { borderColor: MultiviewColors.focusRing },
      ]}
    >
      {state.status === "ready" && (
        <TilePlayer
          ref={setPlayer}
          source={source}
          style={StyleSheet.absoluteFill}
          onLoad={() => void playerRef.current?.setMute(mutedRef.current)}
          onProgress={(e) =>
            onProgress(
              e.nativeEvent.position,
              e.nativeEvent.duration,
              (e.nativeEvent as { cacheSeconds?: number }).cacheSeconds,
            )
          }
          onPlaybackStateChange={(e) => {
            const { isPaused, isLoading } = e.nativeEvent;
            if (isPaused !== undefined) {
              setPaused(isPaused);
              // The clock restarts on resume, or the pause reads as a stall.
              if (!isPaused) lastMoveAt.current = Date.now();
              // MPV can also hold the last frame paused once a file is done.
              else if (stoppedAtEnd(MULTIVIEW_EOF_PAUSE_TOLERANCE))
                setEnded(true);
            }
            if (isLoading !== undefined) setSeeking(isLoading);
          }}
        />
      )}
      {waiting && (
        <View
          style={styles.center}
          accessible
          accessibilityLabel={t("multiview.tile_starting")}
        >
          <Loader />
        </View>
      )}
      {showStats && state.status === "ready" && (
        <MultiviewTileStats
          playerRef={playerRef}
          mediaSource={state.mediaSource}
          qualityKey={qualityKey ?? quality?.key ?? ""}
          tileOwnQuality={!!quality}
        />
      )}
      {state.status === "error" && (
        <View style={styles.center}>
          <Text className='text-neutral-400 text-center px-2'>
            {t("multiview.tile_failed")}
          </Text>
        </View>
      )}
      {/* Above the native view, which would otherwise take the touches. */}
      <Pressable
        testID='multiview-tile-target'
        ref={(view) => {
          target.current = view;
          onTargetRef?.(view ? findNodeHandle(view) : null);
        }}
        nextFocusUp={nextFocusUp}
        style={StyleSheet.absoluteFill}
        onPress={onPress}
        onLongPress={() =>
          onLongPress(
            state.status === "ready"
              ? (state.item.Name ?? undefined)
              : undefined,
          )
        }
        onFocus={onFocus}
        onBlur={onBlur}
        hasTVPreferredFocus={hasTVPreferredFocus}
        accessibilityRole='button'
        accessibilityLabel={
          state.status === "ready" ? (state.item.Name ?? undefined) : undefined
        }
        accessibilityHint={t("multiview.tile_hint")}
      >
        {showLabel && state.status === "ready" && (
          <View style={styles.label}>
            {!muted && (
              <Ionicons
                name='volume-high'
                size={14}
                color='white'
                style={{ marginRight: 4 }}
              />
            )}
            <Text className='text-xs text-white' numberOfLines={1}>
              {state.item.Name}
            </Text>
          </View>
        )}
      </Pressable>
      {/* The tile's own menu (quality, stats, reconnect), in sight: press
          and hold is not something a mouse user tries, and a live channel
          has no other buttons. Also while loading, the moment Reconnect is
          wanted. A TV remote holds Select for it instead: a second focus
          stop inside every tile would get in the way of moving between them. */}
      {showLabel && !Platform.isTV && (
        <Pressable
          testID='multiview-tile-menu'
          onPress={() => onLongPress()}
          hitSlop={6}
          accessibilityRole='button'
          accessibilityLabel={t("multiview.tile_menu")}
          style={styles.menuButton}
        >
          <Ionicons name='ellipsis-horizontal' size={16} color='white' />
        </Pressable>
      )}
      {ended && (
        <View style={[styles.center, styles.endedCard]}>
          <Text className='text-white font-bold mb-2'>
            {t("multiview.finished")}
          </Text>
          <View style={styles.endedActions}>
            {!!next?.Id && (
              <EndedButton
                label={t("multiview.play_next", { name: next.Name ?? "" })}
                primary
                onPress={() => next.Id && onPlayNext?.(next.Id)}
              />
            )}
            <EndedButton
              label={t("multiview.play_again")}
              onPress={playAgain}
            />
            <EndedButton
              label={t("multiview.remove_tile")}
              onPress={() => onRemove?.()}
            />
          </View>
        </View>
      )}
      {hasControls && (
        // box-none: the gaps around the buttons still reach the tile.
        <View style={styles.center} pointerEvents='box-none'>
          <View style={styles.controls}>
            <ControlButton
              icon='play-back'
              label={t("multiview.seek_back", {
                seconds: MULTIVIEW_SEEK_BACK_SECONDS,
              })}
              onPress={control(
                () =>
                  void playerRef.current?.seekBy(-MULTIVIEW_SEEK_BACK_SECONDS),
              )}
            />
            <ControlButton
              icon={paused ? "play" : "pause"}
              label={paused ? t("multiview.play") : t("multiview.pause")}
              onPress={control(
                () =>
                  void (paused
                    ? playerRef.current?.play()
                    : playerRef.current?.pause()),
              )}
            />
            <ControlButton
              icon='play-forward'
              label={t("multiview.seek_forward", {
                seconds: MULTIVIEW_SEEK_FORWARD_SECONDS,
              })}
              onPress={control(
                () =>
                  void playerRef.current?.seekBy(
                    MULTIVIEW_SEEK_FORWARD_SECONDS,
                  ),
              )}
            />
            <ControlButton
              icon='text'
              label={t("multiview.captions")}
              onPress={control(showCaptions)}
            />
          </View>
        </View>
      )}
    </View>
  );
}

function ControlButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole='button'
      accessibilityLabel={label}
      style={styles.controlButton}
    >
      <Ionicons name={icon} size={18} color='white' />
    </Pressable>
  );
}

function EndedButton({
  label,
  primary,
  onPress,
}: {
  label: string;
  primary?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole='button'
      style={[styles.endedButton, primary && styles.endedButtonPrimary]}
    >
      <Text className='text-xs text-white font-semibold' numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    position: "absolute",
    backgroundColor: "black",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  heard: {
    borderColor: Colors.primary,
  },
  center: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  menuButton: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  label: {
    position: "absolute",
    left: 6,
    bottom: 6,
    maxWidth: "90%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  endedCard: {
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 8,
  },
  endedActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
  },
  endedButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "rgba(64,64,64,0.9)",
    maxWidth: "100%",
  },
  endedButtonPrimary: {
    backgroundColor: Colors.primary,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  controlButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
});
