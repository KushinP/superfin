import { Ionicons } from "@expo/vector-icons";
import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { getUserViewApi } from "@jellyfin/sdk/lib/utils/api";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { usePathname, useSegments } from "expo-router";
import { useAtomValue } from "jotai";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/common/Text";
import { itemRouter } from "@/components/common/TouchableItemRouter";
import { libraryIcons } from "@/components/library/LibraryItemCard";
import { Colors, MacSidebarColors } from "@/constants/Colors";
import { MAC_SIDEBAR_WIDTH } from "@/constants/Mac";
import useRouter from "@/hooks/useAppRouter";
import { useLiveTvAvailable } from "@/hooks/useLiveTvAvailable";
import { apiAtom, userAtom } from "@/utils/atoms/api";
import { useSettings } from "@/utils/atoms/settings";
import { eventBus } from "@/utils/eventBus";
import { type MacSidebarItem, macSidebarItems } from "@/utils/macSidebar";

type IconName = MacSidebarItem["icon"];

const outline = (icon: IconName) => `${icon}-outline` as IconName;

const SidebarRow = ({
  testID,
  icon,
  title,
  active,
  onPress,
}: {
  testID: string;
  icon: IconName;
  title: string;
  active: boolean;
  onPress: () => void;
}) => {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      testID={testID}
      accessibilityRole='button'
      accessibilityState={{ selected: active }}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[
        styles.row,
        active && styles.rowActive,
        !active && hovered && styles.rowHovered,
      ]}
    >
      <Ionicons
        name={active ? icon : outline(icon)}
        size={17}
        color={active ? Colors.primary : MacSidebarColors.textMuted}
      />
      <Text
        numberOfLines={1}
        style={[styles.rowText, active && styles.rowTextActive]}
      >
        {title}
      </Text>
    </Pressable>
  );
};

/**
 * The user's libraries, as the Library page lists them: the same query, with
 * hidden libraries and books left out.
 */
const useSidebarLibraries = (): BaseItemDto[] => {
  const api = useAtomValue(apiAtom);
  const user = useAtomValue(userAtom);
  const { settings } = useSettings();
  const { data } = useQuery({
    queryKey: ["user-views", user?.Id],
    queryFn: async () => {
      const response = await getUserViewApi(api!).getUserViews({
        userId: user?.Id,
      });
      return response.data.Items || null;
    },
    staleTime: 60,
    enabled: !!api && !!user?.Id,
  });
  return (
    data?.filter(
      (library) =>
        !settings?.hiddenLibraries?.includes(library.Id!) &&
        library.CollectionType !== "books" &&
        // Live TV has its own section above.
        library.CollectionType !== "livetv",
    ) ?? []
  );
};

/**
 * The Mac's sidebar, always open beside the tabs: the native tab bar is
 * hidden there. Apple's sidebar-adaptable style did not lay out after its
 * toggle in a Mac window (see usesNativeSidebar), so this one is drawn by the
 * app. The sections, then the libraries themselves, with Settings at the
 * foot as in a Mac app.
 */
export const MacSidebar = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const segments = useSegments() as string[];
  const pathname = usePathname();
  const { settings } = useSettings();
  const insets = useSafeAreaInsets();
  const libraries = useSidebarLibraries();
  const liveTv = useLiveTvAvailable();
  const current = segments[2];
  const openLibrary = libraries.find(
    (library) => current === "(libraries)" && pathname.includes(library.Id!),
  );

  // Favorites and Watchlists share More's group, so a section in it is the
  // one on screen only when its own page is.
  const isOpen = (item: MacSidebarItem) =>
    item.segment === current &&
    (!item.page || segments[3] === item.page) &&
    !openLibrary;

  const open = (item: MacSidebarItem) => {
    if (isOpen(item)) {
      // The tab bar's own tabs do this on a second press.
      if (item.segment === "(home)") eventBus.emit("scrollToTop");
      if (item.segment === "(search)") eventBus.emit("searchTabPressed");
      return;
    }
    router.navigate(item.href as never);
  };

  return (
    <View
      testID='mac-sidebar'
      style={[styles.sidebar, { paddingTop: insets.top + 14 }]}
    >
      <View style={styles.brand}>
        <Image
          source={require("@/assets/images/icon.png")}
          style={styles.logo}
        />
        <Text style={styles.brandText}>SuperFin</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {macSidebarItems(settings, liveTv).map((item) => (
          <SidebarRow
            key={item.id}
            testID={`mac-sidebar-${item.id}`}
            icon={item.icon}
            title={t(item.titleKey)}
            active={isOpen(item)}
            onPress={() => open(item)}
          />
        ))}

        {libraries.length > 0 && (
          <>
            <Text style={styles.heading}>{t("mac_sidebar.libraries")}</Text>
            {libraries.map((library) => (
              <SidebarRow
                key={library.Id}
                testID={`mac-sidebar-library-${library.Id}`}
                icon={
                  (libraryIcons[library.CollectionType!] ||
                    "folder") as IconName
                }
                title={library.Name ?? ""}
                active={openLibrary?.Id === library.Id}
                onPress={() =>
                  router.navigate(itemRouter(library, "(libraries)") as never)
                }
              />
            ))}
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <SidebarRow
          testID='mac-sidebar-settings'
          icon='settings'
          title={t("tabs.settings")}
          active={false}
          onPress={() => router.push("/(auth)/settings" as never)}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sidebar: {
    width: MAC_SIDEBAR_WIDTH,
    paddingHorizontal: 10,
    paddingBottom: 12,
    backgroundColor: MacSidebarColors.background,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: MacSidebarColors.border,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 8,
    paddingBottom: 18,
  },
  logo: { width: 28, height: 28, borderRadius: 7 },
  brandText: {
    color: MacSidebarColors.text,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  scroll: { flex: 1 },
  scrollContent: { gap: 2, paddingBottom: 12 },
  heading: {
    color: MacSidebarColors.heading,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingHorizontal: 10,
    paddingTop: 18,
    paddingBottom: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  rowActive: { backgroundColor: MacSidebarColors.itemActive },
  rowHovered: { backgroundColor: MacSidebarColors.itemHovered },
  rowText: {
    flex: 1,
    color: MacSidebarColors.textMuted,
    fontSize: 14,
    fontWeight: "500",
  },
  rowTextActive: { color: MacSidebarColors.text, fontWeight: "600" },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: MacSidebarColors.border,
    paddingTop: 8,
  },
});
