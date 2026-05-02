import SwiftUI

struct RootView: View {
    @EnvironmentObject private var session: SessionStore

    var body: some View {
        Group {
            if session.isSignedIn {
                ProjectsView()
            } else {
                LoginView()
            }
        }
    }
}
