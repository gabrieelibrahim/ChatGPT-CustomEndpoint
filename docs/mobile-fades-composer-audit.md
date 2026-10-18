# Mobile edge fades, active history and composer motion

## Reference and REA evidence

User screenshot shows full-width active-session background, pinned/recent groups and a broad bottom fade under floating sidebar controls. Reference APK is the supplied ChatGPT.apk (SHA256 a30ab9145da62893cd1c2a3ccee7d05764110908ff4819de0d7e9e8aa222055e).

- REA emq0.f / HistoryListItem compares the conversation identifier against the active identifier (kr80.m) and applies theme background zem0.c(...).j.a.b when equal. Evidence ev_1bf0454adda00e0b33cb651feb23d7ec7ac7888d6a8b3898c83e701b2cfdc236.
- REA emq0.o delegates SidebarSectionHeader to mls0.b. Evidence ev_584b0a67155168748d48f690ab2d4120a2413c4e205566da6242b38171a73e17.
- REA mvq.g identifies SidebarFloatingChatButtons and distinct layout branches. Evidence ev_6c18143cbfc608db2354957e35e505f4a7785451e2a35761e10227e4824b2f9f.
- Composer container hfn.c is available as disassembly, including Composer, DictationBarComposerModeProgress and DictationBarAttachmentsVisibility labels. Evidence ev_bb510c9b90ffa3d9526d5567ae325f653e99edf7e411895e5954ae6777a76601. This does not recover the exact focus-animation curve/duration. The implementation uses a tuned 240ms cubic-bezier(.2,.8,.2,1), not a claimed native constant.

## Changes

Conversation messages scroll beneath an absolutely positioned header at y=0. A masked background/blur fades to transparent instead of ending in a solid block. Sidebar header/footer float over its scroll container; top/bottom masks let content disappear gradually. Semantic colors work in light and dark. Empty gradient areas pass scroll gestures through while controls remain interactive.

Active history uses aria-current=page and theme selected background across the entire drawer width. Existing pinned/recent grouping remains data-driven: an empty pinned group is omitted, archived chats are excluded.

Composer shape width/height and input position now interpolate without scaling typography or glyphs. Continuous positioning replaces discrete grid-area changes on first focus. Textarea measurement still supports wrapping, first-focus expansion, compact reopening, keyboard dismissal and resizing. Existing reduced-motion overrides suppress these transitions.

Mobile typography uses the exact system font stack from the installed Apps SDK UI variables-semantic.css --font-sans token, scoped to mobile to avoid Tailwind's merged default. The forced Roboto face was removed. This SDK token does not supply a proprietary OpenAI font file; platform font rendering can differ between Windows preview and Android.

## Verification

- TypeScript no-emit and 8 focused composer/sidebar/response/presence tests passed. Sidebar tests cover both groups, exactly one active row, archival filtering and keeping the active marker when unpinned.
- Browser at 390x813: resting composer 49.5px; expanded 96px; input remains 18px; controls do not scale. Compact reopening returns to 49.5px. At 390x360, message scrollTop reached 24px behind a header at y=0 with transparent background and a continuous mask.
- Active background #414141 in dark, #ddd in light. Sidebar footer background transparent in both themes; underlying rows fade beneath floating controls. Temporary pin used only on the existing mock chat to exercise both groups; original pin state and light theme restored afterward.
- Screenshots in chat outputs: mobile-sidebar-fades-active-dark.png, mobile-sidebar-fades-active.png, mobile-header-fade-short.png.
- No APK compilation/publication. Exact physical-device motion and font-rasterization parity remain unverified.
