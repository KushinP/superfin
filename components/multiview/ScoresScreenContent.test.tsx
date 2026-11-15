import { render, screen } from "@testing-library/react-native";
import { createStore, Provider } from "jotai";
import type { ReactNode } from "react";
import {
  type LiveScoresView,
  liveScoresViewAtom,
} from "@/utils/atoms/liveScores";
import { ScoresScreenContent } from "./ScoresScreenContent";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${Object.values(values).join(",")}` : key,
  }),
}));
jest.mock("@/utils/atoms/settings", () => ({
  useSettings: () => ({
    settings: { liveScoresEnabled: true, liveScoresDelaySeconds: 30 },
    updateSettings: jest.fn(),
  }),
}));

const view: LiveScoresView = {
  status: "unavailable",
  reason: "network",
  pinned: [],
  others: [],
  delaySeconds: 30,
};

const withStore = (store: ReturnType<typeof createStore>) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  };

describe("ScoresScreenContent", () => {
  test("shows what multiview's poller last wrote, and follows it", async () => {
    const store = createStore();
    store.set(liveScoresViewAtom, view);
    await render(<ScoresScreenContent onClose={jest.fn()} />, {
      wrapper: withStore(store),
    });
    expect(screen.getByText("livescores.unavailable_network")).toBeTruthy();
  });

  // Scores turned off from the screen itself, or multiview gone: nothing
  // is left to show, so the screen closes rather than sit empty.
  test("closes itself when there is no longer anything to show", async () => {
    const store = createStore();
    store.set(liveScoresViewAtom, null);
    const onClose = jest.fn();
    await render(<ScoresScreenContent onClose={onClose} />, {
      wrapper: withStore(store),
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
