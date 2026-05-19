# Stakgod iOS Companion App

SwiftUI app that signs into the same backend as stakgod.com. iPhone-only, iOS 17+.

## What it does

- **Apps tab** — lists your shipped apps (`GET /apps`), opens live web preview in WKWebView
- **Build tab** — chat with Claude (`POST /builder/chat-sync`); credit gate enforced server-side
- **Account tab** — current plan, sign-out, restore purchases, manage subscription
- **Paywall** — StoreKit 2 subscriptions: `com.stakgod.ios.plus` ($9.99/mo) and `com.stakgod.ios.pro` ($24.99/mo)

The app does **not** submit new apps to the App Store from iOS — that flow stays
web-only to avoid App Review Guideline 4.2.6 issues with "app submission tools."

## Local build (Mac required)

```bash
brew install xcodegen
cd apps/ios-app
xcodegen
open Stakgod.xcodeproj
```

Then in Xcode:
1. Select the `Stakgod` target → Signing & Capabilities tab
2. Pick your Team
3. Edit `project.yml` to fill in `DEVELOPMENT_TEAM` so xcodegen regenerates the right Team in the project
4. Run on Simulator (iPhone 16 Pro Max) — sign in flow won't actually call Apple in simulator, you'll see the SignIn button is disabled. Test on a physical device for the auth flow.

## Test StoreKit locally

In Xcode: Edit Scheme → Run → Options → StoreKit Configuration → pick `Stakgod.storekit`.
Then paywall purchases will succeed without contacting Apple (sandbox via the local config).

## Submit to TestFlight

This app is meant to ship via the same pipeline as user-built apps (Stakgod's existing
GitHub Actions iOS build runner). Two paths:

### Path A — via Stakgod's own pipeline

1. Make sure you have Apple Developer credentials connected at
   `https://stakgod.com/dashboard/connect-apple` (one-time, you've already done this)
2. From the Stakgod dashboard, the iOS pipeline can target this app as a build job
   (or trigger manually via `gh workflow run "iOS Build → TestFlight"`)

### Path B — manual local build

```bash
cd apps/ios-app
xcodegen
xcodebuild -project Stakgod.xcodeproj -scheme Stakgod \
  -archivePath build/Stakgod.xcarchive \
  -destination "generic/platform=iOS" \
  archive

xcodebuild -exportArchive \
  -archivePath build/Stakgod.xcarchive \
  -exportOptionsPlist ExportOptions.plist \
  -exportPath build/

xcrun altool --upload-app -f build/Stakgod.ipa -t ios \
  --apiKey YOUR_KEY_ID --apiIssuer YOUR_ISSUER_ID
```

## App Store Connect setup

See [`ASC-LISTING.md`](./ASC-LISTING.md) for every field's exact value — copy-paste ready.

## Backend dependencies

Two routes the iOS app calls that need to exist on `api.stakgod.com`:

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/apple/ios` | Exchange Apple `id_token` for an `sg_session` cookie |
| POST | `/builder/chat-sync` | Sync (non-streaming) wrapper around `/builder/chat` for mobile |
| POST | `/billing/apple/verify` | Record StoreKit transactions + upgrade user plan |

These routes are scaffolded in `apps/api/src/routes/{oauth,builder,billing}.ts`.
If they're missing on prod, the relevant tab errors gracefully with a user-friendly message.

## File tree

```
apps/ios-app/
├── README.md                 — this file
├── ASC-LISTING.md            — App Store Connect copy
├── project.yml               — xcodegen config
└── Stakgod/
    ├── App.swift             — main entry
    ├── Theme.swift           — brand colors
    ├── Info.plist
    ├── Stakgod.entitlements
    ├── Stakgod.storekit      — local StoreKit config (mirrors ASC products)
    ├── Models/AppModel.swift
    ├── Services/
    │   ├── APIClient.swift
    │   ├── AuthStore.swift   — Sign in with Apple + Keychain
    │   └── SubscriptionStore.swift  — StoreKit 2
    ├── Views/
    │   ├── SignInView.swift
    │   ├── MainTabs.swift
    │   ├── AppsView.swift
    │   ├── BuildView.swift
    │   ├── AccountView.swift
    │   └── PaywallView.swift
    └── Assets.xcassets/
        ├── AppIcon.appiconset/AppIcon-1024.png
        ├── AccentColor.colorset
        └── LaunchBackground.colorset
```
