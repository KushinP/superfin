import { MULTIVIEW_LIVE_PROBE_TIMEOUT } from "@/constants/Multiview";

/**
 * "ok": the server serves the channel's live playlist. "failed": it refused
 * it or could not be reached. "unknown": no answer in time, or nothing to
 * check, so the player is left to judge the stream.
 */
export type LiveProbeResult = "ok" | "failed" | "unknown";

/** The first stream a master playlist lists, the one a player picks. */
const firstVariant = (playlist: string) =>
  playlist
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith("#"));

// React Native's URL cannot resolve a relative address, so this does: an
// absolute one as is, a rooted one on the origin, the rest next to the master.
const resolveAgainst = (relative: string, base: string) => {
  if (/^https?:\/\//i.test(relative)) return relative;
  const path = base.split("?")[0];
  if (relative.startsWith("/")) {
    const origin = path.match(/^https?:\/\/[^/]+/i)?.[0] ?? "";
    return `${origin}${relative}`;
  }
  return `${path.slice(0, path.lastIndexOf("/") + 1)}${relative}`;
};

/**
 * Asks the server for a live channel's playlist before the player gets it.
 * MPV on iOS keeps a refused stream to itself (only a real end of file
 * reaches JS), so a tile reopened while Jellyfin was still closing the tuner
 * sat on a black screen until its 30 s first-frame timeout. The master
 * playlist is only text Jellyfin writes; the live playlist under it is what
 * needs the tuner, so that is the one that must answer.
 */
export const probeLivePlaylist = async (
  url: string,
  headers: Record<string, string> = {},
  timeoutMs: number = MULTIVIEW_LIVE_PROBE_TIMEOUT,
): Promise<LiveProbeResult> => {
  // A direct stream never ends: fetching it would download the channel.
  if (!url.split("?")[0].toLowerCase().endsWith(".m3u8")) return "unknown";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const master = await fetch(url, { headers, signal: controller.signal });
    if (!master.ok) return "failed";
    const variant = firstVariant(await master.text());
    if (!variant) return "unknown";
    const live = await fetch(resolveAgainst(variant, url), {
      headers,
      signal: controller.signal,
    });
    return live.ok ? "ok" : "failed";
  } catch {
    return controller.signal.aborted ? "unknown" : "failed";
  } finally {
    clearTimeout(timer);
  }
};
