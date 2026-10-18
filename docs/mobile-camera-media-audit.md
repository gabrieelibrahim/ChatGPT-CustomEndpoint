# Mobile camera, attachment, startup and rich-content audit

Target: user-supplied `C:/Users/LAPTOP WA/Downloads/ChatGPT.apk`, package `com.openai.chatgpt`, version `1.2026.279`, SHA-256 `a30ab9145da62893cd1c2a3ccee7d05764110908ff4819de0d7e9e8aa222055e`.

## Evidence and scope

This pass attempted focused REA/JADX method inspection. `defpackage.we51.a` (`CameraCaptureScreenImpl`) and the smaller `defpackage.o661.m` (`ImageAttachmentPreviewCard`) both returned `provider_timeout` at 120000 ms. The first call loaded the APK successfully (74857 classes; 66160 ms), recovered the method inventory, then exceeded the method-analysis deadline. It produced no successful Evidence ID or decompiled method body. Do not describe these attempts as successful REA confirmation of camera geometry. No physical Android device or native camera runtime was observed.

Previously recovered successful REA input-mode enum `defpackage.k76.<clinit>` identifies `PromptOnly`, `Camera`, `Gallery`, `CameraOrGallery`, `Sketch`: Evidence `ev_0274178ba0f13d608c622d54352e3d6487ecb8808add7f3ee820485d5d6ee409`. These are supported input-mode identities, not proof that every item appears for every account/model.

A bounded raw DEX string/reference locator over the already extracted `classes3.dex` found the following candidates. Raw code-unit scanning may find non-instruction bytes; these entries are analysis seeds, not verified control flow:

| Feature | Candidate | Observed locator strings |
| --- | --- | --- |
| Camera screen | `xf51.a` | `android.permission.CAMERA`, `CameraScreenImpl` |
| Capture screen | `we51.a` | `CameraCaptureScreenImpl` |
| Image preview | `o661.m` | `ImageAttachmentPreviewCard` |
| Document item | `vn41.a` | `CalpicoDocumentAttachmentItem`, `markdown`, `txt`, `odp`, `csv` |
| File attachment | `xl41.d` | `CalpicoFileAttachment` |
| Remove attachment | `xl41.m` | `RemoveAttachmentButton` |
| Fullscreen attachment preview | `jk41.b` | `CalpicoAttachmentPreviewScreen` |

These distinctions support investigating separate image and document renderers and an attachment-removal affordance. They do not establish exact thumbnail/card dimensions, upload states, video frame extraction, or a particular custom-endpoint media wire format. Camera screen/preview labels suggest app-owned camera UI exists in the APK; external `input capture="environment"` alone must not be claimed identical to that native screen. Whether the specific photographed entry point selects that screen still needs a successful method/runtime trace.

## Startup and formatting

A bounded DEX string scan found no `Splash` anchors. Native startup logo duration/easing/animation remains unresolved. Any added pulse/fade is implementation tuning and must not be labelled recovered 1:1 behavior.

The same scan found `MarkdownRichText`, `CodeBlockImpl`, `GfmTableCellContent`, `FullscreenCodeBlockPreviewPage`, and code-block copy/edit/share/run analytics names. This demonstrates packaged rich-content identities, not their exact typography, spacing or visibility rules. Markdown/code/table rendering in SuperGPT should be tested with actual content. Exact native font metrics and line heights require runtime screenshots at matched viewport/font scale; using the SDK semantic font stack is a deliberate implementation choice, not proof of identical Android font rendering.

## Remaining verification

- Recover camera method body or record native camera open/capture/review/cancel behavior on Android.
- Compare image/video/document selected states, removal, loading/error and sent-message previews at matched viewport.
- Verify endpoint-specific media support independently from local preview rendering.
- Record startup animation and rich-content samples before claiming timing/typography parity.

No APK build, endpoint request, permission prompt, installation or microphone/camera capture was performed by this audit.

## Additional offline instruction validation

After the REA timeouts, the existing Android SDK `dexdump` 36.0.0 successfully decoded the extracted classes3.dex without executing the APK. Selected output is retained outside the repository in `work/chatgpt-apk-reference/camera-media-dexdump.txt`. This is independently decoded static instruction evidence, not a successful REA Evidence record:

- `xf51.a`, DEX offset `0x840cd8`, method code-unit `0x011e`: real `const-string "android.permission.CAMERA"`, followed by singleton permission-list creation and invocation of `c161.s`; `0x840e0a` tags the resulting Compose UI `CameraScreenImpl`. This validates camera permission handling belongs to this screen.
- `o661.m`, `0x9f2428`, code-unit `0x004a`: real `ImageAttachmentPreviewCard` tag, then `0x9f2434` loads float `96.0` (`0x42c00000`) into an `androidx.compose.foundation.layout.b.r(Modifier,float)` call. Treat 96 as a recovered layout parameter for this component; exact width/height semantics and screenshot scale remain unverified until the obfuscated layout helper is resolved. The method also loads 8.0/16.0/12.0 into subsequent layout/overlay calls; do not assume these are universal attachment dimensions.
- `vn41.a`, `0x74ce98`: real `CalpicoDocumentAttachmentItem` UI tag.
- `xl41.d`, `0x72f898`: real `CalpicoFileAttachment` UI tag.
- `xl41.m`, `0x732450`: real `RemoveAttachmentButton` UI tag.

This validates the listed tag references were actual instructions rather than raw code-unit false positives. Native screenshots, exact camera controls and video-specific behavior still remain unresolved.
