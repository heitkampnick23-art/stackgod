// Sign in with Apple → exchanges Apple's id_token for a Stakgod session.
// Backend route: POST /auth/apple/ios — accepts id_token, returns sg_session.
// Session token is stored in Keychain. Same backend session as web platform.

import AuthenticationServices
import Foundation
import SwiftUI

@MainActor
final class AuthStore: NSObject, ObservableObject {
    static let shared = AuthStore()

    @Published private(set) var signedIn = false
    @Published private(set) var userEmail: String?
    @Published private(set) var plan: String = "free"
    @Published var lastError: String?

    private(set) var sessionToken: String?

    private let kKey = "sg_session_token"
    private let kEmail = "sg_user_email"
    private let kPlan = "sg_user_plan"

    override init() {
        super.init()
    }

    func restoreSession() async {
        if let token = Keychain.read(kKey) {
            self.sessionToken = token
            self.userEmail = UserDefaults.standard.string(forKey: kEmail)
            self.plan = UserDefaults.standard.string(forKey: kPlan) ?? "free"
            self.signedIn = true
            await refreshMe()
        }
    }

    func handleAppleSignIn(_ result: Result<ASAuthorization, Error>) async {
        switch result {
        case .failure(let err):
            self.lastError = "Apple sign-in failed: \(err.localizedDescription)"
        case .success(let auth):
            guard let cred = auth.credential as? ASAuthorizationAppleIDCredential,
                  let tokenData = cred.identityToken,
                  let idToken = String(data: tokenData, encoding: .utf8) else {
                self.lastError = "Missing Apple id_token."
                return
            }
            do {
                struct Body: Encodable { let id_token: String; let name: String? }
                struct Resp: Decodable { let session: String; let email: String; let plan: String }
                let name = [cred.fullName?.givenName, cred.fullName?.familyName]
                    .compactMap { $0 }.joined(separator: " ")
                let resp = try await APIClient.shared.post(
                    "/auth/apple/ios",
                    body: Body(id_token: idToken, name: name.isEmpty ? nil : name),
                    as: Resp.self
                )
                Keychain.write(kKey, value: resp.session)
                UserDefaults.standard.set(resp.email, forKey: kEmail)
                UserDefaults.standard.set(resp.plan, forKey: kPlan)
                self.sessionToken = resp.session
                self.userEmail = resp.email
                self.plan = resp.plan
                self.signedIn = true
                self.lastError = nil
            } catch {
                self.lastError = "Server rejected sign-in: \(error.localizedDescription)"
            }
        }
    }

    func signOut() {
        Keychain.delete(kKey)
        UserDefaults.standard.removeObject(forKey: kEmail)
        UserDefaults.standard.removeObject(forKey: kPlan)
        self.sessionToken = nil
        self.userEmail = nil
        self.plan = "free"
        self.signedIn = false
    }

    private func refreshMe() async {
        struct Resp: Decodable { let user: UserRow? }
        struct UserRow: Decodable { let email: String; let plan: String }
        do {
            let resp = try await APIClient.shared.get("/auth/me", as: Resp.self)
            if let u = resp.user {
                self.userEmail = u.email
                self.plan = u.plan
                UserDefaults.standard.set(u.email, forKey: kEmail)
                UserDefaults.standard.set(u.plan, forKey: kPlan)
            }
        } catch {
            // Session probably expired — sign out clean.
            self.signOut()
        }
    }
}

// Minimal Keychain wrapper for the session token only.
enum Keychain {
    private static let service = "com.stakgod.ios"

    static func write(_ account: String, value: String) {
        let data = Data(value.utf8)
        let q: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(q as CFDictionary)
        var add = q
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(add as CFDictionary, nil)
    }

    static func read(_ account: String) -> String? {
        let q: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(q as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data,
              let str = String(data: data, encoding: .utf8) else { return nil }
        return str
    }

    static func delete(_ account: String) {
        let q: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(q as CFDictionary)
    }
}
