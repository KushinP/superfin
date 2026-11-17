import React from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleProp,
  useWindowDimensions,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/common/Text";
import { useTVFocusAnimation } from "@/components/tv/hooks/useTVFocusAnimation";
import {
  TV_NAV_BAR_FOCUS_ROOM,
  TV_NAV_BAR_SLIDE_MS,
} from "@/constants/TVNavBar";
import { TVPadding } from "@/constants/TVSizes";
import { useScaledTVTypography } from "@/constants/TVTypography";
import { scaleSize } from "@/utils/scaleSize";
import { useNavBarPresence } from "./hooks/useNavBarPresence";
import { tvNavBarTopInset } from "./tvNavBarInset";

export interface TVNavBarTab {
  key: string;
  label: string;
}

export interface TVNavBarProps {
  tabs: TVNavBarTab[];
  activeTabKey: string;
  onTabChange: (key: string) => void;
  style?: StyleProp<ViewStyle>;
}

const TVNavBarTabItem: React.FC<{
  label: string;
  isActive: boolean;
  onSelect: () => void;
  onLayout: (e: {
    nativeEvent: { layout: { x: number; width: number } };
  }) => void;
  hasTVPreferredFocus: boolean;
  onFocusChange: (focused: boolean) => void;
}> = ({
  label,
  isActive,
  onSelect,
  onLayout,
  hasTVPreferredFocus,
  onFocusChange,
}) => {
  const typography = useScaledTVTypography();
  const { focused, handleFocus, handleBlur, animatedStyle } =
    useTVFocusAnimation({
      scaleAmount: 1.05,
      duration: 120,
      onFocus: () => onFocusChange(true),
      onBlur: () => onFocusChange(false),
    });

  const bg = focused
    ? "rgba(255, 255, 255, 0.95)"
    : isActive
      ? "rgba(255, 255, 255, 0.15)"
      : "transparent";

  const textColor = focused
    ? "#000"
    : isActive
      ? "#fff"
      : "rgba(255, 255, 255, 0.7)";

  return (
    <Pressable
      onPress={onSelect}
      onFocus={handleFocus}
      onBlur={handleBlur}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onLayout={onLayout}
    >
      <Animated.View
        style={[
          animatedStyle,
          {
            backgroundColor: bg,
            borderRadius: scaleSize(24),
            borderWidth: isActive && !focused ? 1 : 0,
            borderColor: "rgba(255, 255, 255, 0.3)",
            paddingHorizontal: scaleSize(28),
            paddingVertical: scaleSize(14),
          },
        ]}
      >
        <Text
          style={{
            fontSize: typography.heading,
            color: textColor,
            fontWeight: isActive || focused ? "600" : "400",
          }}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
};

export const TVNavBar: React.FC<TVNavBarProps> = ({
  tabs,
  activeTabKey,
  onTabChange,
  style,
}) => {
  const scrollRef = React.useRef<ScrollViewInstance>(null);
  const tabLayouts = React.useRef<Record<string, { x: number; width: number }>>(
    {},
  );
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { visible, onItemFocus, onItemBlur } = useNavBarPresence();
  const onFocusChange = React.useCallback(
    (focused: boolean) => (focused ? onItemFocus() : onItemBlur()),
    [onItemFocus, onItemBlur],
  );
  const shown = React.useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    Animated.timing(shown, {
      toValue: visible ? 1 : 0,
      duration: TV_NAV_BAR_SLIDE_MS,
      useNativeDriver: true,
    }).start();
  }, [visible, shown]);

  const handleTabLayout = React.useCallback(
    (key: string) =>
      (e: { nativeEvent: { layout: { x: number; width: number } } }) => {
        tabLayouts.current[key] = e.nativeEvent.layout;
      },
    [],
  );

  const handleTabChange = React.useCallback(
    (key: string) => {
      onTabChange(key);

      const layout = tabLayouts.current[key];
      if (layout && scrollRef.current) {
        scrollRef.current.scrollTo({
          x: Math.max(0, layout.x - TVPadding.horizontal / 2),
          animated: true,
        });
      }
    },
    [onTabChange],
  );

  if (tabs.length === 0) return null;

  return (
    // Hidden, it stays focusable: Up from the page still lands on a tab and
    // brings it back.
    <Animated.View
      style={[
        {
          paddingTop: tvNavBarTopInset(windowHeight, insets.top),
          paddingBottom: 8,
          opacity: shown,
          transform: [
            {
              translateY: shown.interpolate({
                inputRange: [0, 1],
                outputRange: [-scaleSize(120), 0],
              }),
            },
          ],
        },
        style,
      ]}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps='handled'
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          gap: scaleSize(12),
          // Room for a focused tab's 1.05 scale: a horizontal ScrollView
          // clips on Android, and the tab lost its top edge.
          paddingVertical: scaleSize(TV_NAV_BAR_FOCUS_ROOM),
        }}
      >
        {tabs.map((tab) => (
          <TVNavBarTabItem
            key={tab.key}
            label={tab.label}
            isActive={tab.key === activeTabKey}
            onSelect={() => handleTabChange(tab.key)}
            onLayout={handleTabLayout(tab.key)}
            hasTVPreferredFocus={tab.key === activeTabKey}
            onFocusChange={onFocusChange}
          />
        ))}
      </ScrollView>
    </Animated.View>
  );
};
