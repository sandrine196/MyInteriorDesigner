import Foundation

enum Config {
    /// Simulator: Mac localhost. Device: use your machine IP (same Wi‑Fi), e.g. `http://192.168.1.10:3000`.
    static let apiBaseURL = URL(string: "http://127.0.0.1:3000")!
}
