import { render, screen } from "@testing-library/react-native";

// The TV scores route: the panel over multiview, closed by the remote's
// Back. Found missing at /test-gate for R5 ("Back closes it").

const mockBack = jest.fn();
jest.mock("@/hooks/useAppRouter", () => ({
  __esModule: true,
  default: () => ({ back: mockBack, push: jest.fn() }),
}));
let mockBackHandler: (() => boolean) | null = null;
jest.mock("@/hooks/useTVBackPress", () => ({
  useTVBackPress: (handler: () => boolean) => {
    mockBackHandler = handler;
  },
}));
let mockContentClose: (() => void) | null = null;
jest.mock("@/components/multiview/ScoresScreenContent", () => ({
  ScoresScreenContent: ({ onClose }: { onClose: () => void }) => {
    const { Text } = jest.requireActual("react-native");
    mockContentClose = onClose;
    return <Text>scores-content</Text>;
  },
}));

// After the mocks, which it imports.
const TVScoresModal = jest.requireActual(
  "@/app/(auth)/tv-scores-modal",
).default;

describe("TV scores route", () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockBackHandler = null;
    mockContentClose = null;
  });

  test("shows the scores screen's content", async () => {
    await render(<TVScoresModal />);
    expect(screen.getByText("scores-content")).toBeTruthy();
  });

  // R5
  test("the remote's Back closes it, and is handled here", async () => {
    await render(<TVScoresModal />);
    expect(mockBackHandler?.()).toBe(true);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  test("closes when its content has nothing left to show", async () => {
    await render(<TVScoresModal />);
    mockContentClose?.();
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
