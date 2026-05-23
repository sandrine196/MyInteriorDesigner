"use client";
import type {
  RoomFeatures, WallRole, WallFeature,
  WindowFeature, DoorFeature, FireplaceFeature,
} from "@/lib/api";

// ── SVG constants ──────────────────────────────────────────────────────────────

const CW = 300;  // canvas width
const CH = 220;  // canvas height
const PAD = 48;  // padding around room (space for labels + bay protrusions)

// ── Helper types ───────────────────────────────────────────────────────────────

interface WallGeometry {
  // Position of each wall edge in SVG space
  farY: number;
  entranceY: number;
  leftX: number;
  rightX: number;
  roomX: number;
  roomY: number;
  roomW: number;
  roomH: number;
  scaleX: number; // px per mm for horizontal walls
  scaleY: number; // px per mm for vertical walls
}

function computeGeometry(roomLengthMm: number, roomWidthMm: number): WallGeometry {
  const maxW = CW - PAD * 2;
  const maxH = CH - PAD * 2;
  const scale = Math.min(maxW / roomLengthMm, maxH / roomWidthMm);
  const rw = roomLengthMm * scale;
  const rh = roomWidthMm * scale;
  const rx = (CW - rw) / 2;
  const ry = (CH - rh) / 2;
  return {
    farY: ry, entranceY: ry + rh,
    leftX: rx, rightX: rx + rw,
    roomX: rx, roomY: ry, roomW: rw, roomH: rh,
    scaleX: scale, scaleY: scale,
  };
}

// ── Bay window path builders ───────────────────────────────────────────────────

function bayPoints(
  g: WallGeometry,
  role: WallRole,
  bayWidthMm: number,
  projectionMm: number,
  subtype: WindowFeature["subtype"],
): string {
  const cx = g.roomX + g.roomW / 2;
  const cy = g.roomY + g.roomH / 2;
  const isHoriz = role === "far" || role === "entrance";
  const halfW = isHoriz
    ? Math.min((bayWidthMm * g.scaleX) / 2, g.roomW * 0.45)
    : Math.min((bayWidthMm * g.scaleY) / 2, g.roomH * 0.45);
  const depth = isHoriz
    ? Math.min(projectionMm * g.scaleY, PAD - 6)
    : Math.min(projectionMm * g.scaleX, PAD - 6);

  if (role === "far") {
    const y0 = g.farY, y1 = g.farY - depth;
    if (subtype === "box_bay") return `${cx - halfW},${y0} ${cx - halfW},${y1} ${cx + halfW},${y1} ${cx + halfW},${y0}`;
    const off = halfW * 0.25;
    return `${cx - halfW},${y0} ${cx - halfW + off},${y1} ${cx + halfW - off},${y1} ${cx + halfW},${y0}`;
  }
  if (role === "entrance") {
    const y0 = g.entranceY, y1 = g.entranceY + depth;
    if (subtype === "box_bay") return `${cx - halfW},${y0} ${cx - halfW},${y1} ${cx + halfW},${y1} ${cx + halfW},${y0}`;
    const off = halfW * 0.25;
    return `${cx - halfW},${y0} ${cx - halfW + off},${y1} ${cx + halfW - off},${y1} ${cx + halfW},${y0}`;
  }
  if (role === "left") {
    const x0 = g.leftX, x1 = g.leftX - depth;
    if (subtype === "box_bay") return `${x0},${cy - halfW} ${x1},${cy - halfW} ${x1},${cy + halfW} ${x0},${cy + halfW}`;
    const off = halfW * 0.25;
    return `${x0},${cy - halfW} ${x1},${cy - halfW + off} ${x1},${cy + halfW - off} ${x0},${cy + halfW}`;
  }
  // right
  const x0 = g.rightX, x1 = g.rightX + depth;
  if (subtype === "box_bay") return `${x0},${cy - halfW} ${x1},${cy - halfW} ${x1},${cy + halfW} ${x0},${cy + halfW}`;
  const off = halfW * 0.25;
  return `${x0},${cy - halfW} ${x1},${cy - halfW + off} ${x1},${cy + halfW - off} ${x0},${cy + halfW}`;
}

function bowPath(g: WallGeometry, role: WallRole, bayWidthMm: number, projectionMm: number): string {
  const cx = g.roomX + g.roomW / 2;
  const cy = g.roomY + g.roomH / 2;
  const halfW = Math.min((bayWidthMm * g.scaleX) / 2, g.roomW * 0.45);
  const depth = Math.min(projectionMm * g.scaleY, PAD - 6);
  if (role === "far") {
    return `M ${cx - halfW},${g.farY} Q ${cx},${g.farY - depth} ${cx + halfW},${g.farY}`;
  }
  if (role === "entrance") {
    return `M ${cx - halfW},${g.entranceY} Q ${cx},${g.entranceY + depth} ${cx + halfW},${g.entranceY}`;
  }
  const halfH = Math.min((bayWidthMm * g.scaleY) / 2, g.roomH * 0.45);
  const depthX = Math.min(projectionMm * g.scaleX, PAD - 6);
  if (role === "left") {
    return `M ${g.leftX},${cy - halfH} Q ${g.leftX - depthX},${cy} ${g.leftX},${cy + halfH}`;
  }
  return `M ${g.rightX},${cy - halfH} Q ${g.rightX + depthX},${cy} ${g.rightX},${cy + halfH}`;
}

// ── Feature icon positions on each wall ────────────────────────────────────────

function wallIconPos(g: WallGeometry, role: WallRole): { x: number; y: number } {
  const cx = g.roomX + g.roomW / 2;
  const cy = g.roomY + g.roomH / 2;
  return {
    far:      { x: cx, y: g.farY },
    entrance: { x: cx, y: g.entranceY },
    left:     { x: g.leftX, y: cy },
    right:    { x: g.rightX, y: cy },
  }[role];
}

// ── SVG Room Diagram ──────────────────────────────────────────────────────────

function RoomDiagram({ features, roomLengthMm, roomWidthMm }: {
  features: RoomFeatures;
  roomLengthMm: number | null;
  roomWidthMm: number | null;
}) {
  const g = computeGeometry(roomLengthMm || 5000, roomWidthMm || 4000);

  const roles: WallRole[] = ["entrance", "far", "left", "right"];

  // Collect bay windows so we can clip the room wall behind them
  const bays: Array<{ role: WallRole; w: WindowFeature }> = [];
  for (const role of roles) {
    for (const f of features.walls[role].features) {
      if (f.type === "window") {
        const w = f as WindowFeature;
        if (["bay_angular", "bow", "box_bay"].includes(w.subtype)) {
          bays.push({ role, w });
        }
      }
    }
  }

  // Label positions (outside room)
  const labelPos: Record<WallRole, { x: number; y: number; anchor: "middle" | "end" | "start" }> = {
    far:      { x: g.roomX + g.roomW / 2, y: g.farY - 6,            anchor: "middle" },
    entrance: { x: g.roomX + g.roomW / 2, y: g.entranceY + 14,      anchor: "middle" },
    left:     { x: g.leftX - 6,           y: g.roomY + g.roomH / 2, anchor: "end"    },
    right:    { x: g.rightX + 6,          y: g.roomY + g.roomH / 2, anchor: "start"  },
  };

  const ROLE_LABELS: Record<WallRole, string> = {
    far: "Far", entrance: "Entrance", left: "Left", right: "Right",
  };

  return (
    <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full border border-stone-200 rounded-xl bg-stone-50" style={{ maxHeight: 220 }}>
      {/* Room fill */}
      <rect x={g.roomX} y={g.roomY} width={g.roomW} height={g.roomH} fill="#F5F4F2" stroke="#9CA3AF" strokeWidth="2" />

      {/* Bay windows */}
      {bays.map(({ role, w }, i) => {
        const isBow = w.subtype === "bow";
        const projMm = (w.projectionCm ?? 40) * 10;
        const widthMm = w.widthCm * 10;
        if (isBow) {
          return (
            <path
              key={i}
              d={bowPath(g, role, widthMm, projMm)}
              fill="none"
              stroke="#93C5FD"
              strokeWidth="3"
            />
          );
        }
        const pts = bayPoints(g, role, widthMm, projMm, w.subtype);
        return (
          <g key={i}>
            <polygon points={pts} fill="#DBEAFE" stroke="#93C5FD" strokeWidth="1.5" />
            {/* Window seat indicator */}
            {w.hasWindowSeat && (
              <text
                x={wallIconPos(g, role).x}
                y={role === "far" ? g.farY - (Math.min((w.projectionCm ?? 40) * 10 * g.scaleY, PAD - 6)) / 2
                   : role === "entrance" ? g.entranceY + (Math.min((w.projectionCm ?? 40) * 10 * g.scaleY, PAD - 6)) / 2
                   : wallIconPos(g, role).y}
                textAnchor="middle" dominantBaseline="middle" fontSize="10"
              >
                🪑
              </text>
            )}
          </g>
        );
      })}

      {/* Feature icons on walls */}
      {roles.map((role) => {
        const wallFeatures = features.walls[role].features;
        const hasWindow = wallFeatures.some(f => f.type === "window" && !["bay_angular","bow","box_bay"].includes((f as WindowFeature).subtype));
        const hasBay = wallFeatures.some(f => f.type === "window" && ["bay_angular","bow","box_bay"].includes((f as WindowFeature).subtype));
        const hasDoor = wallFeatures.some(f => f.type === "door");
        const hasFireplace = wallFeatures.some(f => f.type === "fireplace");
        const pos = wallIconPos(g, role);
        const isHoriz = role === "far" || role === "entrance";
        const emojiY = role === "far" ? pos.y - 2 : role === "entrance" ? pos.y + 2 : pos.y;

        return (
          <g key={role}>
            {/* Window segment on wall */}
            {hasWindow && (
              <line
                x1={isHoriz ? pos.x - 12 : pos.x}
                y1={isHoriz ? pos.y : pos.y - 12}
                x2={isHoriz ? pos.x + 12 : pos.x}
                y2={isHoriz ? pos.y : pos.y + 12}
                stroke="#3B82F6" strokeWidth="4" strokeLinecap="round"
              />
            )}

            {/* Door gap + arc on entrance */}
            {hasDoor && role === "entrance" && (() => {
              const door = wallFeatures.find(f => f.type === "door") as DoorFeature;
              const dw = Math.min(door.widthCm * 10 * g.scaleX / 1, 28);
              const dx = pos.x - dw / 2;
              const dy = g.entranceY;
              const hinge = door.hingeSide === "right" ? dx + dw : dx;
              const tip = door.hingeSide === "right" ? dx : dx + dw;
              return (
                <>
                  {/* wall gap */}
                  <line x1={dx} y1={dy} x2={dx + dw} y2={dy} stroke="#F5F4F2" strokeWidth="3" />
                  {/* door arc */}
                  <path
                    d={`M ${tip},${dy} A ${dw},${dw} 0 0,${door.hingeSide === "right" ? 0 : 1} ${hinge},${dy - dw}`}
                    fill="none" stroke="#6B7280" strokeWidth="1" strokeDasharray="2,2"
                  />
                  {/* door leaf */}
                  <line x1={hinge} y1={dy} x2={tip} y2={dy} stroke="#374151" strokeWidth="2" />
                </>
              );
            })()}

            {/* Door on non-entrance wall (rare but possible) */}
            {hasDoor && role !== "entrance" && (
              <text x={pos.x} y={emojiY} textAnchor="middle" dominantBaseline="middle" fontSize="11">🚪</text>
            )}

            {/* Fireplace notch */}
            {hasFireplace && (() => {
              const isH = isHoriz;
              return (
                <g>
                  <rect
                    x={isH ? pos.x - 10 : (role === "left" ? pos.x - 2 : pos.x)}
                    y={isH ? (role === "far" ? pos.y - 2 : pos.y) : pos.y - 10}
                    width={isH ? 20 : 4}
                    height={isH ? 4 : 20}
                    fill="#FCA5A5"
                  />
                  <text x={pos.x} y={isH ? (role === "far" ? pos.y - 10 : pos.y + 10) : pos.y} textAnchor="middle" dominantBaseline="middle" fontSize="10">🔥</text>
                </g>
              );
            })()}

            {/* Bay window emoji label */}
            {hasBay && (
              <text
                x={pos.x}
                y={role === "far" ? g.farY - 18 : role === "entrance" ? g.entranceY + 22 : pos.y}
                textAnchor="middle" dominantBaseline="middle" fontSize="9"
                fill="#2563EB"
              >
                bay
              </text>
            )}
          </g>
        );
      })}

      {/* Camera/entrance arrow */}
      <text x={g.roomX + g.roomW / 2} y={g.entranceY - 8} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill="#6B7280">▲</text>

      {/* Wall role labels */}
      {roles.map((role) => {
        const lp = labelPos[role];
        const hasAny = features.walls[role].features.some(f => f.type !== "nothing");
        return (
          <text key={role} x={lp.x} y={lp.y} textAnchor={lp.anchor} dominantBaseline="middle"
            fontSize="8" fill={hasAny ? "#1B4965" : "#9CA3AF"} fontWeight={hasAny ? "600" : "400"}>
            {ROLE_LABELS[role]}
          </text>
        );
      })}

      {/* Dimensions */}
      {roomLengthMm && (
        <text x={g.roomX + g.roomW / 2} y={g.roomY + g.roomH / 2} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="#D1D5DB">
          {(roomLengthMm / 1000).toFixed(1)}m × {((roomWidthMm || 4000) / 1000).toFixed(1)}m
        </text>
      )}
    </svg>
  );
}

// ── Feature text descriptions ──────────────────────────────────────────────────

function describeWall(features: WallFeature[]): string {
  if (features.length === 0) return "Not marked";
  return features.map((f) => {
    if (f.type === "nothing") return "Nothing special";
    if (f.type === "door") {
      const d = f as DoorFeature;
      const types = { single: "Single door", double: "Double doors", sliding: "Sliding door", bifold: "Bi-fold door" };
      return `${types[d.subtype]} (${d.widthCm}cm, opens ${d.opensInward ? "inward" : "outward"}, ${d.hingeSide} hinge)`;
    }
    if (f.type === "window") {
      const w = f as WindowFeature;
      const labels: Record<WindowFeature["subtype"], string> = {
        single: "Window", double: "Two windows", triple: "Three+ windows",
        bay_angular: "Bay window (angular)", bow: "Bow window", box_bay: "Box bay",
      };
      const extras = [
        w.projectionCm ? `projects ${w.projectionCm}cm` : null,
        w.hasWindowSeat ? "window seat" : null,
        w.hasRadiatorBelow ? "radiator below" : null,
      ].filter(Boolean).join(", ");
      return `${labels[w.subtype]} — ${w.widthCm}cm wide${extras ? ` (${extras})` : ""}`;
    }
    if (f.type === "fireplace") {
      const fp = f as FireplaceFeature;
      const types = { traditional: "Traditional fireplace", inset: "Inset fireplace", freestanding: "Freestanding fireplace", electric: "Electric fireplace" };
      return `${types[fp.subtype]}${fp.chimneyBreastWidthCm ? ` (${fp.chimneyBreastWidthCm}cm breast)` : ""}`;
    }
    return "";
  }).join(", ");
}

function wallEmoji(features: WallFeature[]): string {
  if (features.some(f => f.type === "door")) return "🚪";
  if (features.some(f => f.type === "window")) {
    const w = features.find(f => f.type === "window") as WindowFeature;
    return ["bay_angular","bow","box_bay"].includes(w.subtype) ? "🏠" : "🪟";
  }
  if (features.some(f => f.type === "fireplace")) return "🔥";
  if (features.some(f => f.type === "nothing")) return "⬜";
  return "⬜";
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  features: RoomFeatures;
  roomLengthMm: number | null;
  roomWidthMm: number | null;
  onEdit: () => void;
  onContinue: () => void;
}

const ROLE_LABELS: Record<WallRole, string> = {
  entrance: "Entrance wall", far: "Far wall", left: "Left wall", right: "Right wall",
};

// ── Main component ─────────────────────────────────────────────────────────────

export default function RoomSummary({ features, roomLengthMm, roomWidthMm, onEdit, onContinue }: Props) {
  const lengthM = roomLengthMm ? (roomLengthMm / 1000).toFixed(1) : null;
  const widthM  = roomWidthMm  ? (roomWidthMm  / 1000).toFixed(1) : null;
  const areaM2  = roomLengthMm && roomWidthMm
    ? ((roomLengthMm / 1000) * (roomWidthMm / 1000)).toFixed(1)
    : null;

  const roles: WallRole[] = ["entrance", "far", "left", "right"];

  return (
    <div className="space-y-4">
      {/* SVG diagram */}
      <RoomDiagram features={features} roomLengthMm={roomLengthMm} roomWidthMm={roomWidthMm} />

      {/* Written summary */}
      <div className="bg-stone-50 rounded-xl border border-stone-200 p-4">
        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Your room</p>

        {(lengthM && widthM) && (
          <div className="flex items-center gap-2 text-sm text-stone-700 mb-3 pb-3 border-b border-stone-100">
            <span>📐</span>
            <span className="font-medium">{lengthM}m × {widthM}m{areaM2 ? ` (${areaM2}m²)` : ""}</span>
          </div>
        )}

        <div className="space-y-2">
          {roles.map((role) => {
            const wallFeatures = features.walls[role].features;
            const marked = wallFeatures.length > 0 && !wallFeatures.every(f => f.type === "nothing");
            return (
              <div key={role} className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <span className="text-base leading-tight mt-0.5 flex-shrink-0">{wallEmoji(wallFeatures)}</span>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-stone-500">{ROLE_LABELS[role]}: </span>
                    <span className={`text-xs ${marked ? "text-stone-700" : "text-stone-400"}`}>
                      {describeWall(wallFeatures)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={onEdit}
                  className="text-xs text-stone-400 hover:text-mid-gold flex-shrink-0 transition-colors"
                >
                  ✏️ Edit
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tip */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
        <strong>Tip:</strong> Not sure about a wall? Leave it unmarked — we&apos;ll use smart defaults!
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={onEdit}
          className="border border-stone-200 text-stone-600 rounded-xl px-4 py-2.5 text-sm font-medium hover:border-stone-400 hover:bg-stone-50 transition-all"
        >
          ← Edit walls
        </button>
        <button
          onClick={onContinue}
          className="text-white rounded-xl px-5 py-2.5 text-sm font-semibold transition-all hover:opacity-90"
          style={{ background: "#1B4965" }}
        >
          Continue to furniture →
        </button>
      </div>
    </div>
  );
}
