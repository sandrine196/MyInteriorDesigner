import Foundation

struct AuthResponse: Decodable {
    let token: String
    let user: UserSummary
}

struct UserSummary: Decodable {
    let id: String
    let email: String
    let tier: String
}

struct APIErrorBody: Decodable {
    let error: String?
    let code: String?
    let missing: [String]?
}

struct ProductDTO: Decodable, Identifiable {
    let id: String
    let retailer: String
    let title: String
    let imageUrl: String
    let productUrl: String
    let affiliateUrl: String?
    let widthMm: Int?
    let depthMm: Int?
    let heightMm: Int?
    let dimensionsRaw: String?
    let priceGbp: Double?
    let category: String?
}

struct ProductsResponse: Decodable {
    let items: [ProductDTO]
}

struct ProjectDTO: Decodable, Identifiable {
    let id: String
    let name: String
    let floorPlanKey: String?
    /// Millimetres — longer floor axis (user-entered, from their plan).
    let roomLengthMm: Int?
    /// Millimetres — shorter floor axis.
    let roomWidthMm: Int?
    /// Millimetres — floor to ceiling.
    let ceilingHeightMm: Int?
    let createdAt: String?
}

struct ProjectWithRenders: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let floorPlanKey: String?
    let roomLengthMm: Int?
    let roomWidthMm: Int?
    let ceilingHeightMm: Int?
    let createdAt: String?
    let renders: [RenderDTO]?

    static func == (lhs: ProjectWithRenders, rhs: ProjectWithRenders) -> Bool {
        lhs.id == rhs.id
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
}

struct RenderDTO: Decodable, Identifiable, Hashable {
    let id: String
    let status: String
    let prompt: String?
    let imageUrl: String?
    let errorMessage: String?
}

struct ProjectsListResponse: Decodable {
    let projects: [ProjectWithRenders]
}

struct ProjectDetailResponse: Decodable {
    let project: ProjectWithRenders
}

struct CreateProjectResponse: Decodable {
    let project: ProjectDTO
}

struct UpdateProjectResponse: Decodable {
    let project: ProjectWithRenders
}

struct FloorPlanUploadResponse: Decodable {
    let floorPlanUrl: String
}

struct CreateRenderResponse: Decodable {
    let render: RenderResultDTO
}

struct RenderResultDTO: Decodable {
    let id: String
    let status: String
    let imageUrl: String
    let skippedApi: Bool?
}

struct UsageResponse: Decodable {
    let tier: String
    let freeLimit: Int
    let usedThisMonth: Int
    let remaining: Int?
}
