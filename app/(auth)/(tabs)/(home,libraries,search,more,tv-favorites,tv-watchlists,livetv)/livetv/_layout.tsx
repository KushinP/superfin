import { Slot, Stack } from "expo-router";
import TopTabs from "expo-router/js-top-tabs";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";
import {
  LIVE_TV_TABS,
  liveTvTabBarOptions,
  visibleLiveTvTabs,
} from "@/components/livetv/liveTvTabs";

// Opens on Programs. Expo Router 58 dropped initialRouteName; without an
// anchor the tabs open on the first route by name, Channels.
export const unstable_settings = { anchor: "programs" };

const Layout = () => {
  const { t } = useTranslation();
  const visible = new Set<string>(visibleLiveTvTabs().map((tab) => tab.name));

  // On TV, skip the Material Top Tab Navigator and render children directly
  // The TV version handles its own tab navigation internally
  if (Platform.isTV) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <Slot />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t("live_tv.title") }} />
      <TopTabs keyboardDismissMode='none' screenOptions={liveTvTabBarOptions}>
        {LIVE_TV_TABS.map((tab) =>
          visible.has(tab.name) ? (
            <TopTabs.Screen
              key={tab.name}
              name={tab.name}
              options={{ title: t(tab.label) }}
            />
          ) : (
            // A route with no tab: Protected keeps it off the bar and out of
            // the swipe order without deleting its file.
            <TopTabs.Protected key={tab.name} guard={false}>
              <TopTabs.Screen name={tab.name} />
            </TopTabs.Protected>
          ),
        )}
      </TopTabs>
    </>
  );
};

export default Layout;
