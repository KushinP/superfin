import type {
  BaseItemDto,
  MediaSourceInfo,
} from "@jellyfin/sdk/lib/generated-client/models";
import { getLibraryApi, getSessionApi } from "@jellyfin/sdk/lib/utils/api";
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { MULTIVIEW_STOP_WAIT_LIMIT } from "@/constants/Multiview";
import { PROGRESS_REPORT_INTERVAL } from "@/constants/Playback";
import type { MpvVideoSource } from "@/modules";
import { apiAtom, userAtom } from "@/utils/atoms/api";
import { useSettings } from "@/utils/atoms/settings";
import { getStreamUrl } from "@/utils/jellyfin/media/getStreamUrl";
import { writeToLog } from "@/utils/log";
import { multiviewEngine } from "@/utils/multiview/availability";
import type { TileQuality } from "@/utils/multiview/multiview";
import { tileMaxBitrate } from "@/utils/multiview/tileBitrate";
import { buildTileSource, type TileStream } from "@/utils/multiview/tileSource";
import { generateDeviceProfile } from "@/utils/profiles/native";
import { secondsToTicks, ticksToSeconds } from "@/utils/time";

type TileStreamState =
  | { status: "loading" }
  | { status: "error" }
  | {
      status: "ready";
      item: BaseItemDto;
      source: MpvVideoSource;
      /** What the server is sending, its subtitle streams among it. */
      mediaSource: MediaSourceInfo | undefined;
    };

/**
 * Stop reports still on their way, across every tile. A live stream holds one
 * tuner until its stop arrives, and a dual tuner has two: a quality change or
 * a reconnect closes a tile's stream and opens a new one at once, and with two
 * live tiles doing that together the new ones asked for tuners the old ones
 * still held, and spun. So a tile waits for these before it opens a stream.
 */
const pendingStops = new Set<Promise<unknown>>();

const trackStop = (stop: Promise<unknown>) => {
  pendingStops.add(stop);
  void stop.finally(() => pendingStops.delete(stop));
  return stop;
};

/** Waits for the stops in flight, but never past MULTIVIEW_STOP_WAIT_LIMIT. */
const stopsSettled = () =>
  pendingStops.size === 0
    ? Promise.resolve()
    : Promise.race([
        Promise.allSettled([...pendingStops]),
        new Promise((resolve) =>
          setTimeout(resolve, MULTIVIEW_STOP_WAIT_LIMIT),
        ),
      ]);

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/**
 * Opens the stream for one multiview tile and closes it with the tile.
 *
 * The close is the part that matters: a live channel opens a server-side live
 * stream that holds one tuner of the HDHomeRun until a stop report carrying
 * its LiveStreamId arrives. A tile that leaks one leaves a dual tuner with a
 * single usable channel until the server times it out. So the stop goes out
 * on every exit, including a tile removed while its stream was still opening.
 */
export const useMultiviewTileStream = (
  itemId: string,
  /** The tile's own quality cap, over the multiview setting. */
  quality?: TileQuality,
) => {
  const api = useAtomValue(apiAtom);
  const user = useAtomValue(userAtom);
  const { settings } = useSettings();
  const audioMode = settings?.audioTranscodeMode;
  // The multiview quality: tiles at the source's full rate stalled, live
  // channels first (tileMaxBitrate).
  const maxBitrate = tileMaxBitrate(settings ?? {}, quality);
  const [state, setState] = useState<TileStreamState>({ status: "loading" });
  // Seconds; the stop report saves it as the resume point of a library item.
  const positionRef = useRef(0);
  // Paused by the user or held on the last frame; the progress reports say
  // so, or the dashboard shows a stopped tile as watching.
  const pausedRef = useRef(false);

  useEffect(() => {
    if (!api || !user?.Id) return;
    let cancelled = false;
    let opened: { item: BaseItemDto; stream: TileStream } | null = null;
    let progressTimer: ReturnType<typeof setInterval> | undefined;

    // At the full player's cadence: keeps the resume point and the server's
    // dashboard current, and bounds how long a crash can leave a live
    // session, and its tuner, looking busy.
    const reportProgress = (session: {
      item: BaseItemDto;
      stream: TileStream;
    }) =>
      getSessionApi(api)
        .reportPlaybackProgress({
          playbackProgressInfo: {
            ItemId: session.item.Id,
            MediaSourceId: session.stream.mediaSource?.Id ?? undefined,
            PlaySessionId: session.stream.sessionId ?? undefined,
            LiveStreamId: session.stream.mediaSource?.LiveStreamId ?? undefined,
            PositionTicks: secondsToTicks(positionRef.current),
            IsPaused: pausedRef.current,
          },
        })
        .catch((error) =>
          writeToLog(
            "ERROR",
            "multiview: progress report failed",
            errorText(error),
          ),
        );

    const reportStopped = (session: {
      item: BaseItemDto;
      stream: TileStream;
    }) =>
      trackStop(
        getSessionApi(api)
          .reportPlaybackStopped({
            playbackStopInfo: {
              ItemId: session.item.Id,
              MediaSourceId: session.stream.mediaSource?.Id ?? undefined,
              PlaySessionId: session.stream.sessionId ?? undefined,
              LiveStreamId:
                session.stream.mediaSource?.LiveStreamId ?? undefined,
              PositionTicks: secondsToTicks(positionRef.current),
            },
          })
          .catch((error) =>
            writeToLog(
              "ERROR",
              "multiview: stop report failed",
              errorText(error),
            ),
          ),
      );

    const open = async () => {
      setState({ status: "loading" });
      try {
        const { data: item } = await getLibraryApi(api).getItem({
          itemId,
          userId: user.Id,
        });
        // A channel always starts at the live edge; anything else resumes.
        const startTicks =
          item.Type === "TvChannel"
            ? 0
            : (item.UserData?.PlaybackPositionTicks ?? 0);
        // Opening a stream can take a tuner a closing tile still holds.
        await stopsSettled();
        if (cancelled) return;
        const res = await getStreamUrl({
          api,
          item,
          userId: user.Id,
          startTimeTicks: startTicks,
          maxStreamingBitrate: maxBitrate,
          // Every tile renders with the multiview engine (MPV, or ExoPlayer
          // on Android TV), whatever the full player is set to.
          deviceProfile: generateDeviceProfile({
            player: multiviewEngine(Platform),
            audioMode,
          }),
        });
        if (!res?.url) {
          // A live stream can be opened on the server, holding a tuner, even
          // when no URL comes back; it is closed here or it stays held.
          if (res?.mediaSource?.LiveStreamId) {
            void reportStopped({ item, stream: { ...res, url: "" } });
          }
          throw new Error("No stream for this item");
        }
        const stream: TileStream = { ...res, url: res.url };
        opened = { item, stream };
        // Removed while the stream was opening: close what was just opened.
        if (cancelled) {
          void reportStopped(opened);
          return;
        }
        positionRef.current = ticksToSeconds(startTicks);
        setState({
          status: "ready",
          item,
          mediaSource: stream.mediaSource,
          source: buildTileSource(stream, {
            basePath: api.basePath,
            accessToken: api.accessToken,
            startPosition: positionRef.current,
          }),
        });
        getSessionApi(api)
          .reportPlaybackStart({
            playbackStartInfo: {
              ItemId: item.Id,
              MediaSourceId: stream.mediaSource?.Id ?? undefined,
              PlaySessionId: stream.sessionId ?? undefined,
              LiveStreamId: stream.mediaSource?.LiveStreamId ?? undefined,
              PositionTicks: startTicks,
              IsPaused: false,
            },
          })
          .catch((error) =>
            writeToLog(
              "ERROR",
              "multiview: start report failed",
              errorText(error),
            ),
          );
        const session = opened;
        progressTimer = setInterval(
          () => void reportProgress(session),
          PROGRESS_REPORT_INTERVAL,
        );
      } catch (error) {
        writeToLog("ERROR", "multiview: could not open tile", errorText(error));
        if (!cancelled) setState({ status: "error" });
      }
    };

    void open();
    return () => {
      cancelled = true;
      clearInterval(progressTimer);
      if (opened) void reportStopped(opened);
    };
  }, [api, user?.Id, itemId, audioMode, maxBitrate]);

  const onPosition = useCallback((seconds: number) => {
    positionRef.current = seconds;
  }, []);

  const onPaused = useCallback((paused: boolean) => {
    pausedRef.current = paused;
  }, []);

  return { state, onPosition, onPaused };
};
