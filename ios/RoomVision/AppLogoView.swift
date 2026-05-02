import SwiftUI

struct AppLogoView: View {
    var body: some View {
        ZStack {
            Circle()
                .fill(
                    LinearGradient(
                        colors: [Color.purple, Color.blue, Color.cyan],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 90, height: 90)
                .shadow(color: .blue.opacity(0.25), radius: 12, x: 0, y: 8)

            Image(systemName: "sparkles")
                .font(.system(size: 36, weight: .bold))
                .foregroundStyle(.white)
        }
        .overlay(alignment: .bottomTrailing) {
            Circle()
                .fill(Color.orange)
                .frame(width: 26, height: 26)
                .overlay {
                    Image(systemName: "cube.fill")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(.white)
                }
        }
        .accessibilityLabel("RoomVision temporary logo")
    }
}
