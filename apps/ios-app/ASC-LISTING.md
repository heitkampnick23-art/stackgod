# App Store Connect — Stakgod listing copy

Copy-paste each field directly into App Store Connect → My Apps → Stakgod → App Information / App Store / Version 1.0.0.

---

## App Information

**Name** (visible on the App Store, ≤30 chars):
```
Stakgod
```

**Subtitle** (≤30 chars):
```
Chat with Claude. Build apps.
```

**Primary category**: Developer Tools
**Secondary category**: Productivity

**Content rights**: Yes — you own or have licensed all content.

**Age rating**: 4+ (no objectionable content)

---

## Pricing & Availability

**Price**: Free (subscriptions handled by StoreKit)
**Availability**: All countries / regions

---

## App Privacy

Required answers when filling the privacy nutrition label:

| Question | Answer |
|---|---|
| Do you collect data? | **Yes** |
| Email address | Linked to user (for sign-in) — App Functionality |
| Name | Linked to user (optional, Apple Sign In) — App Functionality |
| User content (chat messages) | Linked to user — App Functionality |
| Identifiers (User ID) | Linked to user — App Functionality |
| Diagnostics (Crash data) | Not linked to user — App Functionality |
| Tracking? | **No** — we don't track across apps/websites |

**Privacy policy URL**: `https://stakgod.com/privacy`

---

## Version 1.0.0

### Promotional text (≤170 chars, can update without resubmit):
```
Chat with Claude to build, edit, and ship real apps. Open-source AI app builder — 5 free messages a day, no card required.
```

### Description (≤4000 chars):
```
Stakgod is the chat-to-app builder that lets you describe what you want and watch a real, working app appear in seconds.

WHAT YOU CAN DO
• View every app you've built on Stakgod in one place
• Chat with Claude to brainstorm new ideas or refine existing ones
• Ask Claude to change anything — colors, layout, copy, behavior — and see updates apply to your live app
• Manage your subscription and view per-app analytics (Pro plan)

OPEN SOURCE
Stakgod is MIT-licensed end-to-end. Every line of our code is on GitHub. You own the apps you build, the domains you buy, and the source code that ships.

BUILT ON CLOUDFLARE
The entire platform runs on Cloudflare Workers, D1, R2, and Workers AI. Single-digit-millisecond response times. No legacy cloud bloat.

FREE TIER
Get 5 AI messages every day, no card required. Upgrade to Stakgod+ for 200 messages per month and push notifications, or Stakgod Pro for 1,000 messages per month plus per-app analytics.

SUBSCRIPTIONS
• Stakgod+ — $9.99 / month (200 messages, push notifications)
• Stakgod Pro — $24.99 / month (1,000 messages, push notifications, analytics)

Subscriptions auto-renew unless cancelled at least 24 hours before the end of the period. Manage or cancel anytime in Settings → Apple ID → Subscriptions.

Privacy: https://stakgod.com/privacy
Terms: https://stakgod.com/terms
Support: hello@stakgod.com
```

### Keywords (≤100 chars, comma-separated):
```
ai,claude,app builder,no code,chat,assistant,gpt,dev tools,sdk,build,saas,startup
```

### What's New in This Version:
```
First release. Sign in, see your apps, chat with Claude, manage your subscription.
```

### Support URL:
```
https://stakgod.com/support
```

### Marketing URL (optional):
```
https://stakgod.com
```

### Copyright:
```
© 2026 Stakgod
```

---

## Review notes (App Review team)

```
Stakgod is a companion to our web platform at stakgod.com. The iOS app lets
existing users view apps they've already created on the web and use Claude
to brainstorm or refine them.

The app does NOT submit apps to the App Store from within iOS — that flow is
web-only and out of scope for this submission. Builders use the web platform
to publish their finished iOS apps (under their own Apple Developer accounts).

To test:
  1. Tap "Sign in with Apple"
  2. (Optional) review the My Apps tab — empty for new accounts; users with
     existing apps will see them listed.
  3. Tap "Build" → ask Claude any question. Test prompt: "Brainstorm 3 names
     for a meal-planning app for one-pot recipes."
  4. Tap "Account" → "Upgrade" to view the subscription paywall.

Test account (no credit card needed):
  - Apple ID: (use any Sandbox tester from our team — we'll provide via
    Review Notes when prompted)

If anything in this submission needs clarification, please reach out to
hello@stakgod.com. We respond within hours.
```

---

## Subscription Products (configure in ASC → My Apps → Stakgod → Monetization → Subscriptions)

Create a single **Subscription Group**: `Stakgod Subscriptions`

| Field | Stakgod+ | Stakgod Pro |
|---|---|---|
| Reference Name | Stakgod Plus Monthly | Stakgod Pro Monthly |
| Product ID | `com.stakgod.ios.plus` | `com.stakgod.ios.pro` |
| Duration | 1 month | 1 month |
| Price | $9.99 USD (Tier 10) | $24.99 USD (Tier 25) |
| Free trial | None | None |
| Display Name | Stakgod+ | Stakgod Pro |
| Description | 200 AI messages per month + push notifications. | 1,000 AI messages per month + push notifications + per-app analytics. |
| Review screenshot | Provide a screenshot of `PaywallView` (full-screen with both tiers visible) |
| Review notes | "Both tiers unlock additional Claude messages per month. Free tier has 5 messages/day. To test: tap Subscribe on this tier; user receives access to the message quota immediately upon successful purchase." |

---

## Screenshots required

**6.9" iPhone (iPhone 16 Pro Max — 1290 × 2796)** — at least 3, max 10.

Recommended set:
1. SignInView with "STAKGOD" wordmark
2. AppsView with a populated list of user apps
3. BuildView with a sample Claude conversation
4. PaywallView showing both tiers
5. AccountView (signed-in state)

Capture in Xcode → Window → Devices and Simulators → iPhone 16 Pro Max → Screenshot. Or use `xcrun simctl io booted screenshot screenshot.png`.

---

## Pre-submission self-check

- [ ] Bundle ID `com.stakgod.ios` registered in developer.apple.com → Identifiers
- [ ] App created in ASC with that exact bundle ID
- [ ] Both subscription products created + ready to submit (status: "Ready to Submit")
- [ ] Subscription products checked into the version submission (Version 1.0.0 → In-App Purchases)
- [ ] Privacy policy live at `https://stakgod.com/privacy`
- [ ] Terms live at `https://stakgod.com/terms`
- [ ] App icon 1024×1024 PNG, no alpha channel, no rounded corners (Apple auto-rounds)
- [ ] Screenshots uploaded (≥3)
- [ ] Privacy nutrition label filled out
- [ ] Sign in with Apple capability enabled in your provisioning profile
- [ ] Paid Apps Agreement accepted in Agreements / Tax / Banking section
