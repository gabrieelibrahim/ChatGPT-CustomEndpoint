# Android v0.1.6: launcher and mobile motion

## Reference evidence

Reference: user-supplied ChatGPT.apk, SHA256 a30ab9145da62893cd1c2a3ccee7d05764110908ff4819de0d7e9e8aa222055e.

- APK resource XML inspected with Android SDK aapt2: adaptive foreground vector is 108 x 108dp; path ink spans approximately x=32..76, y=32..75.61. Background is a separate color resource. A monochrome layer is present.
- Custom SuperGPT glyph remains in use. Foreground SVG canvas now places the glyph at approximately 44dp width, with a separate opaque white background. Monochrome uses the same inset. Legacy PNG rendering is separate because Tauri enlarges adaptive foregrounds when generating legacy icons.
- REA/JADX class search for Drawer had no matches in this obfuscated APK. REA inspected hfn.<clinit> (268f/90f composer constants) and ndn.invoke; the latter returned no decompiled body. Neither recovers sidebar duration. REA resource decoder was unavailable because apktool was absent. No global configuration was changed.
- Evidence IDs: ev_ebcb488c7d1cbe862bd0b6d993dfb574da5c27930d5191bc8c71f7e4ee89d533 (class search), ev_47c00366ca8bd2cd6e8e2748594a362f14b45e06e45c12c7f4cfbeef409228b5 (method limitation).
- Existing android-reference-later.png contact sheet shows circular left control, right compose + vertical overflow capsule after first message. Geometry is normalized to the same 390px-wide preview.

## Changes and verification

- Drawer and sheet retain departing content for exit animation; closing controls are inert. Reopening cancels pending removal. Reduced motion hides departing content immediately and suppresses transitions.
- Sidebar slides and backdrop fades; sheets move from bottom; new message and conversation controls have restrained entrance motion. Durations are reconstruction tuning, not recovered native timing.
- Header stays 69.3px tall; home and conversation outside controls stay 45.1px. The right capsule has a 45.1px outer height, two 45.1px-wide controls and vertical overflow.
- Send pointerdown preserves composer focus so the first-focus layout cannot move the button out from under the tap.
- Browser at 390 x 813: home circles measured 45.09375px; conversation left circle 45.09375px, right button widths 45.09375px; capsule outer height 45.1px. First message returned a labeled mock response, not a real provider response. Screenshot: mobile-v016-header.png in chat outputs.
- Production web build and stylesheet order guard passed. Existing 103 tests passed, plus a new departing-dialog/reopen lifecycle test.

## Runtime boundary

Browser geometry and static APK resources do not verify launcher masking/themed-icon behavior or exact motion timing on the user's physical Android device. Full native 1:1 parity is not claimed.
