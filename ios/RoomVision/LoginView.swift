import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var isCreateMode = false
    @State private var email = ""
    @State private var password = ""
    @State private var errorMessage: String?
    @State private var busy = false

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient(
                    colors: [Color.blue.opacity(0.15), Color.indigo.opacity(0.1), Color.white],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()

                VStack(spacing: 20) {
                    VStack(spacing: 6) {
                        AppLogoView()
                            .padding(.bottom, 6)
                        Text("RoomVision")
                            .font(.largeTitle.bold())
                        Text("Sign in to create floor-plan based room renders.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }

                    VStack(spacing: 14) {
                        Picker("Mode", selection: $isCreateMode) {
                            Text("Sign In").tag(false)
                            Text("Create Account").tag(true)
                        }
                        .pickerStyle(.segmented)

                        TextField("Email", text: $email)
                            .textContentType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .keyboardType(.emailAddress)
                            .padding(12)
                            .background(Color(.secondarySystemBackground))
                            .clipShape(RoundedRectangle(cornerRadius: 10))

                        SecureField("Password (min 8 characters)", text: $password)
                            .padding(12)
                            .background(Color(.secondarySystemBackground))
                            .clipShape(RoundedRectangle(cornerRadius: 10))

                        if let errorMessage {
                            Text(errorMessage)
                                .font(.footnote)
                                .foregroundStyle(.red)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }

                        Button(isCreateMode ? "Create account" : "Sign in") {
                            Task { await submit(login: !isCreateMode) }
                        }
                        .buttonStyle(.borderedProminent)
                        .frame(maxWidth: .infinity)
                        .disabled(busy || !isValid)

                        if busy {
                            ProgressView()
                                .frame(maxWidth: .infinity, alignment: .center)
                        }

                        if !isCreateMode {
                            Button("Forgot password?") {
                                errorMessage = "Password reset flow is not wired yet in MVP."
                            }
                            .font(.footnote)
                            .buttonStyle(.plain)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .foregroundStyle(.secondary)
                        }
                    }
                    .padding(20)
                    .background(.ultraThinMaterial)
                    .clipShape(RoundedRectangle(cornerRadius: 18))
                    .shadow(color: .black.opacity(0.08), radius: 18, x: 0, y: 10)
                }
                .padding(.horizontal, 20)
            }
            .navigationBarHidden(true)
        }
    }

    private var isValid: Bool {
        email.contains("@") && password.count >= 8
    }

    private func submit(login: Bool) async {
        errorMessage = nil
        busy = true
        defer { busy = false }
        do {
            if login {
                try await session.login(email: email, password: password)
            } else {
                try await session.register(email: email, password: password)
            }
        } catch let e as APIError {
            errorMessage = e.localizedDescription
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
