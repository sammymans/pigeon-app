# Backend retention and source boundary

## Current cloud state

The frontend uses development deployment `helpful-kudu-864`. The prior full backend was deployed before the scope narrowed, and the starter table/functions were added to it. Its auth, profiles, flights, messages, social, catch, and commerce schema/functions remain there to preserve existing data and behavior. Their presence is not approval to resume those product features.

This PR versions only `starterDemo.ts`, its unchanged regression test, the minimal `starterDemo` schema, and supporting types/test tooling. Generated server environment types omit the old product variables because this projection does not use them. The frontend intentionally uses narrow function references rather than importing the archived product API.

**The source tree is not the complete live backend. Deploying it to the shared deployment could remove functions and schema definitions. Do not run `convex dev`, `convex deploy`, or credentialed codegen against that deployment from this tree.** No deployment credentials, automatic deployment workflow, or backend startup command are included.

The counter is intentionally unauthenticated and public. Its API has no caller-selected row/table or namespace; it reads and increments the one `shared` demo row and wraps at one million. It is not a private-data or production-auth pattern.

## Before any future shared-backend deployment

Restore the full retained backend into an isolated worktree, reconcile it with the actual current deployment and any intervening changes, then add only the approved module/schema changes. Verify the target is the intended development deployment and review the deployment diff before applying it. Preserve all existing tables/functions and data. Do not deploy the older archived frontend or resume catch/commerce as a side effect.

Tests in this minimal projection run entirely in memory. They do not establish compatibility of a future full-backend deploy. That needs the full backend's tests and a separate authorized handoff.

## Retained history

The Captain's source handoff `captain-fapy/handoffs/YCCM-2-starter.bundle` contains the complete original history, with original commit identities intact:

| Commit | Scope |
| --- | --- |
| `759866ca1e135554111abf794d3a8fd42bcd7438` | Original empty base, now published to `main`. |
| `31c2097` | Original Expo/Convex tooling foundation. |
| `06ebf3c` | Archived full product and retained cloud backend source. |
| `6f18957645086ba8062f028cbc801ee3fbac21ab` | Isolated counter frontend and additive counter backend. |

The original bundle is the recovery source, not this minimal branch. Verify it with `git bundle verify /path/to/YCCM-2-starter.bundle`, fetch its `refs/heads/capy/convex-starter` into a new local archive branch, and inspect before restoring. Do not overwrite current work or deploy the archived snapshot blindly. No old authored commit was re-authored as Sammy.
