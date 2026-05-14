# Stackgod Android Codegen

Renders a Jetpack Compose app from a Stackgod app spec, uploads `release.aab` to the Play internal track.

## Inputs (from `BUILD_QUEUE`)
```
{ "app_id":"...", "name":"...", "package":"com.stakgod.x", "play_service_account_json":"..." }
```

## Pipeline (in `.github/workflows/android-build.yml`)
1. Render Compose template into temp dir
2. `./gradlew bundleRelease`
3. Upload `app-release.aab` via Play Developer API (Edits → Upload → Commit to internal track)
4. Callback `https://api.stakgod.com/mobile/android/callback`
