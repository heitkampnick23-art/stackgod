// Shared models matching the backend JSON shape returned by /apps + /builder/messages.

import Foundation

struct UserApp: Identifiable, Decodable, Hashable {
    let id: String
    let slug: String
    let name: String
    let status: String              // draft | live | archived
    let custom_domain: String?
    let is_public: Int?
    let tagline: String?
    let fork_price_cents: Int?

    var liveURL: URL {
        if let d = custom_domain, !d.isEmpty { return URL(string: "https://\(d)/")! }
        return URL(string: "https://apps.stakgod.com/\(slug)/")!
    }
    var iconURL: URL {
        URL(string: "https://apps.stakgod.com/\(slug)/icon.png")!
    }
}

struct AppsResponse: Decodable { let apps: [UserApp] }

struct ChatMessage: Identifiable, Decodable, Hashable {
    let id: String
    let role: String                // user | assistant
    let content: String
    let created_at: Int
}

struct MessagesResponse: Decodable { let messages: [ChatMessage] }
