import { fireEvent, render, screen } from "@testing-library/react-native";
import { TVSettingsTextInput } from "./TVSettingsTextInput";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/constants/TVTypography", () => ({
  useScaledTVTypography: () => ({ callout: 16, body: 18 }),
}));
jest.mock("../hooks/useTVFocusAnimation", () => ({
  useTVFocusAnimation: () => ({
    focused: false,
    handleFocus: () => {},
    handleBlur: () => {},
    animatedStyle: {},
  }),
}));

// Fire TV, 2026-11-16: the Seerr address showed in the field after typing,
// but Login stayed disabled. The Fire TV keyboard's full-screen editor
// failed to attach ("startExtractingText: mExtractedText = null"), so the
// text reached the native field without onChangeText. When editing ends,
// the field now hands on the text it holds.
describe("TVSettingsTextInput", () => {
  const renderField = async (value = "") => {
    const onChangeText = jest.fn();
    await render(
      <TVSettingsTextInput
        label='Server URL'
        value={value}
        placeholder='Seerr URL'
        onChangeText={onChangeText}
      />,
    );
    return { onChangeText, field: screen.getByPlaceholderText("Seerr URL") };
  };

  test("hands on the field's text when editing ends", async () => {
    const { onChangeText, field } = await renderField();

    await fireEvent(field, "endEditing", {
      nativeEvent: { text: "http://seerr.example.com" },
    });

    expect(onChangeText).toHaveBeenCalledWith("http://seerr.example.com");
  });

  test("hands on the field's text when it's submitted", async () => {
    const { onChangeText, field } = await renderField();

    await fireEvent(field, "submitEditing", {
      nativeEvent: { text: "http://seerr.example.com" },
    });

    expect(onChangeText).toHaveBeenCalledWith("http://seerr.example.com");
  });

  test("doesn't repeat text the screen already has", async () => {
    const { onChangeText, field } = await renderField("same");

    await fireEvent(field, "endEditing", { nativeEvent: { text: "same" } });

    expect(onChangeText).not.toHaveBeenCalled();
  });

  test("still passes each keystroke on", async () => {
    const { onChangeText, field } = await renderField();

    await fireEvent.changeText(field, "h");

    expect(onChangeText).toHaveBeenCalledWith("h");
  });
});
