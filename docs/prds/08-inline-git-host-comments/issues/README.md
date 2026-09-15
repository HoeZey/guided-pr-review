# Inline git-host comments issues

From [08 Inline git-host comments](../).

## Delivery graph

```text
07 Provider API integration
└── 01 Define comment service and contracts
    ├── 02 Implement ADO comment adapter ─┐
    ├── 03 Implement GitHub adapter ─────┼── 05 Create and reply ── 06 Edit and delete
    ├── 04 Render inline in Guide/Diff ──┘
    └──────────────────────────────────────────────────────────────┘
                                                                    └── 07 Deliver Discussion tab
02,03,04,05,06,07 ────────────────────────── 08 Integrate and verify
```

Issues 02, 03, and 04 may start in parallel after 01. Issue 04 uses fake
CommentService data until provider stories integrate. Issue 05 reconciles both
provider adapters with shared composer/delivery state. Issue 06 builds on
successful create/reply ownership. Issue 07 follows 06 so Discussion receives
the same final interaction controls.

Before 08 branches start, reconcile target paths and interfaces against actual
07 develop. Product behavior stays locked.

## Status

- [01 Define provider-neutral comment services and contracts](01-define-comment-service.md) — todo
- [02 Implement ADO comment adapter](02-implement-ado-comments.md) — todo
- [03 Implement GitHub comment adapter](03-implement-github-comments.md) — todo
- [04 Render existing threads inline in Guide and Diff](04-render-inline-threads.md) — todo
- [05 Create comments and replies from both views](05-create-and-reply.md) — todo
- [06 Edit and delete owned comments](06-edit-and-delete.md) — todo
- [07 Deliver the PR-wide Discussion tab](07-deliver-discussion-tab.md) — todo
- [08 Integrate and verify inline comments](08-integrate-inline-comments.md) — todo
