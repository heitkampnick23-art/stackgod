// StoreKit 2 subscription manager.
// Two product IDs (must match Stakgod.storekit + App Store Connect):
//   com.stakgod.ios.plus  — $9.99/mo, 200 messages/mo, push notifications
//   com.stakgod.ios.pro   — $24.99/mo, 1000 messages/mo, analytics
// On purchase: verify receipt with our backend so web platform sees plan upgrade.

import Foundation
import StoreKit

@MainActor
final class SubscriptionStore: ObservableObject {
    static let shared = SubscriptionStore()

    static let plusID = "com.stakgod.ios.plus"
    static let proID  = "com.stakgod.ios.pro"
    static let allIDs: Set<String> = [plusID, proID]

    @Published private(set) var products: [Product] = []
    @Published private(set) var activeEntitlement: String? = nil   // product id, or nil
    @Published var lastError: String?
    @Published var isPurchasing = false

    private var updatesTask: Task<Void, Never>?

    init() {
        updatesTask = Task { await listenForTransactionUpdates() }
    }

    deinit { updatesTask?.cancel() }

    var plusProduct: Product? { products.first(where: { $0.id == Self.plusID }) }
    var proProduct: Product?  { products.first(where: { $0.id == Self.proID }) }

    func refreshProducts() async {
        do {
            let fetched = try await Product.products(for: Self.allIDs)
            // Sort by price ascending so paywall shows Plus before Pro.
            self.products = fetched.sorted { $0.price < $1.price }
        } catch {
            self.lastError = "Couldn't load subscription products: \(error.localizedDescription)"
        }
    }

    func refreshEntitlements() async {
        for await result in Transaction.currentEntitlements {
            if case .verified(let txn) = result,
               Self.allIDs.contains(txn.productID),
               txn.revocationDate == nil,
               (txn.expirationDate ?? .distantPast) > Date() {
                self.activeEntitlement = txn.productID
                return
            }
        }
        self.activeEntitlement = nil
    }

    func purchase(_ product: Product) async {
        self.isPurchasing = true
        defer { self.isPurchasing = false }
        do {
            let result = try await product.purchase()
            switch result {
            case .success(let verification):
                switch verification {
                case .verified(let txn):
                    await reportToBackend(txn: txn)
                    await txn.finish()
                    await refreshEntitlements()
                case .unverified(_, let err):
                    self.lastError = "Apple couldn't verify the purchase: \(err.localizedDescription)"
                }
            case .userCancelled:
                break
            case .pending:
                self.lastError = "Purchase pending (e.g. Ask to Buy). You'll be billed once approved."
            @unknown default:
                self.lastError = "Unexpected purchase result."
            }
        } catch {
            self.lastError = "Purchase failed: \(error.localizedDescription)"
        }
    }

    func restorePurchases() async {
        do {
            try await AppStore.sync()
            await refreshEntitlements()
        } catch {
            self.lastError = "Restore failed: \(error.localizedDescription)"
        }
    }

    private func listenForTransactionUpdates() async {
        for await update in Transaction.updates {
            if case .verified(let txn) = update {
                await reportToBackend(txn: txn)
                await txn.finish()
                await refreshEntitlements()
            }
        }
    }

    // Tell our backend the user has an active iOS subscription so /builder/chat
    // uses the matching plan tier. Backend route: POST /billing/apple/verify
    private func reportToBackend(txn: Transaction) async {
        struct Body: Encodable { let product_id: String; let transaction_id: String; let original_transaction_id: String }
        let body = Body(
            product_id: txn.productID,
            transaction_id: String(txn.id),
            original_transaction_id: String(txn.originalID)
        )
        _ = try? await APIClient.shared.post("/billing/apple/verify", body: body, as: EmptyResponse.self)
    }
}
