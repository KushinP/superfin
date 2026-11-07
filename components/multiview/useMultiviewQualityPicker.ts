import { useActionSheet } from "@expo/react-native-action-sheet";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";
import { BITRATES } from "@/components/BitrateSelector";
import { useTVOptionModal } from "@/hooks/useTVOptionModal";
import { useSettings } from "@/utils/atoms/settings";
import type { TileQuality } from "@/utils/multiview/multiview";
import { DEFAULT_MULTIVIEW_BITRATE } from "@/utils/multiview/tileBitrate";

/** The option that puts a tile back on the quality all tiles share. */
const SHARED = "multiview-quality-shared";

interface PickParams {
  title: string;
  message: string;
  /** The key shown as selected: a bitrate's, or SHARED. */
  selected: string;
  /** Offered first, before the bitrates. */
  shared?: string;
  onPick: (key: string) => void;
}

/**
 * Multiview quality, changed from inside multiview: for every tile at once
 * (the "Multiview quality" setting, the same one Settings shows), or for one
 * tile over it. A tile reopens its stream at a new cap, so a live channel
 * reconnects for a moment; picking the cap already in use does nothing.
 *
 * The picker is the platform's own: the TV option sheet on Apple TV and
 * Android TV, an action sheet on the iPhone, iPad and Mac.
 */
export const useMultiviewQualityPicker = () => {
  const { t } = useTranslation();
  const { settings, updateSettings, pluginSettings } = useSettings();
  const { showActionSheetWithOptions } = useActionSheet();
  const { showOptions } = useTVOptionModal();

  const current = settings?.multiviewMaxBitrate ?? DEFAULT_MULTIVIEW_BITRATE;
  const locked = pluginSettings?.multiviewMaxBitrate?.locked === true;

  const pick = useCallback(
    ({ title, message, selected, shared, onPick }: PickParams) => {
      const keys = [...(shared ? [SHARED] : []), ...BITRATES.map((b) => b.key)];
      const label = (key: string) => (key === SHARED ? shared! : key);
      if (Platform.isTV) {
        showOptions({
          title,
          options: keys.map((key) => ({
            label: label(key),
            value: key,
            selected: key === selected,
          })),
          onSelect: onPick,
        });
        return;
      }
      const cancel = keys.length;
      showActionSheetWithOptions(
        {
          title,
          message,
          options: [...keys.map(label), t("common.cancel")],
          cancelButtonIndex: cancel,
        },
        (index) => {
          if (index === undefined || index === cancel) return;
          onPick(keys[index]);
        },
      );
    },
    [showOptions, showActionSheetWithOptions, t],
  );

  /** Every tile: the setting itself. `onPicked` runs after a change. */
  const openShared = useCallback(
    (onPicked?: () => void) => {
      if (locked) return;
      pick({
        title: t("home.settings.other.multiview_quality"),
        message: t("multiview.quality_message", { quality: current.key }),
        selected: current.key,
        onPick: (key) => {
          const bitrate = BITRATES.find((b) => b.key === key);
          if (!bitrate || bitrate.key === current.key) return;
          updateSettings({ multiviewMaxBitrate: bitrate });
          onPicked?.();
        },
      });
    },
    [locked, pick, t, current.key, updateSettings],
  );

  /**
   * One tile. `onPick` gets the tile's new cap, or undefined to follow the
   * shared one again; it is not called when nothing changes.
   */
  const openTile = useCallback(
    (
      tileQuality: TileQuality | undefined,
      onPick: (quality: TileQuality | undefined) => void,
    ) => {
      if (locked) return;
      const effective = tileQuality ?? current;
      pick({
        title: t("multiview.tile_quality", { quality: effective.key }),
        message: t("multiview.tile_quality_message", {
          quality: effective.key,
        }),
        selected: tileQuality?.key ?? SHARED,
        shared: t("multiview.tile_quality_shared", { quality: current.key }),
        onPick: (key) => {
          if (key === SHARED) {
            if (tileQuality) onPick(undefined);
            return;
          }
          const bitrate = BITRATES.find((b) => b.key === key);
          if (!bitrate || bitrate.key === tileQuality?.key) return;
          onPick({ key: bitrate.key, value: bitrate.value });
        },
      });
    },
    [locked, current, pick, t],
  );

  return { quality: current.key, locked, openShared, openTile };
};
