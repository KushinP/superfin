import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// As of SDK 56, expo-router's Metro check fails the release bundle on any
// import of @react-navigation/*. Jest doesn't run Metro, so on 2026-11-15 a
// `useIsFocused` import from "@react-navigation/native" passed every test
// and broke all four app builds after merge. Use expo-router's own exports
// (useFocusEffect, or "expo-router/react-navigation") instead.

const SOURCE_DIRS = [
  "app",
  "components",
  "hooks",
  "providers",
  "utils",
  "modules",
  "packages",
  "services",
];
const SKIP = new Set(["node_modules", "android", "ios", "build"]);
const IMPORT =
  /(?:from\s+|import\s*\(\s*|require\s*\(\s*|import\s+)["']@react-navigation\//;

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    if (SKIP.has(name)) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(tsx?|jsx?)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });

test("no app source imports @react-navigation/* directly", () => {
  const offenders = SOURCE_DIRS.flatMap((dir) => sourceFiles(dir)).filter(
    (file) => IMPORT.test(readFileSync(file, "utf8")),
  );
  expect(offenders).toEqual([]);
});
