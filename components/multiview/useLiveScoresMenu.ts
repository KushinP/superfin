import { useActionSheet } from "@expo/react-native-action-sheet";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { LIVE_SCORES_DELAY_DEFAULT_S } from "@/constants/LiveScores";
import { useSettings } from "@/utils/atoms/settings";
import {
  clampDelaySeconds,
  stepDelaySeconds,
} from "@/utils/livescores/delayBuffer";

/**
 * The live scores entry in a multiview tile's menu and the sheet it opens:
 * the spoiler delay a step at a time, from the remote, without leaving the
 * game, and scores off or on.
 */
export const useLiveScoresMenu = () => {
  const { t } = useTranslation();
  const { showActionSheetWithOptions } = useActionSheet();
  const { settings, updateSettings } = useSettings();
  const enabled = settings.liveScoresEnabled !== false;
  const delay = clampDelaySeconds(
    settings.liveScoresDelaySeconds ?? LIVE_SCORES_DELAY_DEFAULT_S,
  );

  const label = enabled
    ? t("livescores.menu_delay", { seconds: delay })
    : t("livescores.menu_off");

  const open = useCallback(() => {
    // Later first: a spoiler is what Kush is most likely fixing.
    const actions: (() => void)[] = [
      () =>
        updateSettings({ liveScoresDelaySeconds: stepDelaySeconds(delay, 1) }),
      () =>
        updateSettings({ liveScoresDelaySeconds: stepDelaySeconds(delay, -1) }),
      () => updateSettings({ liveScoresEnabled: !enabled }),
    ];
    const options = [
      t("livescores.delay_more"),
      t("livescores.delay_less"),
      enabled ? t("livescores.turn_off") : t("livescores.turn_on"),
      t("common.cancel"),
    ];
    showActionSheetWithOptions(
      {
        options,
        message: t("livescores.delay_message", { seconds: delay }),
        cancelButtonIndex: options.length - 1,
      },
      (index) => {
        if (index !== undefined) actions[index]?.();
      },
    );
  }, [delay, enabled, showActionSheetWithOptions, t, updateSettings]);

  return { label, open };
};
