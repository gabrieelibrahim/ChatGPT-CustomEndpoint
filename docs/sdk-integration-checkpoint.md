# SDK integration checkpoint

Baseline: ad3c614 (mobile settings navigation and skeleton states).

This checkpoint precedes all Agents SDK and ChatKit dependency, backend and UI
changes. Existing custom endpoint profiles, Android key vault, local chat history
and desktop Codex runtime are the baseline to preserve.

Integration target: official Agents JS orchestration behind a custom ChatKit
server transport, with explicit endpoint capabilities and persistent threads.
Provider-specific features require real compatible services; no paid request,
APK build or publication is part of this checkpoint.

Rollback reference: tag `before-chatkit-integration`. Restore the tracked source
from that reference and run npm ci to restore its dependency lockfile. Copy or
commit later work before restoring, and do not delete local user files/history.
