import { useAtomValue } from "jotai";
import { useEffect } from "react";
import { liveScoresViewAtom } from "@/utils/atoms/liveScores";
import { ScoresPanel } from "./ScoresPanel";

/**
 * The scores screen's body, on the phone sheet and the TV route alike. It
 * reads what multiview's poller last wrote, so it keeps updating while open.
 * With nothing left to show (scores turned off from this screen, or
 * multiview gone) it closes rather than sit empty.
 */
export function ScoresScreenContent({ onClose }: { onClose: () => void }) {
  const view = useAtomValue(liveScoresViewAtom);
  useEffect(() => {
    if (!view) onClose();
  }, [view, onClose]);
  return view ? <ScoresPanel view={view} /> : null;
}
