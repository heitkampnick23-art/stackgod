// Thin HTTP client for api.stakgod.com.
// Uses the session cookie from AuthStore so the iOS app shares
// the same backend session as the web platform.

import Foundation

enum APIError: Error, LocalizedError {
    case notAuthenticated
    case requestFailed(Int, String)
    case decodingFailed

    var errorDescription: String? {
        switch self {
        case .notAuthenticated: return "Not signed in."
        case .requestFailed(let code, let msg): return "Request failed (\(code)): \(msg)"
        case .decodingFailed: return "Couldn't read server response."
        }
    }
}

final class APIClient {
    static let shared = APIClient()
    private let base = URL(string: "https://api.stakgod.com")!
    private let session = URLSession.shared

    func get<T: Decodable>(_ path: String, as: T.Type) async throws -> T {
        try await request(path: path, method: "GET", body: nil)
    }

    func post<T: Decodable, B: Encodable>(_ path: String, body: B, as: T.Type) async throws -> T {
        try await request(path: path, method: "POST", body: body)
    }

    private func request<T: Decodable, B: Encodable>(path: String, method: String, body: B?) async throws -> T {
        var req = URLRequest(url: base.appendingPathComponent(path))
        req.httpMethod = method
        if let token = AuthStore.shared.sessionToken {
            req.setValue("sg_session=\(token)", forHTTPHeaderField: "Cookie")
        }
        if let body = body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONEncoder().encode(body)
        }
        let (data, resp) = try await session.data(for: req)
        guard let http = resp as? HTTPURLResponse else { throw APIError.requestFailed(0, "no response") }
        guard (200..<300).contains(http.statusCode) else {
            let msg = String(data: data, encoding: .utf8) ?? ""
            throw APIError.requestFailed(http.statusCode, msg)
        }
        // Allow EmptyResponse decoded as empty struct
        if T.self == EmptyResponse.self, let v = EmptyResponse() as? T { return v }
        do { return try JSONDecoder().decode(T.self, from: data) }
        catch { throw APIError.decodingFailed }
    }
}

// Helper for endpoints that don't return a body we care about.
struct EmptyResponse: Decodable {}
// Helper for body-less POSTs.
struct EmptyBody: Encodable {}
