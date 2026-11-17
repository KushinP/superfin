import {
  ActivityIndicator,
  type ActivityIndicatorProps,
  Platform,
} from "react-native";
import { Colors } from "@/constants/Colors";

interface Props extends ActivityIndicatorProps {}

export const Loader: React.FC<Props> = ({ ...props }) => {
  return (
    <ActivityIndicator
      // No accent on TV (docs/conventions/tv.md), and a spinner that reads
      // from across the room.
      size={Platform.isTV ? "large" : "small"}
      color={Platform.isTV || Platform.OS === "ios" ? "white" : Colors.primary}
      {...props}
    />
  );
};
