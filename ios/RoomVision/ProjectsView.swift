import SwiftUI

struct ProjectsView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var projects: [ProjectWithRenders] = []
    @State private var usage: UsageResponse?
    @State private var loadError: String?
    @State private var busy = false
    @State private var newName = "Living room"

    var body: some View {
        NavigationStack {
            List {
                if let usage {
                    Section {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Plan: \(usage.tier)")
                            if let remaining = usage.remaining {
                                Text("Free renders left this month: \(remaining) / \(usage.freeLimit)")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            } else {
                                Text("Pro: unlimited renders (server enforced later)")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }

                Section("New project") {
                    HStack {
                        TextField("Name", text: $newName)
                        Button("Create") {
                            Task { await createProject() }
                        }
                        .disabled(busy || newName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                }

                Section("Your projects") {
                    if let loadError {
                        Text(loadError).foregroundStyle(.red)
                    }
                    ForEach(projects) { p in
                        NavigationLink(value: p) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(p.name).font(.headline)
                                if p.floorPlanKey != nil {
                                    Text("Floor plan uploaded").font(.caption).foregroundStyle(.secondary)
                                } else {
                                    Text("Needs floor plan").font(.caption).foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Projects")
            .navigationDestination(for: ProjectWithRenders.self) { project in
                ProjectWorkspaceView(project: project)
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Sign out") {
                        session.signOut()
                    }
                }
            }
            .task {
                await refresh()
            }
            .refreshable {
                await refresh()
            }
        }
    }

    private func refresh() async {
        loadError = nil
        guard let token = try? session.requireToken() else { return }
        busy = true
        defer { busy = false }
        do {
            async let list = session.apiClient().listProjects(token: token)
            async let u = session.apiClient().usage(token: token)
            projects = try await list.projects
            usage = try await u
        } catch {
            loadError = error.localizedDescription
        }
    }

    private func createProject() async {
        guard let token = try? session.requireToken() else { return }
        let name = newName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }
        busy = true
        defer { busy = false }
        do {
            _ = try await session.apiClient().createProject(token: token, name: name)
            await refresh()
        } catch {
            loadError = error.localizedDescription
        }
    }
}
