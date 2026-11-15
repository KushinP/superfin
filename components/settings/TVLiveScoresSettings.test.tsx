import { fireEvent, render, screen } from "@testing-library/react-native";
import { TVLiveScoresSettings } from "./TVLiveScoresSettings";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${Object.values(values).join(",")}` : key,
  }),
}));

// The TV rows as plain buttons, carrying the props the screen hands them.
jest.mock("@/components/tv", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  return {
    TVSettingsToggle: ({
      label,
      value,
      onToggle,
    }: {
      label: string;
      value: boolean;
      onToggle: (v: boolean) => void;
    }) => (
      <Pressable testID='toggle' onPress={() => onToggle(!value)}>
        <Text>{`${label}=${value}`}</Text>
      </Pressable>
    ),
    TVSettingsStepper: ({
      label,
      value,
      formatValue,
      onIncrease,
      onDecrease,
    }: {
      label: string;
      value: number;
      formatValue: (v: number) => string;
      onIncrease: () => void;
      onDecrease: () => void;
    }) => (
      <>
        <Text>{`${label}=${formatValue(value)}`}</Text>
        <Pressable testID='more' onPress={onIncrease} />
        <Pressable testID='less' onPress={onDecrease} />
      </>
    ),
  };
});

let mockSettings: Record<string, unknown> = {};
const mockUpdateSettings = jest.fn();
jest.mock("@/utils/atoms/settings", () => ({
  useSettings: () => ({
    settings: mockSettings,
    updateSettings: mockUpdateSettings,
    pluginSettings: undefined,
  }),
}));

describe("TVLiveScoresSettings", () => {
  beforeEach(() => {
    mockSettings = { liveScoresEnabled: true, liveScoresDelaySeconds: 30 };
    mockUpdateSettings.mockReset();
  });

  test("shows the switch and the delay in force", async () => {
    await render(<TVLiveScoresSettings />);
    expect(screen.getByText("livescores.settings_enabled=true")).toBeTruthy();
    expect(
      screen.getByText(
        "livescores.settings_delay=livescores.settings_delay_value:30",
      ),
    ).toBeTruthy();
  });

  test("steps the delay 5 s at a time from the remote", async () => {
    await render(<TVLiveScoresSettings />);
    await fireEvent.press(screen.getByTestId("more"));
    expect(mockUpdateSettings).toHaveBeenLastCalledWith({
      liveScoresDelaySeconds: 35,
    });
    await fireEvent.press(screen.getByTestId("less"));
    expect(mockUpdateSettings).toHaveBeenLastCalledWith({
      liveScoresDelaySeconds: 25,
    });
  });

  test("turns live scores off, and hides the delay while off", async () => {
    await render(<TVLiveScoresSettings />);
    await fireEvent.press(screen.getByText("livescores.settings_enabled=true"));
    expect(mockUpdateSettings).toHaveBeenCalledWith({
      liveScoresEnabled: false,
    });

    mockSettings.liveScoresEnabled = false;
    await render(<TVLiveScoresSettings />);
    expect(screen.queryByTestId("more")).toBeNull();
  });
});
