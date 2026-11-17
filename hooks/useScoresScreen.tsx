import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useCallback } from "react";
import { Platform, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScoresScreenContent } from "@/components/multiview/ScoresScreenContent";
import useRouter from "@/hooks/useAppRouter";
import { useGlobalModal } from "@/providers/GlobalModalProvider";

function ScoresSheet({
  onClose,
  bottomInset,
}: {
  onClose: () => void;
  bottomInset: number;
}) {
  const { height: windowHeight } = useWindowDimensions();
  return (
    // The shared sheet sizes itself to its content (upstream dropped its snap
    // points), so the scores list caps itself at the bottom half.
    <BottomSheetScrollView
      style={{ maxHeight: windowHeight / 2 }}
      contentContainerStyle={{ padding: 16, paddingBottom: bottomInset + 24 }}
    >
      <ScoresScreenContent onClose={onClose} />
    </BottomSheetScrollView>
  );
}

/**
 * Opens the scores screen over multiview: a sheet over the bottom half on
 * phones, and on TV a route that looks like one, where anything modal has
 * to be a route to get the remote's Back. Either way multiview stays
 * mounted underneath, so its tiles keep playing.
 */
export const useScoresScreen = () => {
  const { showModal, hideModal } = useGlobalModal();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return useCallback(() => {
    if (Platform.isTV) {
      router.push("/(auth)/tv-scores-modal");
      return;
    }
    showModal(<ScoresSheet onClose={hideModal} bottomInset={insets.bottom} />);
  }, [showModal, hideModal, router, insets.bottom]);
};
