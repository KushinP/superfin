import type { MediaSourceInfo } from "@jellyfin/sdk/lib/generated-client/models";
import type { TechnicalInfo } from "@/modules/mpv-player/src/MpvPlayer.types";

/** One line of a tile's stats overlay: a translation key and its value. */
export interface TileStatsRow {
  label: string;
  value: string;
  /** The value is a translation key too, not a reading. */
  translate?: boolean;
}

const mbps = (bitsPerSecond: number) =>
  `${(bitsPerSecond / 1_000_000).toFixed(1)} Mb/s`;

const scanLine = (height?: number | null, interlaced?: boolean | null) =>
  height ? `${height}${interlaced ? "i" : "p"}` : undefined;

const join = (...parts: (string | undefined | null | false)[]) =>
  parts.filter(Boolean).join(" · ");

/**
 * What a tile's stats overlay shows: what the server sends (the original or a
 * re-encode, and of what), what the player decodes, and how much it has
 * buffered. The buffer is the line that explains a stall: it runs down to zero
 * when the stream arrives slower than it plays.
 *
 * `info` is the player's own report, null where the player gives none (the
 * ExoPlayer tiles on Android TV); the server's half still shows there.
 */
export const tileStatsRows = ({
  qualityKey,
  tileOwnQuality,
  mediaSource,
  info,
}: {
  qualityKey: string;
  /** Whether the cap is the tile's own, not the one all tiles share. */
  tileOwnQuality: boolean;
  mediaSource: MediaSourceInfo | undefined;
  info: TechnicalInfo | null;
}): TileStatsRow[] => {
  const rows: TileStatsRow[] = [
    {
      label: tileOwnQuality
        ? "multiview.stats_quality_tile"
        : "multiview.stats_quality_shared",
      value: qualityKey,
    },
  ];

  if (mediaSource) {
    rows.push({
      label: "multiview.stats_delivery",
      value: mediaSource.TranscodingUrl
        ? "multiview.stats_transcoding"
        : "multiview.stats_direct",
      translate: true,
    });
    const video = mediaSource.MediaStreams?.find((s) => s.Type === "Video");
    const source = join(
      video?.Codec?.toUpperCase(),
      scanLine(video?.Height, video?.IsInterlaced),
      video?.RealFrameRate ? `${Math.round(video.RealFrameRate)} fps` : null,
      mediaSource.Bitrate ? mbps(mediaSource.Bitrate) : null,
    );
    if (source) rows.push({ label: "multiview.stats_source", value: source });
  }

  if (info) {
    const playing = join(
      info.videoCodec?.toUpperCase(),
      info.videoWidth && info.videoHeight
        ? `${info.videoWidth}×${info.videoHeight}`
        : null,
      info.fps ? `${Math.round(info.fps)} fps` : null,
      info.videoBitrate ? mbps(info.videoBitrate) : null,
    );
    if (playing)
      rows.push({ label: "multiview.stats_playing", value: playing });
    if (info.cacheSeconds !== undefined) {
      rows.push({
        label: "multiview.stats_buffer",
        value: `${info.cacheSeconds.toFixed(1)} s`,
      });
    }
    if (info.droppedFrames !== undefined) {
      rows.push({
        label: "multiview.stats_dropped",
        value: String(info.droppedFrames),
      });
    }
    if (info.hwdec) {
      rows.push({ label: "multiview.stats_decoder", value: info.hwdec });
    }
  }
  return rows;
};
