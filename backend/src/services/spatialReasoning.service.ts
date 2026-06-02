// Spatial reasoning for room layout — uses entrance/far/left/right wall roles
// (NOT compass directions — all positions are from the doorway perspective)

type WallRole = "entrance" | "far" | "left" | "right";

interface DoorFeature {
  type: "door";
  subtype: "single" | "double" | "sliding" | "bifold" | "sliding_patio" | "pocket";
  widthCm: number;
  opensInward: boolean;
  hingeSide: "left" | "right";
  leadsTo?: "garden" | "balcony" | "hallway" | "unknown";
  isGlazed?: boolean;
  floorToCeiling?: boolean;
}

interface WindowFeature {
  type: "window";
  subtype: "single" | "double" | "triple" | "bay_angular" | "bow" | "box_bay" | "sash" | "floor_to_ceiling";
  widthCm: number;
  heightCm: number;
  heightFromFloorCm: number;
  hasRadiatorBelow: boolean;
  projectionCm?: number;
  hasWindowSeat?: boolean;
}

interface FireplaceFeature {
  type: "fireplace";
  subtype: "traditional" | "inset" | "freestanding" | "electric";
  chimneyBreastWidthCm?: number;
}

type WallFeature = DoorFeature | WindowFeature | FireplaceFeature | { type: "nothing" };

interface RoomFeatures {
  walls: Record<WallRole, { features: WallFeature[] }>;
  roomShape: "rectangular";
}

// ── Output types ───────────────────────────────────────────────────────────────

export type FocalPointType = "bay_window" | "fireplace" | "window_wall" | "plain";

export interface LightSource {
  wall: WallRole;
  // How this wall's light appears in the photograph
  inPhotoAs: "from_left" | "from_right" | "backlit" | "front_lit";
  quality: "ideal" | "dramatic" | "good" | "challenging";
  description: string;
  sourceType: "window" | "glazed_door";
}

export interface SpatialAnalysis {
  focalPoint: {
    wall: WallRole;
    type: FocalPointType;
    label: string;
    description: string;
  } | null;
  lightSources: LightSource[];
  doorRelationship: {
    opensInward: boolean;
    hingeSide: "left" | "right";
    clearanceSide: "left" | "right";
    clearanceCm: number;
    swingZoneCm: number; // door width + swing clearance = total zone to keep clear
    pathNote: string;
  } | null;
  crossLightNote: string | null;
  placementRules: string[];
  promptNarrative: string;
  // Human-readable summaries for UI display
  uiSummary: {
    camera: string;
    light: string;
    focalPoint: string;
    doorFlow: string | null;
  };
}

// ── Internal helpers ───────────────────────────────────────────────────────────

function getFeatures<T extends WallFeature>(wall: { features: WallFeature[] }, type: T["type"]): T[] {
  return wall.features.filter((f) => f.type === type) as T[];
}

function hasBayWindow(wall: { features: WallFeature[] }): boolean {
  return wall.features.some(
    (f) => f.type === "window" && ["bay_angular", "bow", "box_bay"].includes((f as WindowFeature).subtype)
  );
}

function hasWindow(wall: { features: WallFeature[] }): boolean {
  return wall.features.some((f) => f.type === "window");
}

function hasFireplace(wall: { features: WallFeature[] }): boolean {
  return wall.features.some((f) => f.type === "fireplace");
}

function getBayWindow(wall: { features: WallFeature[] }): WindowFeature | null {
  return (
    (wall.features.find(
      (f) => f.type === "window" && ["bay_angular", "bow", "box_bay"].includes((f as WindowFeature).subtype)
    ) as WindowFeature) ?? null
  );
}

function bayLabel(subtype: WindowFeature["subtype"]): string {
  return { bay_angular: "angular bay window", bow: "bow window", box_bay: "box bay window" }[subtype as "bay_angular" | "bow" | "box_bay"] ?? "bay window";
}

function lightQuality(role: WallRole): { inPhotoAs: LightSource["inPhotoAs"]; quality: LightSource["quality"]; description: string } {
  switch (role) {
    case "entrance":
      return {
        inPhotoAs: "front_lit",
        quality: "ideal",
        description: "Light enters from behind the camera — perfect front-lighting for the interior photograph",
      };
    case "far":
      return {
        inPhotoAs: "backlit",
        quality: "dramatic",
        description: "Light enters from the wall directly ahead — creates a dramatic backlit glow, silhouetting furniture",
      };
    case "left":
      return {
        inPhotoAs: "from_left",
        quality: "good",
        description: "Natural light enters from the left — casts gentle directional shadows across the room",
      };
    case "right":
      return {
        inPhotoAs: "from_right",
        quality: "good",
        description: "Natural light enters from the right — casts gentle directional shadows across the room",
      };
  }
}

function isGlazedDoor(f: WallFeature): boolean {
  if (f.type !== "door") return false;
  const d = f as DoorFeature;
  return d.subtype === "sliding_patio" || d.isGlazed === true;
}

function hasGlazedDoor(wall: { features: WallFeature[] }): boolean {
  return wall.features.some(isGlazedDoor);
}

function getGlazedDoor(wall: { features: WallFeature[] }): DoorFeature | null {
  return (wall.features.find(isGlazedDoor) as DoorFeature) ?? null;
}

function glazedDoorLightQuality(role: WallRole, door: DoorFeature): { inPhotoAs: LightSource["inPhotoAs"]; quality: LightSource["quality"]; description: string } {
  const destination = door.leadsTo === "garden" ? "garden" : door.leadsTo === "balcony" ? "balcony" : "outside";
  const typeLabel = door.subtype === "sliding_patio" ? "Sliding patio doors" : "Glazed doors";
  switch (role) {
    case "entrance":
      return {
        inPhotoAs: "front_lit",
        quality: "ideal",
        description: `${typeLabel} on the entrance wall admit natural light from behind the camera`,
      };
    case "far":
      return {
        inPhotoAs: "backlit",
        quality: "dramatic",
        description: `${typeLabel} on the far wall flood the room with ${destination} daylight — dramatic backlit glow with an outdoor view straight ahead`,
      };
    case "left":
      return {
        inPhotoAs: "from_left",
        quality: "good",
        description: `${typeLabel} on the left wall bring in strong ${destination} daylight from the left`,
      };
    case "right":
      return {
        inPhotoAs: "from_right",
        quality: "good",
        description: `${typeLabel} on the right wall bring in strong ${destination} daylight from the right`,
      };
  }
}

// ── Main analysis function ─────────────────────────────────────────────────────

export function analyzeRoomSpatially(rf: RoomFeatures): SpatialAnalysis {
  const walls = rf.walls;
  const allRoles: WallRole[] = ["entrance", "far", "left", "right"];

  // ── Focal point ───────────────────────────────────────────────────────────────
  // Priority: bay window on far > fireplace on far > fireplace on side >
  //           bay on side > window on far > plain far wall

  let focalPoint: SpatialAnalysis["focalPoint"] = null;

  if (hasBayWindow(walls.far)) {
    const bay = getBayWindow(walls.far)!;
    focalPoint = {
      wall: "far",
      type: "bay_window",
      label: `${bayLabel(bay.subtype)} on the far wall`,
      description: `A ${bayLabel(bay.subtype)} fills the far wall directly ahead of the camera. This is the dominant architectural feature — it should be the star of the photograph, beautifully lit by natural daylight streaming through its panes.`,
    };
  } else if (hasFireplace(walls.far)) {
    const fp = getFeatures<FireplaceFeature>(walls.far, "fireplace")[0];
    const typeLabel = { traditional: "traditional fireplace", inset: "inset fireplace", freestanding: "freestanding stove", electric: "electric fireplace" }[fp.subtype];
    focalPoint = {
      wall: "far",
      type: "fireplace",
      label: `${typeLabel} on the far wall`,
      description: `A ${typeLabel} anchors the far wall straight ahead. It becomes the natural focal point — arrange seating symmetrically facing it and keep the hearth clear and beautifully styled.`,
    };
  } else {
    // Check side walls for fireplace or bay
    for (const role of ["left", "right"] as WallRole[]) {
      if (hasFireplace(walls[role]) && !focalPoint) {
        const fp = getFeatures<FireplaceFeature>(walls[role], "fireplace")[0];
        const typeLabel = { traditional: "traditional fireplace", inset: "inset fireplace", freestanding: "freestanding stove", electric: "electric fireplace" }[fp.subtype];
        focalPoint = {
          wall: role,
          type: "fireplace",
          label: `${typeLabel} on the ${role} wall`,
          description: `A ${typeLabel} sits on the ${role} wall — angled seating should face it, creating a cosy conversation zone while the camera captures it as a natural side focal point.`,
        };
      }
    }
    for (const role of ["left", "right"] as WallRole[]) {
      if (hasBayWindow(walls[role]) && !focalPoint) {
        const bay = getBayWindow(walls[role])!;
        focalPoint = {
          wall: role,
          type: "bay_window",
          label: `${bayLabel(bay.subtype)} on the ${role} wall`,
          description: `A ${bayLabel(bay.subtype)} projects from the ${role} wall — it will appear as a beautifully lit alcove to the ${role} side of the photograph, flooding the room with natural light.`,
        };
      }
    }
    if (!focalPoint && hasWindow(walls.far)) {
      focalPoint = {
        wall: "far",
        type: "window_wall",
        label: "windows on the far wall",
        description: "The far wall carries windows that will glow with natural daylight — a bright, airy backdrop that draws the eye across the room.",
      };
    }
  }

  // ── Light sources ─────────────────────────────────────────────────────────────
  // Windows first; glazed/patio doors also count as light sources when present

  const lightSources: LightSource[] = [];
  for (const r of allRoles) {
    if (hasWindow(walls[r])) {
      lightSources.push({ wall: r, ...lightQuality(r), sourceType: "window" });
    } else if (hasGlazedDoor(walls[r])) {
      const gd = getGlazedDoor(walls[r])!;
      lightSources.push({ wall: r, ...glazedDoorLightQuality(r, gd), sourceType: "glazed_door" });
    }
  }

  // ── Door relationship ──────────────────────────────────────────────────────────

  let doorRelationship: SpatialAnalysis["doorRelationship"] = null;
  const doors = getFeatures<DoorFeature>(walls.entrance, "door");
  if (doors.length > 0) {
    const door = doors[0];
    const clearanceCm = door.opensInward ? 90 : 30;
    // The side that needs clearing is the hinge opposite (the swing arc side)
    // If hinged on left: door swings to the right → clear space on right
    const clearanceSide = door.hingeSide === "left" ? "right" : "left";
    const swingZoneCm = door.widthCm + clearanceCm;
    const pathNote = door.opensInward
      ? `Keep ${swingZoneCm}cm clear on the ${clearanceSide} of the entrance (door swing arc — ${door.widthCm}cm door + ${clearanceCm}cm clearance). The remaining entrance wall space CAN have furniture.`
      : `Door opens outward — only ${clearanceCm}cm clearance needed at the threshold itself. The full entrance wall on either side CAN have furniture.`;
    doorRelationship = {
      opensInward: door.opensInward,
      hingeSide: door.hingeSide,
      clearanceSide,
      clearanceCm,
      swingZoneCm,
      pathNote,
    };
  }

  // ── Cross-light note ───────────────────────────────────────────────────────────

  let crossLightNote: string | null = null;
  const lightSourceWalls = lightSources.map(ls => ls.wall);

  if (lightSourceWalls.includes("left") && lightSourceWalls.includes("right")) {
    crossLightNote = "Cross-lighting from both left and right walls — the room will be evenly bathed in daylight with no harsh shadows.";
  } else if (lightSourceWalls.includes("left") && lightSourceWalls.includes("far")) {
    crossLightNote = "Light sources on the far and left walls create a wrap-around light effect — the far wall glows while the left side receives directional light.";
  } else if (lightSourceWalls.includes("right") && lightSourceWalls.includes("far")) {
    crossLightNote = "Light sources on the far and right walls create a wrap-around light effect — the far wall glows while the right side receives directional light.";
  } else if (lightSourceWalls.includes("entrance") && (lightSourceWalls.includes("left") || lightSourceWalls.includes("right"))) {
    const side = lightSourceWalls.includes("left") ? "left" : "right";
    crossLightNote = `Front-lit from the entrance and ${side} walls — excellent photography conditions, the room will be bright and evenly exposed.`;
  } else if (lightSources.length === 1) {
    const sole = lightSources[0];
    const dir = { entrance: "from behind the camera", far: "straight ahead (backlit)", left: "from the left", right: "from the right" }[sole.wall];
    crossLightNote = `Single light source ${dir} — expect strong directional light that adds depth and drama to the photograph.`;
  }

  // ── Placement rules ────────────────────────────────────────────────────────────

  const placementRules: string[] = [];

  // Door clearance — swing arc only, NOT the whole entrance wall
  if (doorRelationship) {
    placementRules.push(doorRelationship.pathNote);
    if (doorRelationship.opensInward) {
      placementRules.push(
        `Entrance wall: the ${doorRelationship.clearanceSide} side needs ${doorRelationship.swingZoneCm}cm kept clear for the door swing. ` +
        `The opposite side of the entrance wall is fair game — a bookcase, chest of drawers, or console table works well there.`
      );
    }
    placementRules.push(`Clear sightline from entrance door to the ${focalPoint?.wall ?? "far"} wall — the path into the room should feel open`);
  }

  // Focal point rules
  if (focalPoint?.type === "fireplace") {
    placementRules.push(`Primary seating group faces the ${focalPoint.wall === "far" ? "far" : focalPoint.wall} wall fireplace`);
    placementRules.push("100cm minimum clearance in front of the hearth");
    const fp = getFeatures<FireplaceFeature>(walls[focalPoint.wall], "fireplace")[0];
    if (fp.subtype === "traditional") {
      placementRules.push("Alcoves either side of the chimney breast suit shelving or built-in storage");
    }
  }
  if (focalPoint?.type === "bay_window") {
    placementRules.push(`Do not block the ${focalPoint.label} with furniture — it is the architectural hero of the room`);
    const bay = getBayWindow(walls[focalPoint.wall])!;
    if (bay.hasWindowSeat) {
      placementRules.push("The window seat in the bay can hold a throw, cushions, or a small side table");
    }
    if (bay.hasRadiatorBelow) {
      placementRules.push("30cm clearance from any furniture to the radiator below the bay window");
    }
  }

  // Window clearance rules for all windows
  for (const role of allRoles) {
    for (const f of walls[role].features) {
      if (f.type === "window") {
        const w = f as WindowFeature;
        const isBay = ["bay_angular", "bow", "box_bay"].includes(w.subtype);
        if (!isBay) {
          placementRules.push(`No tall furniture blocking the window on the ${role} wall`);
          if (w.hasRadiatorBelow) {
            placementRules.push(`30cm clearance from any furniture to the radiator below the ${role} wall window`);
          }
        }
      }
    }
  }

  // Avoid blocking light sources with back of sofa
  const leftLight  = lightSources.find(ls => ls.inPhotoAs === "from_left");
  const rightLight = lightSources.find(ls => ls.inPhotoAs === "from_right");
  if (leftLight) {
    const src = leftLight.sourceType === "glazed_door" ? "glazed doors" : "windows";
    placementRules.push(`Position sofa so its back does not block the left wall ${src} — allow light to wash across the room`);
  }
  if (rightLight) {
    const src = rightLight.sourceType === "glazed_door" ? "glazed doors" : "windows";
    placementRules.push(`Position sofa so its back does not block the right wall ${src} — allow light to wash across the room`);
  }

  // ── Prompt narrative ──────────────────────────────────────────────────────────

  const lightDesc = lightSources.length === 0
    ? "an artificially lit room"
    : lightSources.length === 1
      ? `natural light — ${lightSources[0].description}`
      : `natural light from ${lightSources.map(ls => ls.wall).join(" and ")} walls`;

  const focalDesc = focalPoint ? focalPoint.description : "an open, well-proportioned far wall as the backdrop";
  const doorDesc = doorRelationship
    ? doorRelationship.opensInward
      ? `Entrance door (hinged ${doorRelationship.hingeSide}, opens inward): keep ${doorRelationship.swingZoneCm}cm clear on the ${doorRelationship.clearanceSide} side for the swing arc — this is NOT an avoidance of the whole entrance wall. The ${doorRelationship.clearanceSide === "left" ? "right" : "left"} portion of the entrance wall can hold furniture such as a bookcase, chest of drawers, or console table.`
      : `Entrance door (hinged ${doorRelationship.hingeSide}, opens outward): minimal threshold clearance only — the full entrance wall on both sides CAN have furniture placed against it.`
    : "";

  const crossDesc = crossLightNote ? ` ${crossLightNote}` : "";

  const promptNarrative = [
    `SPATIAL REASONING — HOW THIS ROOM WORKS:`,
    `The camera sits at the entrance wall, looking into the room. ${focalDesc}`,
    lightSources.length > 0 ? `Natural light: ${lightSources.map(ls => ls.description).join(". ")}.${crossDesc}` : "",
    doorDesc,
    placementRules.length > 0 ? `KEY PLACEMENT CONSTRAINTS: ${placementRules.join("; ")}.` : "",
  ].filter(Boolean).join("\n");

  // ── UI summaries ──────────────────────────────────────────────────────────────

  const uiCamera = "Camera at the entrance doorframe, looking straight into the room";

  const uiLight = lightSources.length === 0
    ? "No windows mapped — artificial lighting will be used"
    : lightSources.length === 1
      ? ({
          from_left:  lightSources[0].sourceType === "glazed_door" ? "Natural light from the left (glazed doors)" : "Natural light from the left",
          from_right: lightSources[0].sourceType === "glazed_door" ? "Natural light from the right (glazed doors)" : "Natural light from the right",
          backlit:    lightSources[0].sourceType === "glazed_door" ? "Backlit — glazed doors ahead (outdoor view)" : "Backlit — windows behind the furniture ahead",
          front_lit:  "Front-lit — light comes from behind the camera",
        })[lightSources[0].inPhotoAs]
      : `Light from ${lightSources.map(ls => ({ from_left: "left", from_right: "right", backlit: "ahead (far wall)", front_lit: "behind (entrance)" })[ls.inPhotoAs]).join(" & ")}`;

  const uiFocalPoint = focalPoint
    ? `Focal point: ${focalPoint.label}`
    : "Focal point: the open far wall";

  const uiDoorFlow = doorRelationship
    ? doorRelationship.pathNote
    : null;

  return {
    focalPoint,
    lightSources,
    doorRelationship,
    crossLightNote,
    placementRules,
    promptNarrative,
    uiSummary: {
      camera: uiCamera,
      light: uiLight,
      focalPoint: uiFocalPoint,
      doorFlow: uiDoorFlow,
    },
  };
}
