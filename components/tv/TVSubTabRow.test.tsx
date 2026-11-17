import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { TVSubTabRow } from "./TVSubTabRow";

describe("TVSubTabRow", () => {
  // Fire TV, 2026-11-17, screenshots: → on Live TV's last sub-tab
  // (Multiview) left the row for the top tab bar.
  test("keeps ← and → in the row, and leaves ↑ and ↓ alone", async () => {
    await render(
      <TVSubTabRow>
        <Text>Programs</Text>
        <Text>Multiview</Text>
      </TVSubTabRow>,
    );
    const row = screen.getByTestId("tv-sub-tab-row");
    expect(row.props.trapFocusLeft).toBe(true);
    expect(row.props.trapFocusRight).toBe(true);
    expect(row.props.trapFocusUp).toBeFalsy();
    expect(row.props.trapFocusDown).toBeFalsy();
    expect(screen.getByText("Multiview")).toBeTruthy();
  });
});
