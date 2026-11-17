import { cardAccessibleName } from "./cardAccessibleName";

describe("cardAccessibleName", () => {
  test("an episode is named by its show and its title", () => {
    expect(
      cardAccessibleName({
        Type: "Episode",
        SeriesName: "The Big Bang Theory",
        Name: "The Status Quo Combustion",
      }),
    ).toBe("The Big Bang Theory, The Status Quo Combustion");
  });

  test("anything else by its name", () => {
    expect(cardAccessibleName({ Type: "Movie", Name: "Spider-Man" })).toBe(
      "Spider-Man",
    );
  });

  test("no name: nothing, rather than an empty label", () => {
    expect(cardAccessibleName({ Type: "Movie" })).toBeUndefined();
  });
});
