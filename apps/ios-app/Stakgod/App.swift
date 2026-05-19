// Stakgod iOS — companion app to the web platform.
// Lets builders view their shipped apps, chat with Claude for edits,
// and manage subscriptions via StoreKit 2.

import SwiftUI

@main
struct StakgodApp: App {
    @StateObject private var auth = AuthStore.shared
    @StateObject private var store = SubscriptionStore.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(auth)
                .environmentObject(store)
                .preferredColorScheme(.dark)
                .task {
                    await store.refreshProducts()
                    await store.refreshEntitlements()
                    await auth.restoreSession()
                }
        }
    }
}

struct RootView: View {
    @EnvironmentObject var auth: AuthStore

    var body: some View {
        if auth.signedIn {
            MainTabs()
        } else {
            SignInView()
        }
    }
}
