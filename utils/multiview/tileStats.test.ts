import { tileStatsRows } from "./tileStats";

const value = (rows: { label: string; value: string }[], label: string) =>
  rows.find((r) => r.label === label)?.value;

describe("tileStatsRows", () => {
  const liveFox = {
    TranscodingUrl: "/videos/x/master.m3u8",
    Bitrate: 15_000_000,
    MediaStreams: [
      {
        Type: "Video" as const,
        Codec: "mpeg2video",
        Height: 720,
        IsInterlaced: false,
        RealFrameRate: 59.94,
      },
    ],
  };

  test("says the server is re-encoding, and from what", () => {
    const rows = tileStatsRows({
      qualityKey: "8 Mb/s",
      tileOwnQuality: false,
      mediaSource: liveFox,
      info: null,
    });
    expect(value(rows, "multiview.stats_delivery")).toBe(
      "multiview.stats_transcoding",
    );
    expect(value(rows, "multiview.stats_source")).toBe(
      "MPEG2VIDEO · 720p · 60 fps · 15.0 Mb/s",
    );
  });

  test("says the original is sent when there is no transcode", () => {
    const rows = tileStatsRows({
      qualityKey: "Max",
      tileOwnQuality: true,
      mediaSource: { ...liveFox, TranscodingUrl: null },
      info: null,
    });
    expect(value(rows, "multiview.stats_delivery")).toBe(
      "multiview.stats_direct",
    );
    expect(value(rows, "multiview.stats_quality_tile")).toBe("Max");
  });

  test("shows the buffer, which runs down before a stall", () => {
    const rows = tileStatsRows({
      qualityKey: "4 Mb/s",
      tileOwnQuality: false,
      mediaSource: undefined,
      info: {
        videoCodec: "h264",
        videoWidth: 1280,
        videoHeight: 720,
        fps: 59.94,
        cacheSeconds: 0.4,
        droppedFrames: 12,
        hwdec: "videotoolbox",
      },
    });
    expect(value(rows, "multiview.stats_buffer")).toBe("0.4 s");
    expect(value(rows, "multiview.stats_playing")).toBe(
      "H264 · 1280×720 · 60 fps",
    );
    expect(value(rows, "multiview.stats_dropped")).toBe("12");
    expect(value(rows, "multiview.stats_decoder")).toBe("videotoolbox");
  });

  test("leaves out what a player does not report", () => {
    // ExoPlayer tiles give no technical info; the server's half still shows.
    const rows = tileStatsRows({
      qualityKey: "8 Mb/s",
      tileOwnQuality: false,
      mediaSource: liveFox,
      info: null,
    });
    expect(rows.map((r) => r.label)).toEqual([
      "multiview.stats_quality_shared",
      "multiview.stats_delivery",
      "multiview.stats_source",
    ]);
  });
});
