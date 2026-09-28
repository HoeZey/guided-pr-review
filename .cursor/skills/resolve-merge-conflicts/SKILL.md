---
name: resolve-merge-conflicts
description: Resolve git merge conflicts by fetching latest branches, researching change intent on both sides, and presenting context before resolution. Use when the user wants to merge branches, resolve conflicts, or asks about merge conflict resolution.
---

# Resolve Merge Conflicts

A systematic workflow for resolving git merge conflicts with full context from both branches.

## Workflow Overview

```
Task Progress:
- [ ] Step 1: Fetch latest branches
- [ ] Step 2: Attempt merge to identify conflicts
- [ ] Step 3: For each conflict - research and present context
- [ ] Step 4: Resolve with user approval
- [ ] Step 5: Resolve and commit (push only if asked)
```

## Step 1: Fetch Latest Branches

```bash
# Get current branch name
git branch --show-current

# Fetch both branches from origin
git fetch origin main
git fetch origin <current-branch>
```

## Step 2: Attempt Merge

```bash
git merge origin/main --no-commit --no-ff
```

This reveals all conflicts without committing.

## Step 3: Research Each Conflict

For each conflicting file, gather context from **both branches**:

### 3a. View the conflict markers

Read the file to see the exact conflict:
- `<<<<<<< HEAD` = current branch version
- `=======` = separator
- `>>>>>>> origin/main` = incoming branch version

### 3b. Research main branch changes

```bash
git log -p --oneline origin/main -5 -- <conflicting-file>
```

Look for:
- Which commit introduced the change
- PR/ticket reference in commit message
- Intent behind the modification

### 4c. Research feature branch changes

```bash
git log -p --oneline HEAD -5 -- <conflicting-file>
```

### 3d. Verify usage (for import conflicts)

If the conflict involves imports, verify what's actually used:

```bash
# Search for usage of the imported module/symbol
rg "module_name\." <conflicting-file>
```

## Step 5: Present Context and Get Approval

For each conflict, present to the user:

```markdown
## Merge Conflict #N: `<filename>` (lines X-Y)

### The Conflict
[Show the conflict markers and surrounding code]

### Context from origin/main
**Commit**: `<hash>` - *<commit message>*
**Intent**: [Explain what this change does and why]

### Context from Feature Branch (HEAD)
**Commit**: `<hash>` - *<commit message>*
**Intent**: [Explain what this change does and why]

### Proposed Resolution Plan
[Explain the recommended resolution and reasoning]

**Do you approve this resolution?**
```

**IMPORTANT**: Wait for explicit user approval before resolving.

## Step 5: Resolve and Commit

After approval:

```bash
git add <resolved-file>
git commit -m "Merge origin/main into <branch>

Resolved conflict in <file> by <brief explanation>"
```

Do not skip hooks. Do not push unless the user asks.

## Common Resolution Patterns

### Both Changes Needed (Import Conflicts)

When both branches added different imports that are both used:

```ts
// Keep both imports that are actually used
import { upsertReview } from "./store.ts";
import { GuideV1 } from "./contracts.ts";
```

### One Side is Newer (Sequential Changes)

When one branch's changes supersede the other, keep the newer version.

### Conflicting Logic

When both branches modified the same logic differently, analyze:
1. Which approach is more complete?
2. Can elements from both be combined?
3. Does one have tests that validate its approach?

## Abort If Needed

To abort the merge and return to previous state:

```bash
git merge --abort
```
