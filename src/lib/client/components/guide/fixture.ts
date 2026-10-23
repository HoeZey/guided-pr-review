import { GuideV1 } from "$lib/shared/contracts/guide";
import { CODE_VIEW_FIXTURE } from "../code/fixture";

const SHA_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SHA_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

export const GUIDE_CHAPTERED = GuideV1.parse({
  version: 1,
  title: "Maps pin",
  base: SHA_A,
  head: SHA_B,
  chapters: [
    {
      id: "core",
      kind: "core",
      title: "Core",
      why: "Pin maps to the **output** model.",
      files: [CODE_VIEW_FIXTURE],
    },
    {
      id: "tests",
      kind: "tests",
      title: "Tests",
      why: "Cover the pin.",
      files: [
        {
          path: "tests/maps_test.py",
          language: "python",
          hunks: [
            {
              header: "@@ -1,1 +1,2 @@",
              oldStart: 1,
              newStart: 1,
              lines: [
                { type: "context", content: "def test_pin():", oldLine: 1, newLine: 1 },
                { type: "added", content: "    assert pinned", newLine: 2 },
              ],
            },
          ],
        },
      ],
    },
  ],
  omitted: [{ path: "docs/diagram.png", reason: "binary", note: "chart" }],
});

export const GUIDE_UNCHAPTERED = GuideV1.parse({
  version: 1,
  title: "Raw diff",
  base: SHA_A,
  head: SHA_B,
  unchaptered: true,
  chapters: [
    {
      id: "unchaptered",
      kind: "core",
      title: "Raw diff",
      why: "Raw diff until a reading-order guide is generated.",
      files: [CODE_VIEW_FIXTURE],
    },
  ],
});
