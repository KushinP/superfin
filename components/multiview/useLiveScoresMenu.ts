import { useActionSheet } from "@expo/react-native-action-sheet";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";
import { LIVE_SCORES_DELAY_DEFAULT_S } from "@/constants/LiveScores";
import { useTVOptionModal } from "@/hooks/useTVOptionModal";
import { useSettings } from "@/utils/atoms/settings";
import {
  clampDelaySeconds,
  stepDelaySeconds,
} from "@/utils/livescores/delayBuffer";

/**
 * The live scores entry in a multiview tile's menu and the sheet it opens:
 * the spoiler delay a step at a time, from the remote, without leaving the
 * game, and scores off or on. On a TV it is the app's TV menu.
 */
export const useLiveScoresMenu = () => {
  const { t } = useTranslation();
  const { showActionSheetWithOptions } = useActionSheet();
  const { showOptions } = useTVOptionModal();
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
    const choices: { label: string; run: () => void }[] = [
      {
        label: t("livescores.delay_more"),
        run: () =>
          updateSettings({
            liveScoresDelaySeconds: stepDelaySeconds(delay, 1),
          }),
      },
      {
        label: t("livescores.delay_less"),
        run: () =>
          updateSettings({
            liveScoresDelaySeconds: stepDelaySeconds(delay, -1),
          }),
      },
      {
        label: enabled ? t("livescores.turn_off") : t("livescores.turn_on"),
        run: () => updateSettings({ liveScoresEnabled: !enabled }),
      },
    ];
    if (Platform.isTV) {
      // The app's TV menu, as the tile menu uses: on a Fire TV the phone
      // action sheet is a white panel with no title and no visible focus.
      showOptions<number>({
        title: label,
        options: choices.map((choice, index) => ({
          label: choice.label,
          value: index,
          selected: false,
        })),
        onSelect: (index) => choices[index]?.run(),
      });
      return;
    }
    const options = [...choices.map((c) => c.label), t("common.cancel")];
    showActionSheetWithOptions(
      {
        options,
        message: t("livescores.delay_message", { seconds: delay }),
        cancelButtonIndex: options.length - 1,
      },
      (index) => {
        if (index !== undefined) choices[index]?.run();
      },
    );
  }, [
    delay,
    enabled,
    label,
    showActionSheetWithOptions,
    showOptions,
    t,
    updateSettings,
  ]);

  return { label, open };
};
