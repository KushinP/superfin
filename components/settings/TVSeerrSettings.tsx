import { useMutation, useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text } from "@/components/common/Text";
import { TVInput } from "@/components/login/TVInput";
import {
  TVSectionHeader,
  TVSettingsOptionButton,
  TVSettingsTextInput,
} from "@/components/tv";
import { useScaledTVTypography } from "@/constants/TVTypography";
import { useIntegrationHeaders } from "@/hooks/useIntegrationHeaders";
import { useSeerr } from "@/hooks/useSeerr";
import { apiAtom, userAtom } from "@/utils/atoms/api";
import { useSettings } from "@/utils/atoms/settings";
import { writeDebugLog } from "@/utils/log";
import {
  isQuickConnectEnabled,
  seerrPasswordNeeded,
} from "@/utils/seerrQuickConnect";
import { signInToSeerr } from "@/utils/seerrSignIn";
import { store } from "@/utils/store";

/**
 * The TV's Seerr section: type any Seerr address with the remote and sign in
 * with the Jellyfin account, through the phone's own sign-in (Quick Connect,
 * then the password). Until now a TV only got Seerr from the server's
 * Streamyfin plugin, so on a Fire TV without it Seerr never turned on.
 * Once signed in, the TV's existing Seerr screens appear on their own.
 */
export function TVSeerrSettings() {
  const { t } = useTranslation();
  const typography = useScaledTVTypography();
  const { seerrUser, setSeerrUser, clearAllSeerrData } = useSeerr();
  const user = useAtomValue(userAtom);
  const api = useAtomValue(apiAtom);
  const { settings, updateSettings, pluginSettings } = useSettings();
  const urlLocked = pluginSettings?.seerrServerUrl?.locked === true;
  const apiKeyLocked = pluginSettings?.seerrApiKey?.locked === true;
  const { headers: customHeaders } = useIntegrationHeaders("seerr");

  const [typedUrl, setTypedUrl] = useState(settings?.seerrServerUrl ?? "");
  const [password, setPassword] = useState("");
  // Kept through the next attempt, so a password field that appeared after
  // a failure stays while the retry runs.
  const [signInFailed, setSignInFailed] = useState(false);
  const [emptyAddress, setEmptyAddress] = useState(false);

  const { data: quickConnectEnabled } = useQuery({
    queryKey: ["jellyfin", "quickConnectEnabled", api?.basePath],
    queryFn: async () => (api ? isQuickConnectEnabled(api) : false),
    enabled: !!api && !seerrUser,
    staleTime: 5 * 60 * 1000,
  });
  const askPassword =
    !apiKeyLocked && seerrPasswordNeeded(quickConnectEnabled, signInFailed);

  const signIn = useMutation({
    mutationFn: () =>
      signInToSeerr({
        user,
        api,
        typedUrl: typedUrl.trim(),
        resolvedUrl: undefined,
        savedUrl: settings?.seerrServerUrl,
        urlLocked,
        customHeaders,
        apiKey: apiKeyLocked ? settings?.seerrApiKey : undefined,
        apiKeyLocked,
        password,
        askedForPassword: askPassword,
        currentUserId: () => store.get(userAtom)?.Id,
      }),
    onSuccess: ({ user: signedIn, url, apiKey }) => {
      setSignInFailed(false);
      setSeerrUser(signedIn);
      setTypedUrl(url);
      updateSettings({ seerrServerUrl: url, seerrApiKey: apiKey });
    },
    onError: () => setSignInFailed(true),
    onSettled: () => setPassword(""),
  });

  const signOut = () => {
    clearAllSeerrData().finally(() => {
      setSeerrUser(undefined);
      setSignInFailed(false);
      if (!urlLocked) setTypedUrl("");
    });
  };

  const shownUrl = urlLocked ? (settings?.seerrServerUrl ?? "") : typedUrl;

  return (
    <>
      <TVSectionHeader title='Seerr' />
      {seerrUser ? (
        <>
          <TVSettingsOptionButton
            label={t("home.settings.plugins.seerr.server_url")}
            value={settings?.seerrServerUrl ?? ""}
            onPress={() => {}}
            disabled
          />
          <TVSettingsOptionButton
            label={t("home.settings.plugins.seerr.total_media_requests")}
            value={String(seerrUser.requestCount ?? 0)}
            onPress={() => {}}
            disabled
          />
          <TVSettingsOptionButton
            label={t("home.settings.plugins.seerr.reset_seerr_config_button")}
            value=''
            onPress={signOut}
          />
        </>
      ) : (
        <>
          <Text
            style={{
              fontSize: typography.callout,
              color: "#9CA3AF",
              marginBottom: 8,
            }}
          >
            {t("home.settings.plugins.seerr.server_url")}
          </Text>
          {urlLocked && (
            <Text
              style={{
                fontSize: typography.callout,
                color: "#EF4444",
                marginBottom: 8,
              }}
            >
              {t("home.settings.disabled_by_admin")}
            </Text>
          )}
          {/* The login screen's field, in URL mode: the settings text field
              never passed the Fire TV keyboard's text on (2026-11-16, seen
              with ADB: the field showed the address, Login stayed off),
              while this one is how the TV signs in to Jellyfin. */}
          <TVInput
            label={t("home.settings.plugins.seerr.server_url")}
            accessibilityLabel={t("home.settings.plugins.seerr.server_url")}
            value={shownUrl}
            placeholder={t(
              "home.settings.plugins.seerr.server_url_placeholder",
            )}
            onChangeText={(text) => {
              writeDebugLog("Seerr TV: address typed", {
                length: text.length,
              });
              setEmptyAddress(false);
              setTypedUrl(text);
            }}
            onEndEditing={(e) => {
              const text = e.nativeEvent.text;
              writeDebugLog("Seerr TV: address editing ended", {
                length: text?.length ?? -1,
                screenHad: typedUrl.length,
              });
              if (text !== undefined && text !== typedUrl) setTypedUrl(text);
            }}
            keyboardType='url'
            autoCapitalize='none'
            autoCorrect={false}
            textContentType='URL'
            returnKeyType='done'
            editable={!urlLocked && !signIn.isPending}
            disabled={urlLocked || signIn.isPending}
          />
          {askPassword && (
            <TVSettingsTextInput
              label={t("home.settings.plugins.seerr.password")}
              value={password}
              placeholder={t(
                "home.settings.plugins.seerr.password_placeholder",
                { username: user?.Name },
              )}
              onChangeText={setPassword}
              secureTextEntry
              disabled={signIn.isPending}
            />
          )}
          {/* Never disabled for an empty address: a disabled row is
              skipped by the remote, which left no way to reach Login. */}
          <TVSettingsOptionButton
            label={t("home.settings.plugins.seerr.login_button")}
            value=''
            onPress={() => {
              if (!shownUrl.trim()) {
                setEmptyAddress(true);
                return;
              }
              signIn.mutate();
            }}
            disabled={signIn.isPending}
          />
          {emptyAddress && (
            <Text
              style={{
                fontSize: typography.callout,
                color: "#F87171",
                marginBottom: 12,
              }}
            >
              {t("home.settings.plugins.seerr.enter_address")}
            </Text>
          )}
          {signIn.isError && (
            <Text
              style={{
                fontSize: typography.callout,
                color: "#F87171",
                marginBottom: 12,
              }}
            >
              {t("seerr.failed_to_login")}
            </Text>
          )}
        </>
      )}
    </>
  );
}
