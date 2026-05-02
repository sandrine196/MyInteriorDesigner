import PhotosUI
import SwiftUI
import UIKit

struct ProjectWorkspaceView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var projectModel: ProjectWithRenders

    @State private var search = ""
    @State private var products: [ProductDTO] = []
    @State private var selected: Set<String> = []
    @State private var prompt = "Warm minimalist UK living room, natural light, oak accents."
    @State private var pickerItem: PhotosPickerItem?
    @State private var floorUploaded = false
    @State private var busy = false
    @State private var message: String?
    @State private var lastRenderURL: URL?

    /// Metres as typed by the user (UK decimal point).
    @State private var roomLengthM = ""
    @State private var roomWidthM = ""
    @State private var ceilingHeightM = ""

    init(project: ProjectWithRenders) {
        _projectModel = State(initialValue: project)
    }

    private var dimensionsComplete: Bool {
        projectModel.roomLengthMm != nil
            && projectModel.roomWidthMm != nil
            && projectModel.ceilingHeightMm != nil
    }

    private var canGenerate: Bool {
        let hasPlan = floorUploaded || projectModel.floorPlanKey != nil
        return !busy
            && !selected.isEmpty
            && hasPlan
            && dimensionsComplete
    }

    var body: some View {
        Form {
            Section("Floor plan") {
                PhotosPicker("Choose image (JPEG / PNG)", selection: $pickerItem, matching: .images)
                if floorUploaded || projectModel.floorPlanKey != nil {
                    Text("Floor plan uploaded").foregroundStyle(.secondary)
                }
            }

            Section {
                Text(
                    "Enter the room’s floor footprint (length × width) and ceiling height, in metres, matching your plan. These values set scale so furniture sizes can be judged against the room."
                )
                .font(.footnote)
                .foregroundStyle(.secondary)

                TextField("Room length (m)", text: $roomLengthM)
                    .keyboardType(.decimalPad)
                TextField("Room width (m)", text: $roomWidthM)
                    .keyboardType(.decimalPad)
                TextField("Ceiling height (m)", text: $ceilingHeightM)
                    .keyboardType(.decimalPad)

                Button("Save room dimensions") {
                    Task { await saveDimensions() }
                }
                .disabled(busy)

                if (floorUploaded || projectModel.floorPlanKey != nil), !dimensionsComplete {
                    Text("Dimensions are required before generating a render.")
                        .font(.footnote)
                        .foregroundStyle(.orange)
                }
            } header: {
                Text("Room dimensions (required)")
            }

            Section("Products") {
                HStack {
                    TextField("Search", text: $search)
                    Button("Search") {
                        Task { await loadProducts() }
                    }
                }
                ForEach(products) { p in
                    Toggle(isOn: Binding(
                        get: { selected.contains(p.id) },
                        set: { on in
                            if on { selected.insert(p.id) } else { selected.remove(p.id) }
                        }
                    )) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(p.title).font(.headline)
                            Text(p.retailer).font(.caption).foregroundStyle(.secondary)
                            if let w = p.widthMm, let d = p.depthMm, let h = p.heightMm {
                                Text("\(w)×\(d)×\(h) mm")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            } else if let raw = p.dimensionsRaw {
                                Text(raw).font(.caption2).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }

            Section("Prompt") {
                TextEditor(text: $prompt)
                    .frame(minHeight: 120)
            }

            if let message {
                Section {
                    Text(message).foregroundStyle(.red)
                }
            }

            Section {
                Button("Generate render") {
                    Task { await generate() }
                }
                .disabled(!canGenerate)
            }

            if let lastRenderURL {
                Section("Latest render") {
                    AsyncImage(url: lastRenderURL) { phase in
                        switch phase {
                        case .empty:
                            ProgressView()
                        case let .success(img):
                            img.resizable().scaledToFit()
                        case .failure:
                            Text("Could not load image")
                        @unknown default:
                            EmptyView()
                        }
                    }
                }
            }
        }
        .navigationTitle(projectModel.name)
        .task {
            floorUploaded = projectModel.floorPlanKey != nil
            syncDimensionFieldsFromProject()
            await refreshProject()
            syncDimensionFieldsFromProject()
            await loadProducts()
        }
        .onChange(of: pickerItem) { _, newItem in
            Task { await uploadFloorPlan(item: newItem) }
        }
    }

    private func syncDimensionFieldsFromProject() {
        roomLengthM = metersString(projectModel.roomLengthMm)
        roomWidthM = metersString(projectModel.roomWidthMm)
        ceilingHeightM = metersString(projectModel.ceilingHeightMm)
    }

    private func metersString(_ mm: Int?) -> String {
        guard let mm else { return "" }
        return String(format: "%.2f", Double(mm) / 1000.0)
    }

    private func parseMeters(_ raw: String) -> Double? {
        let t = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: ",", with: ".")
        guard !t.isEmpty else { return nil }
        return Double(t)
    }

    private func refreshProject() async {
        guard let token = try? session.requireToken() else { return }
        do {
            let res = try await session.apiClient().getProject(
                token: token,
                projectId: projectModel.id
            )
            projectModel = res.project
            floorUploaded = projectModel.floorPlanKey != nil
        } catch {
            // Keep local state if offline; avoid noisy errors on first paint.
        }
    }

    private func saveDimensions() async {
        guard let token = try? session.requireToken() else { return }
        guard let l = parseMeters(roomLengthM),
              let w = parseMeters(roomWidthM),
              let c = parseMeters(ceilingHeightM),
              l > 0, w > 0, c > 0
        else {
            message = "Enter positive numbers for length, width, and ceiling height (metres), e.g. 4.2"
            return
        }
        let maxM = 100.0
        guard l <= maxM, w <= maxM, c <= maxM else {
            message = "Values look too large. Check metres (e.g. 4.5 not 4500)."
            return
        }
        let lm = Int((l * 1000).rounded())
        let wm = Int((w * 1000).rounded())
        let cm = Int((c * 1000).rounded())
        busy = true
        message = nil
        defer { busy = false }
        do {
            let res = try await session.apiClient().updateProjectDimensions(
                token: token,
                projectId: projectModel.id,
                roomLengthMm: lm,
                roomWidthMm: wm,
                ceilingHeightMm: cm
            )
            projectModel = res.project
            message = "Room dimensions saved."
        } catch {
            message = error.localizedDescription
        }
    }

    private func loadProducts() async {
        guard let token = try? session.requireToken() else { return }
        message = nil
        do {
            let q = search.trimmingCharacters(in: .whitespacesAndNewlines)
            let res = try await session.apiClient().products(
                token: token,
                query: q.isEmpty ? nil : q
            )
            products = res.items
        } catch {
            message = error.localizedDescription
        }
    }

    private func uploadFloorPlan(item: PhotosPickerItem?) async {
        guard let item else { return }
        guard let token = try? session.requireToken() else { return }
        let rawData: Data
        do {
            guard let loaded = try await item.loadTransferable(type: Data.self) else {
                message = "Could not read image"
                return
            }
            rawData = loaded
        } catch {
            message = "Could not read image"
            return
        }
        let data: Data
        let mime: String
        let filename: String
        if rawData.count >= 4,
           rawData[0] == 0x89, rawData[1] == 0x50, rawData[2] == 0x4E, rawData[3] == 0x47
        {
            data = rawData
            mime = "image/png"
            filename = "floorplan.png"
        } else if let ui = UIImage(data: rawData), let jpeg = ui.jpegData(compressionQuality: 0.92) {
            data = jpeg
            mime = "image/jpeg"
            filename = "floorplan.jpg"
        } else {
            message = "Could not read image"
            return
        }
        busy = true
        message = nil
        defer { busy = false }
        do {
            _ = try await session.apiClient().uploadFloorPlan(
                token: token,
                projectId: projectModel.id,
                imageData: data,
                filename: filename,
                mime: mime
            )
            floorUploaded = true
            await refreshProject()
            if !dimensionsComplete {
                message = "Floor plan saved. Enter room length, width, and ceiling height (metres), then tap Save."
            }
        } catch {
            message = error.localizedDescription
        }
    }

    private func generate() async {
        guard let token = try? session.requireToken() else { return }
        busy = true
        message = nil
        defer { busy = false }
        do {
            let res = try await session.apiClient().createRender(
                token: token,
                projectId: projectModel.id,
                prompt: prompt,
                productIds: Array(selected)
            )
            let path = res.render.imageUrl
            if path.hasPrefix("http") {
                lastRenderURL = URL(string: path)
            } else {
                lastRenderURL = URL(string: path, relativeTo: Config.apiBaseURL)
            }
            if res.render.skippedApi == true {
                message = "Server has no GEMINI_API_KEY; placeholder image returned. Add a key to test Nano Banana."
            }
        } catch let e as APIError {
            message = e.localizedDescription
        } catch {
            message = error.localizedDescription
        }
    }
}
