import Foundation

enum APIError: LocalizedError {
    case invalidURL
    case http(Int, String?)
    case decoding
    case missingToken

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case let .http(code, body):
            return "HTTP \(code): \(body ?? "")"
        case .decoding:
            return "Could not read server response"
        case .missingToken:
            return "Not signed in"
        }
    }
}

final class APIClient {
    private let baseURL: URL
    private let session: URLSession

    init(baseURL: URL = Config.apiBaseURL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    private func request(
        path: String,
        method: String = "GET",
        token: String? = nil,
        jsonBody: Data? = nil
    ) throws -> URLRequest {
        guard let url = URL(string: path, relativeTo: baseURL) else {
            throw APIError.invalidURL
        }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        req.httpBody = jsonBody
        return req
    }

    private func perform<T: Decodable>(_ req: URLRequest) async throws -> T {
        let (data, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse else {
            throw APIError.http(-1, nil)
        }
        guard (200 ... 299).contains(http.statusCode) else {
            if let decoded = try? JSONDecoder().decode(APIErrorBody.self, from: data) {
                throw APIError.http(http.statusCode, decoded.error ?? decoded.code)
            }
            let text = String(data: data, encoding: .utf8)
            throw APIError.http(http.statusCode, text)
        }
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw APIError.decoding
        }
    }

    func register(email: String, password: String) async throws -> AuthResponse {
        let body = try JSONSerialization.data(withJSONObject: [
            "email": email,
            "password": password,
        ])
        let req = try request(path: "/auth/register", method: "POST", jsonBody: body)
        return try await perform(req)
    }

    func login(email: String, password: String) async throws -> AuthResponse {
        let body = try JSONSerialization.data(withJSONObject: [
            "email": email,
            "password": password,
        ])
        let req = try request(path: "/auth/login", method: "POST", jsonBody: body)
        return try await perform(req)
    }

    func products(token: String, query: String? = nil) async throws -> ProductsResponse {
        var path = "/products"
        if let query, !query.isEmpty {
            let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query
            path += "?q=\(encoded)"
        }
        let req = try request(path: path, token: token)
        return try await perform(req)
    }

    func createProject(token: String, name: String) async throws -> CreateProjectResponse {
        let body = try JSONSerialization.data(withJSONObject: ["name": name])
        let req = try request(path: "/projects", method: "POST", token: token, jsonBody: body)
        return try await perform(req)
    }

    func listProjects(token: String) async throws -> ProjectsListResponse {
        let req = try request(path: "/projects", token: token)
        return try await perform(req)
    }

    func getProject(token: String, projectId: String) async throws -> ProjectDetailResponse {
        let req = try request(path: "/projects/\(projectId)", token: token)
        return try await perform(req)
    }

    func updateProjectDimensions(
        token: String,
        projectId: String,
        roomLengthMm: Int,
        roomWidthMm: Int,
        ceilingHeightMm: Int
    ) async throws -> UpdateProjectResponse {
        let body = try JSONSerialization.data(withJSONObject: [
            "roomLengthMm": roomLengthMm,
            "roomWidthMm": roomWidthMm,
            "ceilingHeightMm": ceilingHeightMm,
        ])
        let req = try request(
            path: "/projects/\(projectId)",
            method: "PATCH",
            token: token,
            jsonBody: body
        )
        return try await perform(req)
    }

    func uploadFloorPlan(token: String, projectId: String, imageData: Data, filename: String, mime: String) async throws -> FloorPlanUploadResponse {
        guard let url = URL(string: "/projects/\(projectId)/floor-plan", relativeTo: baseURL) else {
            throw APIError.invalidURL
        }
        let boundary = "Boundary-\(UUID().uuidString)"
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        var body = Data()
        body.appendString("--\(boundary)\r\n")
        body.appendString("Content-Disposition: form-data; name=\"file\"; filename=\"\(filename)\"\r\n")
        body.appendString("Content-Type: \(mime)\r\n\r\n")
        body.append(imageData)
        body.appendString("\r\n")
        body.appendString("--\(boundary)--\r\n")
        req.httpBody = body

        return try await perform(req)
    }

    func createRender(token: String, projectId: String, prompt: String, productIds: [String]) async throws -> CreateRenderResponse {
        let body = try JSONSerialization.data(withJSONObject: [
            "prompt": prompt,
            "productIds": productIds,
        ])
        let req = try request(
            path: "/projects/\(projectId)/renders",
            method: "POST",
            token: token,
            jsonBody: body
        )
        return try await perform(req)
    }

    func usage(token: String) async throws -> UsageResponse {
        let req = try request(path: "/me/usage", token: token)
        return try await perform(req)
    }
}

private extension Data {
    mutating func appendString(_ s: String) {
        if let d = s.data(using: .utf8) {
            append(d)
        }
    }
}
