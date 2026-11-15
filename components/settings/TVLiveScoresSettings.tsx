import { useTranslation } from "react-i18next";
import { TVSettingsStepper, TVSettingsToggle } from "@/components/tv";
import { LIVE_SCORES_DELAY_DEFAULT_S } from "@/constants/LiveScores";
import { useSettings } from "@/utils/atoms/settings";
import {
  clampDelaySeconds,
  stepDelaySeconds,
} from "@/utils/livescores/delayBuffer";

/**
 * The TV's live scores rows, under the multiview quality: scores on or off,
 * and the spoiler delay a 5 s step at a time with the remote.
 */
export function TVLiveScoresSettings() {
  const { t } = useTranslation();
  const { settings, updateSettings, pluginSettings } = useSettings();
  const enabled = settings.liveScoresEnabled !== false;
  const delay = clampDelaySeconds(
    settings.liveScoresDelaySeconds ?? LIVE_SCORES_DELAY_DEFAULT_S,
  );

  return (
    <>
      <TVSettingsToggle
        label={t("livescores.settings_enabled")}
        value={enabled}
        disabledByAdmin={pluginSettings?.liveScoresEnabled?.locked}
        onToggle={(value) => updateSettings({ liveScoresEnabled: value })}
      />
      {enabled && (
        <TVSettingsStepper
          label={t("livescores.settings_delay")}
          value={delay}
          formatValue={(seconds) =>
            t("livescores.settings_delay_value", { seconds })
          }
          disabledByAdmin={pluginSettings?.liveScoresDelaySeconds?.locked}
          onIncrease={() =>
            updateSettings({
              liveScoresDelaySeconds: stepDelaySeconds(delay, 1),
            })
          }
          onDecrease={() =>
            updateSettings({
              liveScoresDelaySeconds: stepDelaySeconds(delay, -1),
            })
          }
        />
      )}
    </>
  );
}
