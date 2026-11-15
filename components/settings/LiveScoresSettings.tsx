import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { SettingSwitch } from "@/components/common/SettingSwitch";
import { Text } from "@/components/common/Text";
import { ListItem } from "@/components/list/ListItem";
import { PlatformDropdown } from "@/components/PlatformDropdown";
import { LIVE_SCORES_DELAY_DEFAULT_S } from "@/constants/LiveScores";
import { useSettings } from "@/utils/atoms/settings";
import {
  clampDelaySeconds,
  delayChoices,
} from "@/utils/livescores/delayBuffer";

/**
 * The phone's live scores rows, under the multiview quality: scores on or
 * off, and the spoiler delay. The tile menu changes the same two settings.
 */
export function LiveScoresSettings() {
  const { t } = useTranslation();
  const { settings, updateSettings, pluginSettings } = useSettings();
  const enabled = settings.liveScoresEnabled !== false;
  const delay = clampDelaySeconds(
    settings.liveScoresDelaySeconds ?? LIVE_SCORES_DELAY_DEFAULT_S,
  );

  const delayGroups = useMemo(
    () => [
      {
        options: delayChoices().map((seconds) => ({
          type: "radio" as const,
          label: t("livescores.settings_delay_value", { seconds }),
          value: String(seconds),
          selected: seconds === delay,
          onPress: () => updateSettings({ liveScoresDelaySeconds: seconds }),
        })),
      },
    ],
    [delay, t, updateSettings],
  );

  return (
    <>
      <ListItem
        title={t("livescores.settings_enabled")}
        disabled={pluginSettings?.liveScoresEnabled?.locked}
      >
        <SettingSwitch
          value={enabled}
          disabled={pluginSettings?.liveScoresEnabled?.locked}
          onValueChange={(value) =>
            updateSettings({ liveScoresEnabled: value })
          }
        />
      </ListItem>
      {enabled && (
        <ListItem
          title={t("livescores.settings_delay")}
          disabled={pluginSettings?.liveScoresDelaySeconds?.locked}
        >
          <PlatformDropdown
            groups={delayGroups}
            trigger={
              <View className='flex flex-row items-center justify-between pl-3 py-1.5'>
                <Text className='mr-1 text-[#8E8D91]'>
                  {t("livescores.settings_delay_value", { seconds: delay })}
                </Text>
                <Ionicons
                  name='chevron-expand-sharp'
                  size={18}
                  color='#5A5960'
                />
              </View>
            }
            title={t("livescores.settings_delay")}
          />
        </ListItem>
      )}
    </>
  );
}
