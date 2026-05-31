"use client";
import { useState, useCallback } from "react";
import type {
  WallRole, WallData, WallFeature,
  DoorFeature, WindowFeature, FireplaceFeature, RoomFeatures,
} from "@/lib/api";

// ── Internal types ─────────────────────────────────────────────────────────────

type WallSide = "top" | "bottom" | "left" | "right";
type FeatureType = "door" | "window" | "fireplace" | "nothing";

// ── Form data interfaces (at module level, outside everything) ─────────────────

interface WindowData {
  count: "one" | "two" | "triple" | "bay" | null;
  widthCm: number | null;
  heightCm: number | null;
  heightFromFloorCm: number | null;
  hasRadiatorBelow: boolean;
  baySubtype: "bay_angular" | "bow" | "box_bay";
  projectionCm: number | null;
  hasWindowSeat: boolean;
}

interface DoorData {
  subtype: "single" | "double" | "sliding" | "bifold" | "sliding_patio";
  widthCm: number | null;
  opensInward: boolean;
  hingeSide: "left" | "right";
  leadsTo: "garden" | "balcony" | "hallway" | "unknown";
  isGlazed: boolean;
}

interface FireplaceData {
  subtype: "traditional" | "inset" | "freestanding" | "electric";
  chimneyBreastWidthCm: number | null;
}

// ── Change handler types ───────────────────────────────────────────────────────

type WindowChange   = (field: keyof WindowData,   value: WindowData[keyof WindowData])     => void;
type DoorChange     = (field: keyof DoorData,     value: DoorData[keyof DoorData])         => void;
type FireplaceChange= (field: keyof FireplaceData, value: FireplaceData[keyof FireplaceData]) => void;

// ── Defaults ───────────────────────────────────────────────────────────────────

const DEFAULT_WINDOW: WindowData = {
  count: null, widthCm: null, heightCm: null, heightFromFloorCm: null,
  hasRadiatorBelow: false, baySubtype: "bay_angular", projectionCm: null, hasWindowSeat: false,
};
const DEFAULT_DOOR: DoorData = {
  subtype: "single", widthCm: null, opensInward: true, hingeSide: "right",
  leadsTo: "hallway", isGlazed: false,
};
const DEFAULT_FIREPLACE: FireplaceData = {
  subtype: "traditional", chimneyBreastWidthCm: null,
};

// ── Wall role helpers ──────────────────────────────────────────────────────────

function getMapping(entrance: WallSide): Record<WallSide, WallRole> {
  switch (entrance) {
    case "bottom": return { bottom: "entrance", top: "far",     left: "left",   right: "right" };
    case "top":    return { top: "entrance",    bottom: "far",  right: "left",  left: "right"  };
    case "left":   return { left: "entrance",   right: "far",   bottom: "left", top: "right"   };
    case "right":  return { right: "entrance",  left: "far",    top: "left",    bottom: "right" };
  }
}

function roleLabel(role: WallRole) {
  return { entrance: "Entrance", far: "Far wall", left: "Left wall", right: "Right wall" }[role];
}

function featureEmoji(f: WallFeature) {
  if (f.type === "door") {
    const d = f as DoorFeature;
    return d.subtype === "sliding_patio" ? "🌿" : "🚪";
  }
  if (f.type === "fireplace") return "🔥";
  if (f.type === "nothing") return "—";
  const w = f as WindowFeature;
  if (["bay_angular", "bow", "box_bay"].includes(w.subtype)) return "🏠🪟";
  return "🪟";
}

function featureLabel(f: WallFeature): string {
  if (f.type === "nothing") return "Nothing special";
  if (f.type === "door") {
    const d = f as DoorFeature;
    const s = {
      single: "Single door", double: "Double doors", sliding: "Sliding door",
      bifold: "Bi-fold door", sliding_patio: "Patio doors",
    }[d.subtype];
    const dest = d.subtype === "sliding_patio" && d.leadsTo ? ` → ${d.leadsTo}` : "";
    return `${s} (${d.widthCm}cm)${dest}`;
  }
  if (f.type === "window") {
    const w = f as WindowFeature;
    const labels: Record<WindowFeature["subtype"], string> = {
      single: "Single window", double: "Two windows", triple: "Three+ windows",
      bay_angular: "Bay window (angular)", bow: "Bow window", box_bay: "Box bay",
    };
    return `${labels[w.subtype]} ${w.widthCm}cm wide`;
  }
  if (f.type === "fireplace") {
    const fp = f as FireplaceFeature;
    return `${fp.subtype.charAt(0).toUpperCase() + fp.subtype.slice(1)} fireplace`;
  }
  return "";
}

function emptyWalls(): Record<WallRole, WallData> {
  return { entrance: { features: [] }, far: { features: [] }, left: { features: [] }, right: { features: [] } };
}

function buildFeature(
  featureType: FeatureType | null,
  window: WindowData,
  door: DoorData,
  fireplace: FireplaceData,
): WallFeature | null {
  if (featureType === "nothing") return { type: "nothing" };
  if (featureType === "door") {
    const feat: DoorFeature = {
      type: "door", subtype: door.subtype,
      widthCm: door.widthCm ?? (door.subtype === "sliding_patio" ? 180 : 80),
      opensInward: door.opensInward,
      hingeSide: door.hingeSide,
    };
    if (door.subtype === "sliding_patio") {
      feat.leadsTo = door.leadsTo;
      feat.isGlazed = true;
    }
    return feat;
  }
  if (featureType === "window") {
    if (!window.count) return null;
    const isBay = window.count === "bay";
    const subtypeMap = { one: "single", two: "double", triple: "triple", bay: window.baySubtype } as const;
    const feat: WindowFeature = {
      type: "window",
      subtype: subtypeMap[window.count],
      widthCm: window.widthCm ?? 120,
      heightCm: window.heightCm ?? 120,
      heightFromFloorCm: window.heightFromFloorCm ?? 90,
      hasRadiatorBelow: window.hasRadiatorBelow,
    };
    if (isBay) {
      feat.projectionCm = window.projectionCm ?? 45;
      feat.hasWindowSeat = window.hasWindowSeat;
    }
    return feat;
  }
  if (featureType === "fireplace") {
    const fp: FireplaceFeature = { type: "fireplace", subtype: fireplace.subtype };
    if (fireplace.subtype === "traditional") fp.chimneyBreastWidthCm = fireplace.chimneyBreastWidthCm ?? 120;
    return fp;
  }
  return null;
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  floorPlanUrl: string;
  initialFeatures: RoomFeatures | null;
  saving: boolean;
  onSave: (features: RoomFeatures) => void;
}

// ── AddButton ──────────────────────────────────────────────────────────────────

function AddButton({ ready, onAdd }: { ready: boolean; onAdd: () => void }) {
  return (
    <button
      onClick={onAdd}
      disabled={!ready}
      className="mt-1 bg-prussian-blue text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40 hover:bg-prussian-blue/90 transition-colors"
    >
      Add to wall
    </button>
  );
}

// ── DoorForm ───────────────────────────────────────────────────────────────────

interface DoorFormProps {
  data: DoorData;
  onChange: DoorChange;
  onAdd: () => void;
}

function DoorForm({ data, onChange, onAdd }: DoorFormProps) {
  const isPatio = data.subtype === "sliding_patio";
  return (
    <div className="space-y-3">
      <FormField label="Door type">
        <RadioGroup
          options={[
            { value: "single",        label: "Single door" },
            { value: "double",        label: "Double / French doors" },
            { value: "sliding_patio", label: "Sliding patio doors (garden / balcony)" },
            { value: "bifold",        label: "Bi-fold doors" },
            { value: "sliding",       label: "Sliding (internal)" },
          ]}
          value={data.subtype}
          onChange={(v) => {
            onChange("subtype", v as DoorData["subtype"]);
            if (v === "sliding_patio") {
              onChange("isGlazed", true);
              onChange("leadsTo", "garden");
            }
          }}
        />
      </FormField>
      <FormField label="Width (cm)">
        <NumberInput
          value={data.widthCm}
          onChange={(v) => onChange("widthCm", v)}
          placeholder={isPatio ? "180" : "80"}
        />
      </FormField>
      {isPatio ? (
        <>
          <FormField label="Leads to">
            <RadioGroup
              options={[
                { value: "garden",  label: "Garden (ground floor)" },
                { value: "balcony", label: "Balcony / terrace (upper floor)" },
                { value: "unknown", label: "Not sure" },
              ]}
              value={data.leadsTo}
              onChange={(v) => onChange("leadsTo", v as DoorData["leadsTo"])}
            />
          </FormField>
          <p className="text-xs text-stone-400">150cm will be kept clear in front of the patio doors</p>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Opens">
              <Toggle
                options={[{ value: "inward", label: "Inward" }, { value: "outward", label: "Outward" }]}
                value={data.opensInward ? "inward" : "outward"}
                onChange={(v) => onChange("opensInward", v === "inward")}
              />
            </FormField>
            <FormField label="Hinge side">
              <Toggle
                options={[{ value: "left", label: "Left" }, { value: "right", label: "Right" }]}
                value={data.hingeSide}
                onChange={(v) => onChange("hingeSide", v as "left" | "right")}
              />
            </FormField>
          </div>
          <p className="text-xs text-stone-400">Door swing area will be kept clear of furniture</p>
        </>
      )}
      <AddButton ready={true} onAdd={onAdd} />
    </div>
  );
}

// ── StandardWindowForm ─────────────────────────────────────────────────────────

interface StandardWindowFormProps {
  data: WindowData;
  onChange: WindowChange;
  onAdd: () => void;
}

function StandardWindowForm({ data, onChange, onAdd }: StandardWindowFormProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <FormField label="Width (cm)">
          <NumberInput value={data.widthCm} onChange={(v) => onChange("widthCm", v)} placeholder="120" />
        </FormField>
        <FormField label="Height (cm)">
          <NumberInput value={data.heightCm} onChange={(v) => onChange("heightCm", v)} placeholder="120" />
        </FormField>
        <FormField label="Height from floor (cm)">
          <NumberInput value={data.heightFromFloorCm} onChange={(v) => onChange("heightFromFloorCm", v)} placeholder="90" />
        </FormField>
      </div>
      <FormField label="">
        <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
          <input
            type="checkbox"
            checked={data.hasRadiatorBelow}
            onChange={(e) => onChange("hasRadiatorBelow", e.target.checked)}
            className="rounded"
          />
          Radiator below window
        </label>
      </FormField>
      <AddButton ready={true} onAdd={onAdd} />
    </div>
  );
}

// ── BayWindowForm ──────────────────────────────────────────────────────────────

interface BayWindowFormProps {
  data: WindowData;
  onChange: WindowChange;
  onAdd: () => void;
}

function BayWindowForm({ data, onChange, onAdd }: BayWindowFormProps) {
  return (
    <div className="space-y-3">
      <FormField label="Bay window type">
        <div className="grid grid-cols-3 gap-2">
          {([
            { value: "bay_angular", label: "Angular bay", desc: "3 flat panels at angles" },
            { value: "bow",         label: "Bow window",  desc: "Curved, 4–5 panels"      },
            { value: "box_bay",     label: "Box bay",     desc: "Square projection"        },
          ] as { value: "bay_angular" | "bow" | "box_bay"; label: string; desc: string }[]).map(({ value, label, desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange("baySubtype", value)}
              className={`border rounded-lg p-2 text-left text-xs transition-all ${
                data.baySubtype === value
                  ? "border-mid-gold bg-mid-gold/10 text-stone-800"
                  : "border-stone-200 hover:border-stone-300 text-stone-600"
              }`}
            >
              <div className="font-medium mb-0.5">{label}</div>
              <div className="text-stone-400">{desc}</div>
              <div className="mt-1.5">
                {value === "bay_angular" && <BayAngularSVG />}
                {value === "bow"         && <BowSVG />}
                {value === "box_bay"     && <BoxBaySVG />}
              </div>
            </button>
          ))}
        </div>
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Total width (cm)">
          <NumberInput value={data.widthCm} onChange={(v) => onChange("widthCm", v)} placeholder="180" />
        </FormField>
        <FormField label="Projection into room (cm)">
          <NumberInput value={data.projectionCm} onChange={(v) => onChange("projectionCm", v)} placeholder="45" />
        </FormField>
        <FormField label="Height (cm)">
          <NumberInput value={data.heightCm} onChange={(v) => onChange("heightCm", v)} placeholder="130" />
        </FormField>
        <FormField label="Height from floor (cm)">
          <NumberInput value={data.heightFromFloorCm} onChange={(v) => onChange("heightFromFloorCm", v)} placeholder="90" />
        </FormField>
      </div>
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
          <input
            type="checkbox"
            checked={data.hasWindowSeat}
            onChange={(e) => onChange("hasWindowSeat", e.target.checked)}
            className="rounded"
          />
          Has window seat
        </label>
        <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
          <input
            type="checkbox"
            checked={data.hasRadiatorBelow}
            onChange={(e) => onChange("hasRadiatorBelow", e.target.checked)}
            className="rounded"
          />
          Radiator below
        </label>
      </div>
      <AddButton ready={true} onAdd={onAdd} />
    </div>
  );
}

// ── WindowForm ─────────────────────────────────────────────────────────────────

interface WindowFormProps {
  data: WindowData;
  onChange: WindowChange;
  onAdd: () => void;
}

function WindowForm({ data, onChange, onAdd }: WindowFormProps) {
  return (
    <div className="space-y-3">
      {/* Count picker — hidden once count is selected */}
      <div style={{ display: data.count === null ? "block" : "none" }}>
        <FormField label="How many windows?">
          <RadioGroup
            options={[
              { value: "one",    label: "One window" },
              { value: "two",    label: "Two windows" },
              { value: "triple", label: "Three or more" },
              { value: "bay",    label: "Bay / Bow window" },
            ]}
            value={data.count ?? ""}
            onChange={(v) => onChange("count", v as WindowData["count"])}
          />
        </FormField>
      </div>

      {/* Standard dimensions — hidden when count is null or bay */}
      <div style={{ display: data.count !== null && data.count !== "bay" ? "block" : "none" }}>
        <StandardWindowForm data={data} onChange={onChange} onAdd={onAdd} />
      </div>

      {/* Bay dimensions — hidden when count is not bay */}
      <div style={{ display: data.count === "bay" ? "block" : "none" }}>
        <BayWindowForm data={data} onChange={onChange} onAdd={onAdd} />
      </div>
    </div>
  );
}

// ── FireplaceForm ──────────────────────────────────────────────────────────────

interface FireplaceFormProps {
  data: FireplaceData;
  onChange: FireplaceChange;
  onAdd: () => void;
}

function FireplaceForm({ data, onChange, onAdd }: FireplaceFormProps) {
  return (
    <div className="space-y-3">
      <FormField label="Fireplace type">
        <RadioGroup
          options={[
            { value: "traditional",  label: "Traditional (with chimney breast)" },
            { value: "inset",        label: "Inset (flush with wall)" },
            { value: "freestanding", label: "Freestanding" },
            { value: "electric",     label: "Electric fireplace" },
          ]}
          value={data.subtype}
          onChange={(v) => onChange("subtype", v as FireplaceData["subtype"])}
        />
      </FormField>
      {/* Chimney width — hidden when not traditional */}
      <div style={{ display: data.subtype === "traditional" ? "block" : "none" }}>
        <FormField label="Chimney breast width (cm)">
          <NumberInput
            value={data.chimneyBreastWidthCm}
            onChange={(v) => onChange("chimneyBreastWidthCm", v)}
            placeholder="120"
          />
        </FormField>
      </div>
      <p className="text-xs text-stone-400">Furniture will be arranged to face this focal point</p>
      <AddButton ready={true} onAdd={onAdd} />
    </div>
  );
}

// ── WallStrip ──────────────────────────────────────────────────────────────────

interface WallStripProps {
  side: WallSide;
  pos: WallSide;
  entranceSide: WallSide | null;
  walls: Record<WallRole, WallData>;
  activeWall: WallRole | null;
  mapping: Record<WallSide, WallRole> | null;
  onSelectEntrance: (side: WallSide) => void;
  onOpenWall: (role: WallRole) => void;
}

function WallStrip({ side, pos, entranceSide, walls, activeWall, mapping, onSelectEntrance, onOpenWall }: WallStripProps) {
  const role = mapping?.[side] ?? null;
  const isEntrance = role === "entrance";
  const features = role ? walls[role].features : [];
  const needsDoor = role === "entrance" && !features.some(f => f.type === "door") && entranceSide !== null;
  const isActive = role !== null && activeWall === role;
  const isHoriz = pos === "top" || pos === "bottom";

  const posClasses = {
    top:    "absolute top-0 left-0 right-0 h-10",
    bottom: "absolute bottom-0 left-0 right-0 h-10",
    left:   "absolute top-10 bottom-10 left-0 w-10",
    right:  "absolute top-10 bottom-10 right-0 w-10",
  }[pos];

  if (!entranceSide) {
    return (
      <button
        onClick={() => onSelectEntrance(side)}
        className={`${posClasses} absolute flex justify-center cursor-pointer group z-10`}
      >
        <div className="bg-mid-gold/10 hover:bg-mid-gold/25 border-2 border-dashed border-mid-gold/40 hover:border-mid-gold transition-all w-full h-full flex items-center justify-center rounded-sm">
          <span className="text-xs text-mid-gold font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap px-1">
            {isHoriz ? "Entrance here?" : <span className="[writing-mode:vertical-lr] rotate-180">Entrance?</span>}
          </span>
        </div>
      </button>
    );
  }

  const bg = isActive
    ? "bg-mid-gold/20 border-mid-gold"
    : needsDoor
    ? "bg-red-50/80 border-red-300 hover:border-red-400"
    : isEntrance
    ? "bg-prussian-blue/10 border-prussian-blue/40 hover:border-prussian-blue/60"
    : "bg-stone-100/80 border-stone-300 hover:border-stone-400";

  return (
    <button
      onClick={() => role && onOpenWall(role)}
      disabled={role === null}
      className={`${posClasses} absolute flex justify-center z-10`}
    >
      <div className={`border-2 ${bg} transition-all rounded-sm w-full h-full flex items-center justify-center gap-1 px-1`}>
        {isHoriz ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-stone-600 whitespace-nowrap">{role ? roleLabel(role) : ""}</span>
            {features.length > 0 && <span className="text-xs">{features.slice(0, 3).map(featureEmoji).join("")}</span>}
          </div>
        ) : (
          <span className="[writing-mode:vertical-lr] rotate-180 text-[10px] font-semibold text-stone-600 whitespace-nowrap">
            {role ? roleLabel(role) : ""}
          </span>
        )}
      </div>
    </button>
  );
}

// ── FeaturePanel ───────────────────────────────────────────────────────────────

interface FeaturePanelProps {
  activeWall: WallRole;
  walls: Record<WallRole, WallData>;
  featureType: FeatureType | null;
  windowData: WindowData;
  doorData: DoorData;
  fireplaceData: FireplaceData;
  onSetFeatureType: (type: FeatureType | null) => void;
  onWindowChange: WindowChange;
  onDoorChange: DoorChange;
  onFireplaceChange: FireplaceChange;
  onClose: () => void;
  onRemoveFeature: (role: WallRole, idx: number) => void;
  onAddFeature: () => void;
}

function FeaturePanel({
  activeWall, walls, featureType,
  windowData, doorData, fireplaceData,
  onSetFeatureType, onWindowChange, onDoorChange, onFireplaceChange,
  onClose, onRemoveFeature, onAddFeature,
}: FeaturePanelProps) {
  const wall = walls[activeWall];
  return (
    <div className="mt-4 bg-stone-50 border border-stone-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-stone-800 text-sm">{roleLabel(activeWall)} — features</h3>
        <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-xs">Close ✕</button>
      </div>

      {wall.features.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {wall.features.map((f, i) => (
            <div key={i} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-stone-200 text-sm">
              <span>{featureEmoji(f)} {featureLabel(f)}</span>
              <button onClick={() => onRemoveFeature(activeWall, i)} className="text-stone-300 hover:text-red-400 ml-3 text-xs">
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Picker — hidden once featureType is selected */}
      <div style={{ display: featureType === null ? "block" : "none" }}>
        <p className="text-xs text-stone-500 mb-2">What&apos;s on this wall?</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {(["window", "door", "fireplace", "nothing"] as FeatureType[]).map((t) => (
            <button
              key={t}
              onClick={() => onSetFeatureType(t)}
              className="text-sm border border-stone-200 rounded-lg px-3 py-2 hover:border-mid-gold hover:bg-mid-gold/5 transition-all text-stone-700 text-left"
            >
              {t === "window"    && "🪟 Window(s)"}
              {t === "door"      && "🚪 Door"}
              {t === "fireplace" && "🔥 Fireplace"}
              {t === "nothing"   && "— Nothing special"}
            </button>
          ))}
        </div>
      </div>

      {/* Forms — hidden when no featureType selected */}
      <div style={{ display: featureType !== null ? "block" : "none" }}>
        <button
          onClick={() => onSetFeatureType(null)}
          className="text-xs text-stone-400 hover:text-stone-600 mb-3 flex items-center gap-1"
        >
          ← Back
        </button>

        {/* Always mounted, shown/hidden by display */}
        <div style={{ display: featureType === "door" ? "block" : "none" }}>
          <DoorForm data={doorData} onChange={onDoorChange} onAdd={onAddFeature} />
        </div>
        <div style={{ display: featureType === "window" ? "block" : "none" }}>
          <WindowForm data={windowData} onChange={onWindowChange} onAdd={onAddFeature} />
        </div>
        <div style={{ display: featureType === "fireplace" ? "block" : "none" }}>
          <FireplaceForm data={fireplaceData} onChange={onFireplaceChange} onAdd={onAddFeature} />
        </div>
        <div style={{ display: featureType === "nothing" ? "block" : "none" }}>
          <p className="text-sm text-stone-500 mb-3">No special features on this wall.</p>
          <AddButton ready={true} onAdd={onAddFeature} />
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

const ROLES: WallRole[] = ["entrance", "far", "left", "right"];
const SIDES: WallSide[] = ["top", "bottom", "left", "right"];

export default function FloorPlanMapper({ floorPlanUrl, initialFeatures, saving, onSave }: Props) {
  const [entranceSide, setEntranceSide] = useState<WallSide | null>(() =>
    initialFeatures ? "bottom" : null
  );
  const [walls, setWalls] = useState<Record<WallRole, WallData>>(
    () => initialFeatures?.walls ?? emptyWalls()
  );
  const [activeWall, setActiveWall] = useState<WallRole | null>(null);
  const [featureType, setFeatureType] = useState<FeatureType | null>(null);
  const [windowData,   setWindowData]   = useState<WindowData>(DEFAULT_WINDOW);
  const [doorData,     setDoorData]     = useState<DoorData>(DEFAULT_DOOR);
  const [fireplaceData, setFireplaceData] = useState<FireplaceData>(DEFAULT_FIREPLACE);

  const mapping = entranceSide ? getMapping(entranceSide) : null;

  // Stable handlers — empty deps, functional setState
  const handleWindowChange = useCallback<WindowChange>((field, value) => {
    setWindowData(prev => ({ ...prev, [field]: value } as WindowData));
  }, []);

  const handleDoorChange = useCallback<DoorChange>((field, value) => {
    setDoorData(prev => ({ ...prev, [field]: value } as DoorData));
  }, []);

  const handleFireplaceChange = useCallback<FireplaceChange>((field, value) => {
    setFireplaceData(prev => ({ ...prev, [field]: value } as FireplaceData));
  }, []);

  const handleSetFeatureType = useCallback((type: FeatureType | null) => {
    setFeatureType(type);
  }, []);

  const handleSelectEntrance = useCallback((side: WallSide) => {
    setEntranceSide(side);
    setActiveWall(null);
    setFeatureType(null);
    setWindowData(DEFAULT_WINDOW);
    setDoorData(DEFAULT_DOOR);
    setFireplaceData(DEFAULT_FIREPLACE);
  }, []);

  const handleOpenWall = useCallback((role: WallRole) => {
    setActiveWall(role);
    setFeatureType(null);
  }, []);

  const handleClosePanel = useCallback(() => {
    setActiveWall(null);
    setFeatureType(null);
  }, []);

  const handleRemoveFeature = useCallback((role: WallRole, idx: number) => {
    setWalls(prev => ({
      ...prev,
      [role]: { features: prev[role].features.filter((_, i) => i !== idx) },
    }));
  }, []);

  const handleAddFeature = useCallback(() => {
    if (!activeWall) return;
    const feature = buildFeature(featureType, windowData, doorData, fireplaceData);
    if (!feature) return;
    setWalls(prev => ({
      ...prev,
      [activeWall]: { features: [...prev[activeWall].features, feature] },
    }));
    setWindowData(DEFAULT_WINDOW);
    setDoorData(DEFAULT_DOOR);
    setFireplaceData(DEFAULT_FIREPLACE);
    setFeatureType(null);
  }, [activeWall, featureType, windowData, doorData, fireplaceData]);

  function handleSave() {
    if (!entranceSide) return;
    onSave({ walls, roomShape: "rectangular" });
  }

  const hasDoor   = walls.entrance.features.some(f => f.type === "door");
  const hasWindow = (ROLES as WallRole[]).some(r => walls[r].features.some(f => f.type === "window"));
  const canSave   = entranceSide !== null && hasDoor && hasWindow;

  return (
    <div>
      {!entranceSide && (
        <div className="mb-3 rounded-xl bg-mid-gold/10 border border-mid-gold/30 px-4 py-3">
          <p className="text-sm font-medium text-stone-700">First, click the wall where your entrance door is</p>
          <p className="text-xs text-stone-500 mt-0.5">Hover over each edge of the floor plan and click when you see the entrance</p>
        </div>
      )}

      <div className="relative w-full rounded-xl overflow-hidden border border-stone-200" style={{ minHeight: 240 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={floorPlanUrl} alt="Floor plan" className="w-full object-contain block" style={{ padding: "40px" }} />
        {SIDES.map(side => (
          <WallStrip
            key={side}
            side={side}
            pos={side}
            entranceSide={entranceSide}
            walls={walls}
            activeWall={activeWall}
            mapping={mapping}
            onSelectEntrance={handleSelectEntrance}
            onOpenWall={handleOpenWall}
          />
        ))}
        {entranceSide && (
          <button
            onClick={() => { setEntranceSide(null); setActiveWall(null); setWalls(emptyWalls()); setFeatureType(null); setWindowData(DEFAULT_WINDOW); setDoorData(DEFAULT_DOOR); setFireplaceData(DEFAULT_FIREPLACE); }}
            className="absolute top-2 right-2 z-20 text-[10px] text-stone-400 hover:text-stone-600 bg-white/80 rounded px-1.5 py-0.5 border border-stone-200"
          >
            Reset
          </button>
        )}
      </div>

      {entranceSide && activeWall && (
        <FeaturePanel
          activeWall={activeWall}
          walls={walls}
          featureType={featureType}
          windowData={windowData}
          doorData={doorData}
          fireplaceData={fireplaceData}
          onSetFeatureType={handleSetFeatureType}
          onWindowChange={handleWindowChange}
          onDoorChange={handleDoorChange}
          onFireplaceChange={handleFireplaceChange}
          onClose={handleClosePanel}
          onRemoveFeature={handleRemoveFeature}
          onAddFeature={handleAddFeature}
        />
      )}

      {entranceSide && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {ROLES.map((role) => {
            const features = walls[role].features;
            const missingDoor = role === "entrance" && !features.some(f => f.type === "door");
            const isActive = activeWall === role;
            return (
              <button
                key={role}
                onClick={() => handleOpenWall(role)}
                className={`text-left p-3 rounded-xl border text-sm transition-all ${
                  isActive       ? "border-mid-gold bg-mid-gold/10"
                  : missingDoor  ? "border-red-200 bg-red-50 hover:border-red-300"
                  : features.length > 0 ? "border-green-200 bg-green-50 hover:border-green-300"
                  : "border-stone-200 bg-stone-50 hover:border-stone-300"
                }`}
              >
                <div className="font-medium text-stone-700 text-xs uppercase tracking-wide mb-1">{roleLabel(role)}</div>
                {features.length === 0 ? (
                  <span className="text-stone-400 text-xs">{missingDoor ? "⚠ Door required" : "Not marked yet"}</span>
                ) : (
                  <div className="space-y-0.5">
                    {features.map((f, i) => (
                      <div key={i} className="text-xs text-stone-600">{featureEmoji(f)} {featureLabel(f)}</div>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {entranceSide && (
        <div className="mt-4 flex flex-col gap-2">
          {!hasDoor   && <p className="text-xs text-red-500">⚠ Mark the entrance door on the Entrance wall</p>}
          {!hasWindow && <p className="text-xs text-amber-600">⚠ Mark at least one window on any wall</p>}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={!canSave || saving}
              className="bg-prussian-blue text-white rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-40 hover:bg-prussian-blue/90 transition-colors"
            >
              {saving ? "Saving…" : "Save room layout →"}
            </button>
            {!canSave && <p className="text-xs text-stone-400">Mark entrance door + at least one window to continue</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared form primitives (always at module level) ────────────────────────────

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      {label && <label className="block text-xs font-medium text-stone-500 mb-1">{label}</label>}
      {children}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  placeholder,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="number"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      placeholder={placeholder}
      className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mid-gold focus:border-transparent"
    />
  );
}

function RadioGroup({ options, value, onChange }: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      {options.map((opt) => (
        <label key={opt.value} className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
          <input type="radio" checked={value === opt.value} onChange={() => onChange(opt.value)} className="accent-[#D4A574]" />
          {opt.label}
        </label>
      ))}
    </div>
  );
}

function Toggle({ options, value, onChange }: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex rounded-lg border border-stone-200 overflow-hidden text-sm">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex-1 px-3 py-1.5 transition-colors ${
            value === opt.value ? "bg-prussian-blue text-white" : "bg-white text-stone-600 hover:bg-stone-50"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Bay window SVG diagrams ────────────────────────────────────────────────────

function BayAngularSVG() {
  return (
    <svg viewBox="0 0 40 20" className="w-full h-6" fill="none" stroke="currentColor" strokeWidth="1.5">
      <polyline points="2,18 10,4 20,2 30,4 38,18" strokeLinejoin="round" />
      <line x1="2" y1="18" x2="38" y2="18" />
    </svg>
  );
}

function BowSVG() {
  return (
    <svg viewBox="0 0 40 20" className="w-full h-6" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2,18 Q20,1 38,18" />
      <line x1="2" y1="18" x2="38" y2="18" />
    </svg>
  );
}

function BoxBaySVG() {
  return (
    <svg viewBox="0 0 40 20" className="w-full h-6" fill="none" stroke="currentColor" strokeWidth="1.5">
      <polyline points="2,18 2,4 38,4 38,18" strokeLinejoin="round" />
      <line x1="2" y1="18" x2="38" y2="18" />
    </svg>
  );
}
