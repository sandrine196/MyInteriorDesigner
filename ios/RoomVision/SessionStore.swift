import Foundation
import SwiftUI

@MainActor
final class SessionStore: ObservableObject {
    @AppStorage("roomvision_token") private var storedToken: String = ""

    @Published private(set) var token: String?
    @Published private(set) var email: String?

    private let api = APIClient()

    init() {
        if !storedToken.isEmpty {
            token = storedToken
        }
    }

    var isSignedIn: Bool {
        token != nil && !(token?.isEmpty ?? true)
    }

    func register(email: String, password: String) async throws {
        let res = try await api.register(email: email, password: password)
        applyAuth(email: res.user.email, token: res.token)
    }

    func login(email: String, password: String) async throws {
        let res = try await api.login(email: email, password: password)
        applyAuth(email: res.user.email, token: res.token)
    }

    func signOut() {
        token = nil
        email = nil
        storedToken = ""
    }

    private func applyAuth(email: String, token: String) {
        self.email = email
        self.token = token
        storedToken = token
    }

    func apiClient() -> APIClient {
        api
    }

    func requireToken() throws -> String {
        guard let t = token, !t.isEmpty else {
            throw APIError.missingToken
        }
        return t
    }
}
