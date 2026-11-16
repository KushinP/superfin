import { BlurView } from "expo-blur";
import { useCallback, useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  TVFocusGuideView,
} from "react-native";
import { ScoresScreenContent } from "@/components/multiview/ScoresScreenContent";
import useRouter from "@/hooks/useAppRouter";
import { useTVBackPress } from "@/hooks/useTVBackPress";
import { scaleSize } from "@/utils/scaleSize";

/**
 * The scores screen on TV: a panel over the bottom half of multiview, whose
 * tiles keep playing above it. A route and not an overlay: only a route
 * gets the remote's Back button. Multiview gives the focus back to the
 * button that opened it once this closes.
 */
export default function TVScoresModal() {
  const router = useRouter();
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(200)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 250,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [overlayOpacity, sheetTranslateY]);

  const close = useCallback(() => router.back(), [router]);

  useTVBackPress(() => {
    close();
    return true;
  }, [close]);

  return (
    <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
      <Animated.View style={{ transform: [{ translateY: sheetTranslateY }] }}>
        <BlurView intensity={80} tint='dark' style={styles.blur}>
          <TVFocusGuideView
            autoFocus
            trapFocusUp
            trapFocusDown
            trapFocusLeft
            trapFocusRight
            style={styles.content}
          >
            <ScoresScreenContent onClose={close} />
          </TVFocusGuideView>
        </BlurView>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    // Lighter than the other TV sheets: the games above stay watchable.
    backgroundColor: "rgba(0, 0, 0, 0.25)",
    justifyContent: "flex-end",
  },
  blur: {
    minHeight: "50%",
    borderTopLeftRadius: scaleSize(24),
    borderTopRightRadius: scaleSize(24),
    overflow: "hidden",
    // Android has no blur behind this, only a tint, and scores over live
    // video can't be read through a tint.
    backgroundColor:
      Platform.OS === "android" ? "rgba(18, 18, 20, 0.92)" : undefined,
  },
  content: {
    paddingHorizontal: scaleSize(60),
    paddingTop: scaleSize(32),
    paddingBottom: scaleSize(40),
    overflow: "visible",
  },
});
