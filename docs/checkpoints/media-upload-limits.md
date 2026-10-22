# Media upload limits checkpoint

Baseline: `5969e63` (released v0.1.11). User requests removal of app-imposed media upload limits and explicitly prohibits compilation for this task.

Identified limits: local library 10 MB/file, resolved images 28 MB/history, resolved text attachments 512 KB/request, SDK 4 attachments/request and 10 MB/file plus library count/document caps, and 32 MB relay/request envelopes. Android external-file opening also restricts the previously capped file sizes.

Plan: remove those application upload size/count ceilings across selection, hydration and forwarding; retain format validation, upload-size consistency, authentication, cancellation and provider errors. Update regression tests for attachments beyond the former thresholds and record endpoint/storage constraints. No dependency additions, APK compilation, version bump or release publication.
