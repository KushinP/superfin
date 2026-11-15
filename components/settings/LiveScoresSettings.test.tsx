import { fireEvent, render, screen } from "@testing-library/react-native";
import type React from "react";
import { LiveScoresSettings } from "./LiveScoresSettings";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${Object.values(values).join(",")}` : key,
  }),
}));

// The dropdown, as a plain list of its options to press.
jest.mock("@/components/PlatformDropdown", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  return {
    PlatformDropdown: ({
      groups,
      trigger,
    }: {
      groups: { options: { label: string; onPress: () => void }[] }[];
      trigger: React.ReactNode;
    }) => (
      <>
        {trigger}
        {groups[0].options.map((o) => (
          <Pressable
            key={o.label}
            onPress={o.onPress}
            testID={`opt-${o.label}`}
          >
            <Text>{o.label}</Text>
          </Pressable>
        ))}
      </>
    ),
  };
});

let mockSettings: Record<string, unknown> = {};
let mockPluginSettings: Record<string, { locked?: boolean }> | undefined;
const mockUpdateSettings = jest.fn();
jest.mock("@/utils/atoms/settings", () => ({
  useSettings: () => ({
    settings: mockSettings,
    updateSettings: mockUpdateSettings,
    pluginSettings: mockPluginSettings,
  }),
}));

describe("LiveScoresSettings", () => {
  beforeEach(() => {
    mockSettings = { liveScoresEnabled: true, liveScoresDelaySeconds: 30 };
    mockPluginSettings = undefined;
    mockUpdateSettings.mockReset();
  });

  test("turns live scores off", async () => {
    await render(<LiveScoresSettings />);
    await fireEvent(screen.getByRole("switch"), "valueChange", false);
    expect(mockUpdateSettings).toHaveBeenCalledWith({
      liveScoresEnabled: false,
    });
  });

  test("shows the delay in force and sets a new one", async () => {
    await render(<LiveScoresSettings />);
    expect(
      screen.getAllByText("livescores.settings_delay_value:30").length,
    ).toBeGreaterThan(0);
    await fireEvent.press(
      screen.getByTestId("opt-livescores.settings_delay_value:45"),
    );
    expect(mockUpdateSettings).toHaveBeenCalledWith({
      liveScoresDelaySeconds: 45,
    });
  });

  test("offers every step from 0 to 90 s", async () => {
    await render(<LiveScoresSettings />);
    expect(
      screen.getByTestId("opt-livescores.settings_delay_value:0"),
    ).toBeTruthy();
    expect(
      screen.getByTestId("opt-livescores.settings_delay_value:90"),
    ).toBeTruthy();
    expect(
      screen.queryByTestId("opt-livescores.settings_delay_value:95"),
    ).toBeNull();
  });

  test("hides the delay while scores are off", async () => {
    mockSettings.liveScoresEnabled = false;
    await render(<LiveScoresSettings />);
    expect(screen.queryByText("livescores.settings_delay")).toBeNull();
  });

  test("an admin lock disables the switch", async () => {
    mockPluginSettings = { liveScoresEnabled: { locked: true } };
    await render(<LiveScoresSettings />);
    expect(screen.getByRole("switch").props.disabled).toBe(true);
  });
});
