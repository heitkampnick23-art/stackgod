// Chat with Claude to brainstorm or edit an existing app.
// Intentionally does NOT submit new apps to the App Store from inside iOS
// (per Apple Guideline 4.2.6 — that flow stays web-only).

import SwiftUI

struct BuildView: View {
    @State private var messages: [ChatMessage] = []
    @State private var input: String = ""
    @State private var sending = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.ink.ignoresSafeArea()
                VStack(spacing: 0) {
                    ScrollViewReader { proxy in
                        ScrollView {
                            LazyVStack(alignment: .leading, spacing: 12) {
                                if messages.isEmpty {
                                    EmptyStateCard()
                                }
                                ForEach(messages) { m in
                                    Bubble(m: m).id(m.id)
                                }
                            }
                            .padding(16)
                        }
                        .onChange(of: messages.count) { _, _ in
                            if let last = messages.last { withAnimation { proxy.scrollTo(last.id, anchor: .bottom) } }
                        }
                    }

                    if let err = error {
                        Text(err).font(.footnote).foregroundColor(.red).padding(.horizontal)
                    }

                    HStack(spacing: 8) {
                        TextField("Ask Claude…", text: $input, axis: .vertical)
                            .textFieldStyle(.plain)
                            .lineLimit(1...4)
                            .padding(12)
                            .background(Brand.card)
                            .clipShape(RoundedRectangle(cornerRadius: 22))
                            .foregroundColor(.white)
                        Button {
                            Task { await send() }
                        } label: {
                            Image(systemName: sending ? "hourglass" : "arrow.up.circle.fill")
                                .font(.system(size: 32))
                                .foregroundColor(input.isEmpty ? Brand.muted : Brand.flame)
                        }
                        .disabled(input.isEmpty || sending)
                    }
                    .padding(12)
                    .background(Brand.ink)
                }
            }
            .navigationTitle("Build")
        }
    }

    private func send() async {
        let text = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        sending = true; error = nil
        let local = ChatMessage(id: UUID().uuidString, role: "user", content: text, created_at: Int(Date().timeIntervalSince1970))
        messages.append(local)
        input = ""
        do {
            struct Body: Encodable { let message: String }
            struct Resp: Decodable { let reply: String }
            // NOTE: backend has the streaming /builder/chat endpoint; for v1 of the iOS
            // app we use a sync wrapper (/builder/chat-sync) that returns the full reply.
            let resp = try await APIClient.shared.post("/builder/chat-sync", body: Body(message: text), as: Resp.self)
            messages.append(ChatMessage(
                id: UUID().uuidString, role: "assistant", content: resp.reply,
                created_at: Int(Date().timeIntervalSince1970)
            ))
        } catch APIError.requestFailed(402, _) {
            error = "You've hit today's free message limit. Open Account → upgrade."
        } catch {
            self.error = error.localizedDescription
        }
        sending = false
    }
}

private struct EmptyStateCard: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Try asking:").foregroundColor(Brand.muted).font(.caption)
            VStack(alignment: .leading, spacing: 8) {
                Suggestion(text: "Change my habit tracker's primary color to teal.")
                Suggestion(text: "Add a streak chart to the home screen.")
                Suggestion(text: "Brainstorm 5 names for a recipe app for one-pot meals.")
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Brand.card)
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Brand.line))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}

private struct Suggestion: View {
    let text: String
    var body: some View {
        Text("• \(text)").foregroundColor(.white.opacity(0.85)).font(.subheadline)
    }
}

private struct Bubble: View {
    let m: ChatMessage
    var body: some View {
        HStack {
            if m.role == "user" { Spacer(minLength: 40) }
            Text(m.content)
                .foregroundColor(.white)
                .padding(12)
                .background(m.role == "user" ? Brand.flame.opacity(0.25) : Brand.card)
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(m.role == "user" ? Brand.flame.opacity(0.5) : Brand.line))
                .clipShape(RoundedRectangle(cornerRadius: 14))
            if m.role == "assistant" { Spacer(minLength: 40) }
        }
    }
}
