import { FileChange } from "$lib/shared/contracts/guide";

/** One file whose hunks exercise context, replace, leftover add, word change, and XSS text. */
export const CODE_VIEW_FIXTURE = FileChange.parse({
  path: "src/maps.py",
  language: "python",
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
  ],
});
