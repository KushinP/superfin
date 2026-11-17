// Type only: the selector module loads its dropdown, native code and all.
import type { Bitrate } from "@/components/BitrateSelector";
import type { Settings } from "@/utils/atoms/settings";
import { isAutoBitrate } from "@/utils/bitrate";

/**
 * A tile's cap until the user picks one. Live channels arrive at the
 * broadcast's full rate, 15 to 19 Mb/s for over-the-air MPEG-2, and two of
 * them stalled side by side on a Fire TV while library items played on;
 * capped, the server sends a lighter stream.
 */
export const DEFAULT_MULTIVIEW_BITRATE: Bitrate = {
  key: "8 Mb/s",
  value: 8_000_000,
};

/**
 * The most a multiview tile streams at, in bits per second (undefined for no
 * cap): the tile's own quality when it has one, else the "Multiview quality"
 * setting, apart from the full player's.
 */
export const tileMaxBitrate = (
  settings: Partial<Pick<Settings, "multiviewMaxBitrate" | "defaultBitrate">>,
  tileQuality?: Bitrate,
): number | undefined => {
  // Auto measures the link for one player, and the tiles share it: an Auto
  // here (from a plugin, or an old setting) is the tile cap instead. Max has
  // no value either, and means no cap.
  const quality = [tileQuality, settings.multiviewMaxBitrate].find(
    (candidate) => candidate && !isAutoBitrate(candidate),
  );
  return (quality ?? DEFAULT_MULTIVIEW_BITRATE).value;
};
