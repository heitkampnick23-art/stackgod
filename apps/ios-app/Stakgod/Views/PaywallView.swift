// Apple-compliant subscription paywall.
// Requirements per App Review Guideline 3.1.2:
//   - Show product name + duration + price clearly
//   - Show what subscription unlocks
//   - Show "Restore purchases" button
//   - Show links to privacy policy + terms
//   - No anti-steering language (no mention of web pricing or Stripe — 3.1.3)

import SwiftUI
import StoreKit

struct PaywallView: View {
    @EnvironmentObject var store: SubscriptionStore
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            Brand.ink.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 24) {
                    header
                    if store.products.isEmpty {
                        ProgressView().tint(Brand.flame).padding(.vertical, 24)
                    } else {
                        if let plus = store.plusProduct {
                            PlanCard(
                                product: plus,
                                title: "Stakgod+",
                                features: ["200 messages / month", "Push notifications", "All app history"],
                                accent: Brand.flame
                            )
                        }
                        if let pro = store.proProduct {
                            PlanCard(
                                product: pro,
                                title: "Stakgod Pro",
                                features: ["1,000 messages / month", "Push notifications", "All app history", "Per-app analytics"],
                                accent: Brand.gold
                            )
                        }
                    }
                    legalFooter
                }
                .padding(20)
            }

            if store.isPurchasing {
                ProgressView("Processing…").tint(.white)
                    .padding(20)
                    .background(.ultraThinMaterial)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }
        }
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button("Close") { dismiss() }.tint(.white)
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button("Restore") { Task { await store.restorePurchases() } }.tint(Brand.flame)
            }
        }
        .alert("Error", isPresented: .constant(store.lastError != nil), presenting: store.lastError) { _ in
            Button("OK") { store.lastError = nil }
        } message: { msg in
            Text(msg)
        }
    }

    private var header: some View {
        VStack(spacing: 8) {
            Image(systemName: "sparkles")
                .font(.system(size: 36))
                .foregroundColor(Brand.gold)
            Text("Upgrade Stakgod")
                .font(.title.bold())
                .foregroundColor(.white)
            Text("More messages. More apps. Same great Claude.")
                .font(.subheadline)
                .foregroundColor(Brand.muted)
                .multilineTextAlignment(.center)
        }
        .padding(.top, 12)
    }

    private var legalFooter: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Subscriptions auto-renew at the end of each billing period unless cancelled at least 24 hours before. Manage or cancel anytime in Settings → Apple ID → Subscriptions.")
                .font(.caption2)
                .foregroundColor(Brand.muted)
            HStack {
                Link("Privacy", destination: URL(string: "https://stakgod.com/privacy")!)
                Text("·").foregroundColor(Brand.muted)
                Link("Terms", destination: URL(string: "https://stakgod.com/terms")!)
                Spacer()
            }
            .font(.caption2)
            .tint(Brand.flame)
        }
    }
}

private struct PlanCard: View {
    @EnvironmentObject var store: SubscriptionStore
    let product: Product
    let title: String
    let features: [String]
    let accent: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                Text(title).font(.title2.bold()).foregroundColor(.white)
                Spacer()
                VStack(alignment: .trailing) {
                    Text(product.displayPrice).font(.title3.bold()).foregroundColor(accent)
                    Text(product.subscriptionPeriodLabel).font(.caption2).foregroundColor(Brand.muted)
                }
            }
            ForEach(features, id: \.self) { f in
                HStack(spacing: 8) {
                    Image(systemName: "checkmark.circle.fill").foregroundColor(accent)
                    Text(f).foregroundColor(.white)
                }
            }
            Button { Task { await store.purchase(product) } } label: {
                Text(store.activeEntitlement == product.id ? "Active" : "Subscribe")
                    .bold()
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(store.activeEntitlement == product.id ? Brand.card : accent)
                    .foregroundColor(store.activeEntitlement == product.id ? Brand.muted : .black)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .disabled(store.activeEntitlement == product.id || store.isPurchasing)
        }
        .padding(16)
        .background(Brand.card)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(accent.opacity(0.3)))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}

private extension Product {
    var subscriptionPeriodLabel: String {
        guard let p = subscription?.subscriptionPeriod else { return "" }
        switch (p.unit, p.value) {
        case (.month, 1): return "per month"
        case (.month, let n): return "per \(n) months"
        case (.year, 1): return "per year"
        case (.week, 1): return "per week"
        case (.day, let n): return "per \(n) days"
        default: return ""
        }
    }
}
