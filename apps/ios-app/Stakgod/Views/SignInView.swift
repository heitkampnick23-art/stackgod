// First-run + sign-out screen. Sign in with Apple only (Apple requires
// us to support it since other social logins exist on the web platform).

import SwiftUI
import AuthenticationServices

struct SignInView: View {
    @EnvironmentObject var auth: AuthStore

    var body: some View {
        ZStack {
            Brand.ink.ignoresSafeArea()
            VStack(spacing: 32) {
                Spacer()
                VStack(spacing: 12) {
                    Text("STAKGOD")
                        .font(.system(size: 48, weight: .bold, design: .serif))
                        .foregroundColor(.white)
                        .tracking(4)
                    Text("Build apps by talking to Claude.")
                        .font(.title3)
                        .foregroundColor(Brand.muted)
                        .multilineTextAlignment(.center)
                }
                Spacer()
                VStack(spacing: 12) {
                    SignInWithAppleButton(.signIn) { req in
                        req.requestedScopes = [.email, .fullName]
                    } onCompletion: { result in
                        Task { await auth.handleAppleSignIn(result) }
                    }
                    .signInWithAppleButtonStyle(.white)
                    .frame(height: 50)
                    .cornerRadius(12)

                    if let err = auth.lastError {
                        Text(err)
                            .font(.footnote)
                            .foregroundColor(.red)
                            .multilineTextAlignment(.center)
                    }

                    Text("By signing in you agree to the [Terms](https://stakgod.com/terms) and [Privacy Policy](https://stakgod.com/privacy).")
                        .font(.caption2)
                        .foregroundColor(Brand.muted)
                        .multilineTextAlignment(.center)
                        .tint(Brand.flame)
                        .padding(.top, 8)
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 40)
            }
        }
    }
}
