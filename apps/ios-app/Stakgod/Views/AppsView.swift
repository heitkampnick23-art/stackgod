// List of the signed-in user's apps. Tap to open a live WKWebView preview.

import SwiftUI
import WebKit

struct AppsView: View {
    @State private var apps: [UserApp] = []
    @State private var loading = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.ink.ignoresSafeArea()
                Group {
                    if loading && apps.isEmpty {
                        ProgressView().tint(Brand.flame)
                    } else if let err = error, apps.isEmpty {
                        VStack(spacing: 12) {
                            Image(systemName: "exclamationmark.triangle")
                                .font(.largeTitle).foregroundColor(.orange)
                            Text(err).foregroundColor(Brand.muted).multilineTextAlignment(.center)
                            Button("Try again") { Task { await load() } }
                                .buttonStyle(.borderedProminent).tint(Brand.flame)
                        }.padding()
                    } else if apps.isEmpty {
                        VStack(spacing: 12) {
                            Image(systemName: "sparkles")
                                .font(.largeTitle).foregroundColor(Brand.gold)
                            Text("No apps yet.").foregroundColor(.white).font(.title3)
                            Text("Open stakgod.com to build your first one — it'll show up here.")
                                .foregroundColor(Brand.muted)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, 32)
                        }
                    } else {
                        ScrollView {
                            LazyVStack(spacing: 12) {
                                ForEach(apps) { app in
                                    NavigationLink(destination: AppPreviewView(app: app)) {
                                        AppRow(app: app)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            .padding(.horizontal, 16)
                            .padding(.bottom, 24)
                        }
                    }
                }
            }
            .navigationTitle("My Apps")
            .refreshable { await load() }
            .task { if apps.isEmpty { await load() } }
        }
    }

    private func load() async {
        loading = true
        defer { loading = false }
        do {
            let resp = try await APIClient.shared.get("/apps", as: AppsResponse.self)
            self.apps = resp.apps
            self.error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }
}

private struct AppRow: View {
    let app: UserApp
    var body: some View {
        HStack(spacing: 12) {
            AsyncImage(url: app.iconURL) { img in
                img.resizable().scaledToFill()
            } placeholder: {
                Rectangle().fill(Brand.card)
            }
            .frame(width: 56, height: 56)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            VStack(alignment: .leading, spacing: 4) {
                Text(app.name).font(.headline).foregroundColor(.white)
                Text(app.tagline ?? app.liveURL.host ?? "").font(.subheadline).foregroundColor(Brand.muted).lineLimit(1)
                Text(app.status.uppercased()).font(.caption2).foregroundColor(app.status == "live" ? .green : Brand.muted)
            }
            Spacer()
            Image(systemName: "chevron.right").foregroundColor(Brand.muted)
        }
        .padding(12)
        .background(Brand.card)
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Brand.line))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}

private struct AppPreviewView: View {
    let app: UserApp
    var body: some View {
        WebView(url: app.liveURL)
            .navigationTitle(app.name)
            .navigationBarTitleDisplayMode(.inline)
    }
}

struct WebView: UIViewRepresentable {
    let url: URL
    func makeUIView(context: Context) -> WKWebView {
        let cfg = WKWebViewConfiguration()
        cfg.defaultWebpagePreferences.allowsContentJavaScript = true
        let wv = WKWebView(frame: .zero, configuration: cfg)
        wv.scrollView.bounces = false
        wv.load(URLRequest(url: url))
        return wv
    }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
