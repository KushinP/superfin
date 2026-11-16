import { fireEvent, render, screen } from "@testing-library/react-native";
import { createStore, Provider } from "jotai";
import type { ReactElement } from "react";
import {
  type LiveScoresView,
  liveScoresViewAtom,
} from "@/utils/atoms/liveScores";
import recorded from "@/utils/livescores/__fixtures__/scoreboard-2026-11-15.json";
import { parseScoreboard } from "@/utils/livescores/espnScoreboard";
import { PlayerScoresButton, PlayerScoresRail } from "./PlayerScores";

// The real button pulls in the TV focus animation and its settings; here it
// only has to be pressable.
jest.mock("@/components/tv/TVControlButton", () => {
  const { Pressable } = jest.requireActual("react-native");
  return {
    TVControlButton: ({ onPress }: { onPress: () => void }) => (
      <Pressable testID='tv-control-button' onPress={onPress} />
    ),
  };
});
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${Object.values(values).join(",")}` : key,
  }),
}));

// KC @ ATL is being played.
const board = parseScoreboard(JSON.parse(JSON.stringify(recorded)))!;
const view: LiveScoresView = {
  status: "ok",
  waiting: false,
  followed: [],
  others: board,
  delaySeconds: 30,
};

let store = createStore();
const renderWith = (ui: ReactElement, scores: LiveScoresView | null) => {
  store = createStore();
  store.set(liveScoresViewAtom, scores);
  return render(<Provider store={store}>{ui}</Provider>);
};

describe("the TV player's live scores", () => {
  // S2: single view had no scores at all (Fire TV, 2026-11-15).
  test("a live channel's controls show the rail", async () => {
    await renderWith(<PlayerScoresRail isLiveTV width={1824} />, view);
    expect(screen.getByTestId("scores-rail")).toBeTruthy();
    expect(screen.getByText("KC")).toBeTruthy();
  });

  test("a live channel's controls offer Scores, which opens the scores screen", async () => {
    const onPress = jest.fn();
    await renderWith(
      <PlayerScoresButton
        isLiveTV
        onPress={onPress}
        focusable
        hasTVPreferredFocus={false}
      />,
      view,
    );
    expect(screen.getByTestId("player-scores-button")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("tv-control-button"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  // S9
  test("a movie: no rail and no Scores button", async () => {
    await renderWith(
      <>
        <PlayerScoresRail isLiveTV={false} width={1824} />
        <PlayerScoresButton
          isLiveTV={false}
          onPress={jest.fn()}
          focusable
          hasTVPreferredFocus={false}
        />
      </>,
      view,
    );
    expect(screen.queryByTestId("player-scores-rail")).toBeNull();
    expect(screen.queryByTestId("player-scores-button")).toBeNull();
  });

  // Kush, 2026-11-16: turning scores off must leave a way to turn them on.
  test("scores off: no rail, but the Scores button stays", async () => {
    await renderWith(
      <>
        <PlayerScoresRail isLiveTV width={1824} />
        <PlayerScoresButton
          isLiveTV
          onPress={jest.fn()}
          focusable
          hasTVPreferredFocus={false}
        />
      </>,
      { ...view, status: "off", followed: [], others: [] },
    );
    expect(screen.queryByTestId("scores-rail")).toBeNull();
    expect(screen.getByTestId("player-scores-button")).toBeTruthy();
  });

  test("not on a live channel's screen at all (no view): nothing", async () => {
    await renderWith(
      <>
        <PlayerScoresRail isLiveTV width={1824} />
        <PlayerScoresButton
          isLiveTV
          onPress={jest.fn()}
          focusable
          hasTVPreferredFocus={false}
        />
      </>,
      null,
    );
    expect(screen.queryByTestId("player-scores-rail")).toBeNull();
    expect(screen.queryByTestId("player-scores-button")).toBeNull();
  });
});
