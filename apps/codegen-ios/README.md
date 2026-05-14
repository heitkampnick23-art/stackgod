# Stackgod iOS Codegen

Renders a real native SwiftUI app from a Stackgod app spec, then uploads to TestFlight via App Store Connect API.

Per [feedback_iphone_only_ios17.md]:
- iPhone only — no iPad/Mac/vision/watch/tv
- iOS 17 minimum
- All Xcode settings live in `project.yml` (xcodegen) — never edit Xcode UI

## Inputs (from API `BUILD_QUEUE` message)
```
{
  "app_id": "...",
  "name": "Habit Tracker",
  "bundle_id": "com.stakgod.habit-tracker-x9k2",
  "asc_key_id": "...",
  "asc_issuer_id": "...",
  "asc_p8": "..."
}
```

## Pipeline (in `.github/workflows/ios-build.yml`)
1. `xcodegen generate`
2. `xcodebuild -archivePath build/App.xcarchive archive`
3. `xcodebuild -exportArchive` → `App.ipa`
4. `xcrun altool --upload-app -f App.ipa --apiKey $KEY_ID --apiIssuer $ISSUER_ID`
5. POST status back to `https://api.stakgod.com/mobile/ios/callback`

## Template
See `template/` — minimal SwiftUI scaffold with Sign in with Apple + IAP capability pre-wired (mirrors the bulldog/mythos pattern).
