// A link to a tab group that no longer exists builds and type checks, then
// shows "page not found" in the app. Upstream's tab layout (Expo SDK 58)
// removed (favorites), (watchlists), (settings) and (custom-links); this
// fails on any link the code still has to one of them, or to any other
// group the app has not got. Spec: docs/specs/2026-11-16-upstream-catchup-plan.md.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..");
const TABS = join(ROOT, "app", "(auth)", "(tabs)");
const SOURCE_DIRS = [
  "app",
  "components",
  "constants",
  "hooks",
  "modules",
  "providers",
  "services",
  "utils",
];
const LINK = /\/\(auth\)\/\(tabs\)\/(\([^)/]+\))/g;

/** Every .ts and .tsx file under a directory, skipping native and vendored code. */
const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    if (name === "node_modules" || name === "android" || name === "ios") {
      return [];
    }
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });

test("every link to a tab group names one that exists", () => {
  const groups = new Set(
    readdirSync(TABS).filter((name) =>
      statSync(join(TABS, name)).isDirectory(),
    ),
  );
  const dead: string[] = [];
  for (const dir of SOURCE_DIRS) {
    for (const file of sourceFiles(join(ROOT, dir))) {
      if (file === __filename) continue;
      for (const match of readFileSync(file, "utf8").matchAll(LINK)) {
        if (!groups.has(match[1])) {
          dead.push(`${relative(ROOT, file)}: ${match[0]}`);
        }
      }
    }
  }
  expect(dead).toEqual([]);
});
