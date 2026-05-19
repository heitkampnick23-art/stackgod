import SwiftUI
import StoreKit

struct AccountView: View {
    @EnvironmentObject var auth: AuthStore
    @EnvironmentObject var store: SubscriptionStore
    @State private var showPaywall = false

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.ink.ignoresSafeArea()
                List {
                    Section("Signed in as") {
                        Text(auth.userEmail ?? "—")
                            .foregroundColor(.white)
                            .listRowBackground(Brand.card)
                    }
                    Section("Plan") {
                        HStack {
                            Text(planTitle).foregroundColor(.white)
                            Spacer()
                            Text(planBadge).font(.caption).foregroundColor(Brand.gold)
                        }.listRowBackground(Brand.card)
                        if store.activeEntitlement == nil {
                            Button { showPaywall = true } label: {
                                HStack {
                                    Text("Upgrade").foregroundColor(Brand.flame).bold()
                                    Spacer()
                                    Image(systemName: "arrow.up.right").foregroundColor(Brand.flame)
                                }
                            }.listRowBackground(Brand.card)
                        }
                        Button {
                            Task { await store.restorePurchases() }
                        } label: {
                            Text("Restore purchases").foregroundColor(.white)
                        }.listRowBackground(Brand.card)

                        if store.activeEntitlement != nil {
                            // Apple-required link for managing subscriptions.
                            Link(destination: URL(string: "https://apps.apple.com/account/subscriptions")!) {
                                HStack {
                                    Text("Manage subscription").foregroundColor(.white)
                                    Spacer()
                                    Image(systemName: "arrow.up.right").foregroundColor(Brand.muted)
                                }
                            }.listRowBackground(Brand.card)
                        }
                    }
                    Section("Support") {
                        Link("Privacy policy", destination: URL(string: "https://stakgod.com/privacy")!)
                            .listRowBackground(Brand.card)
                        Link("Terms of service", destination: URL(string: "https://stakgod.com/terms")!)
                            .listRowBackground(Brand.card)
                        Link("Email support", destination: URL(string: "mailto:hello@stakgod.com")!)
                            .listRowBackground(Brand.card)
                    }
                    Section {
                        Button(role: .destructive) { auth.signOut() } label: {
                            Text("Sign out").foregroundColor(.red)
                        }.listRowBackground(Brand.card)
                    }
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle("Account")
            .sheet(isPresented: $showPaywall) { PaywallView() }
        }
    }

    private var planTitle: String {
        switch store.activeEntitlement {
        case SubscriptionStore.plusID: return "Stakgod+"
        case SubscriptionStore.proID:  return "Stakgod Pro"
        default: return "Free"
        }
    }

    private var planBadge: String {
        switch store.activeEntitlement {
        case SubscriptionStore.plusID: return "200 msg/mo"
        case SubscriptionStore.proID:  return "1000 msg/mo"
        default: return "5 msg/day"
        }
    }
}
