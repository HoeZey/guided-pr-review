import { GuideV1 } from "$lib/shared/contracts/guide";

export const DIFF_GUIDE = GuideV1.parse({
  version: 1,
  title: "Diff fixture",
  base: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  head: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  unchaptered: true,
  chapters: [
    {
      id: "core",
      kind: "core",
      title: "Core",
      why: "Behavior.",
      files: [
        {
          path: "pkg/src/a.ts",
          language: "typescript",
          hunks: [
            {
              header: "@@ -1,4 +1,5 @@",
              oldStart: 1,
              newStart: 1,
              lines: [
                { type: "context", content: "keep", oldLine: 1, newLine: 1 },
                { type: "context", content: "also keep", oldLine: 2, newLine: 2 },
                {
                  type: "removed",
                  content: "maps = list_maps(model.workflow_id)",
                  oldLine: 3,
                },
                {
                  type: "added",
                  content: "maps = list_maps(snapshot.workflow_id)",
                  newLine: 3,
                },
                { type: "added", content: 'extra = "<script>x</script>"', newLine: 4 },
              ],
            },
            {
              header: "@@ -20,2 +21,2 @@",
              oldStart: 20,
              newStart: 21,
              lines: [
                { type: "removed", content: "oldTail", oldLine: 20 },
                { type: "added", content: "newTail", newLine: 21 },
              ],
            },
          ],
        },
        {
          path: "pkg/src/b.ts",
          language: "typescript",
          hunks: [
            {
              header: "@@ -1,2 +1,1 @@",
              oldStart: 1,
              newStart: 1,
              lines: [
                { type: "removed", content: "gone", oldLine: 1 },
                { type: "removed", content: "also", oldLine: 2 },
                { type: "added", content: "kept", newLine: 1 },
              ],
            },
          ],
        },
        {
          path: "pkg/util.ts",
          language: "typescript",
          hunks: [
            {
              header: "@@ -1,3 +1,4 @@",
              oldStart: 1,
              newStart: 1,
              lines: [
                { type: "context", content: "alpha", oldLine: 1, newLine: 1 },
                { type: "context", content: "beta", oldLine: 2, newLine: 2 },
                { type: "added", content: "gamma", newLine: 3 },
                { type: "context", content: "delta", oldLine: 3, newLine: 4 },
              ],
            },
          ],
        },
        {
          path: ".cursor/rules/personal/hook.ts",
          language: "typescript",
          hunks: [
            {
              header: "@@ -1,0 +1,1 @@",
              newStart: 1,
              lines: [{ type: "added", content: "export {}", newLine: 1 }],
            },
          ],
        },
        {
          path: "README.md",
          language: "markdown",
          hunks: [
            {
              header: "@@ -1,0 +1,1 @@",
              newStart: 1,
              lines: [{ type: "added", content: "# title", newLine: 1 }],
            },
          ],
        },
      ],
    },
  ],
  omitted: [{ path: "docs/diagram.png", reason: "binary" }],
});
