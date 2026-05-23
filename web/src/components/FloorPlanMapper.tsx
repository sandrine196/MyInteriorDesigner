"use client";
import { useState, useCallback } from "react";
import type {
  WallRole, WallData, WallFeature,
  DoorFeature, WindowFeature, FireplaceFeature, RoomFeatures,
} from "@/lib/api";

// ── Internal types ─────────────────────────────────────────────────────────────

type WallSide = "top" | "bottom" | "left" | "right";
type FeatureType = "door" | "window" | "fireplace" | "nothing";
type WindowCount = "one" | "two" | "triple" | "bay";

// ── Wall role mapping ──────────────────────────────────────────────────────────
// Maps image sides to semantic roles based on which side the entrance is on.
// "Left/Right" are always from the perspective of standing IN the doorway looking in.

function getMapping(entrance: WallSide): Record<WallSide, WallRole> {
  switch (entrance) {
    case "bottom": return { bottom: "entrance", top: "far",      left: "left",  right: "right" };
    case "top":    return { top: "entrance",    bottom: "far",    right: "left", left: "right"  };
    case "left":   return { left: "entrance",   right: "far",     bottom: "left", top: "right"  };
    case "right":  return { right: "entrance",  left: "far",      top: "left",  bottom: "right" };
  }
}

function roleLabel(role: WallRole) {
  return { entrance: "Entrance", far: "Far wall", left: "Left wall", right: "Right wall" }[role];
}

function featureEmoji(f: WallFeature) {
  if (f.type === "door") return "🚪";
  if (f.type === "fireplace") return "🔥";
  if (f.type === "nothing") return "—";
  const w = f as WindowFeature;
  if (w.subtype === "bay_angular" || w.subtype === "bow" || w.subtype === "box_bay") return "🏠🪟";
  return "🪟";
}

function featureLabel(f: WallFeature): string {
  if (f.type === "nothing") return "Nothing special";
  if (f.type === "door") {
    const d = f as DoorFeature;
    return `${d.subtype === "single" ? "Single door" : d.subtype === "double" ? "Double doors" : d.subtype === "sliding" ? "Sliding door" : "Bi-fold door"} (${d.widthCm}cm)`;
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

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  floorPlanUrl: string;
  initialFeatures: RoomFeatures | null;
  saving: boolean;
  onSave: (features: RoomFeatures) => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function FloorPlanMapper({ floorPlanUrl, initialFeatures, saving, onSave }: Props) {
  const [entranceSide, setEntranceSide] = useState<WallSide | null>(() => {
    if (!initialFeatures) return null;
    return "bottom"; // default; real side doesn't matter, features are keyed by role
  });
  const [walls, setWalls] = useState<Record<WallRole, WallData>>(
    () => initialFeatures?.walls ?? emptyWalls()
  );

  // Panel state
  const [activeWall, setActiveWall] = useState<WallRole | null>(null);
  const [featureType, setFeatureType] = useState<FeatureType | null>(null);

  // Door form state
  const [doorSubtype, setDoorSubtype] = useState<DoorFeature["subtype"]>("single");
  const [doorWidth, setDoorWidth] = useState("80");
  const [doorOpensInward, setDoorOpensInward] = useState(true);
  const [doorHingeSide, setDoorHingeSide] = useState<"left" | "right">("right");

  // Window form state
  const [windowCount, setWindowCount] = useState<WindowCount | null>(null);
  const [baySubtype, setBaySubtype] = useState<"bay_angular" | "bow" | "box_bay">("bay_angular");
  const [winWidth, setWinWidth] = useState("120");
  const [winHeight, setWinHeight] = useState("120");
  const [winFromFloor, setWinFromFloor] = useState("90");
  const [winRadiator, setWinRadiator] = useState(false);
  const [bayProjection, setBayProjection] = useState("45");
  const [bayWindowSeat, setBayWindowSeat] = useState(false);

  // Fireplace form state
  const [fireplaceSubtype, setFireplaceSubtype] = useState<FireplaceFeature["subtype"]>("traditional");
  const [chimneyWidth, setChimneyWidth] = useState("120");

  const mapping = entranceSide ? getMapping(entranceSide) : null;

  function roleForSide(side: WallSide): WallRole | null {
    return mapping?.[side] ?? null;
  }

  function openWall(role: WallRole) {
    setActiveWall(role);
    setFeatureType(null);
    setWindowCount(null);
  }

  function closePanel() {
    setActiveWall(null);
    setFeatureType(null);
    setWindowCount(null);
  }

  function resetForms() {
    setDoorSubtype("single"); setDoorWidth("80"); setDoorOpensInward(true); setDoorHingeSide("right");
    setWindowCount(null); setBaySubtype("bay_angular"); setWinWidth("120"); setWinHeight("120");
    setWinFromFloor("90"); setWinRadiator(false); setBayProjection("45"); setBayWindowSeat(false);
    setFireplaceSubtype("traditional"); setChimneyWidth("120");
  }

  function buildFeature(): WallFeature | null {
    if (featureType === "nothing") return { type: "nothing" };
    if (featureType === "door") {
      return {
        type: "door", subtype: doorSubtype,
        widthCm: Number(doorWidth) || 80,
        opensInward: doorOpensInward,
        hingeSide: doorHingeSide,
      };
    }
    if (featureType === "window") {
      if (!windowCount) return null;
      const isBay = windowCount === "bay";
      const subtypeMap: Record<WindowCount, WindowFeature["subtype"]> = {
        one: "single", two: "double", triple: "triple", bay: baySubtype,
      };
      const feat: WindowFeature = {
        type: "window",
        subtype: subtypeMap[windowCount],
        widthCm: Number(winWidth) || 120,
        heightCm: Number(winHeight) || 120,
        heightFromFloorCm: Number(winFromFloor) || 90,
        hasRadiatorBelow: winRadiator,
      };
      if (isBay) {
        feat.projectionCm = Number(bayProjection) || 45;
        feat.hasWindowSeat = bayWindowSeat;
      }
      return feat;
    }
    if (featureType === "fireplace") {
      const fp: FireplaceFeature = { type: "fireplace", subtype: fireplaceSubtype };
      if (fireplaceSubtype === "traditional") fp.chimneyBreastWidthCm = Number(chimneyWidth) || 120;
      return fp;
    }
    return null;
  }

  function addFeature() {
    if (!activeWall) return;
    const feature = buildFeature();
    if (!feature) return;
    setWalls((prev) => ({
      ...prev,
      [activeWall]: { features: [...prev[activeWall].features, feature] },
    }));
    resetForms();
    setFeatureType(null);
    setWindowCount(null);
  }

  const removeFeature = useCallback((role: WallRole, idx: number) => {
    setWalls((prev) => ({
      ...prev,
      [role]: { features: prev[role].features.filter((_, i) => i !== idx) },
    }));
  }, []);

  function handleSave() {
    if (!entranceSide) return;
    onSave({ walls, roomShape: "rectangular" });
  }

  // Validation
  const hasDoor = walls.entrance.features.some((f) => f.type === "door");
  const hasWindow = (["entrance", "far", "left", "right"] as WallRole[]).some((r) =>
    walls[r].features.some((f) => f.type === "window")
  );
  const canSave = entranceSide !== null && hasDoor && hasWindow;

  // ── Wall strip renderer ─────────────────────────────────────────────────────

  function WallStrip({ side, pos }: { side: WallSide; pos: "top" | "bottom" | "left" | "right" }) {
    const role = roleForSide(side);
    const isEntrance = role === "entrance";
    const features = role ? walls[role].features : [];
    const needsDoor = role === "entrance" && !features.some(f => f.type === "door") && entranceSide !== null;
    const isActive = role !== null && activeWall === role;

    const posClasses = {
      top:    "absolute top-0 left-0 right-0 h-10 flex-row items-start",
      bottom: "absolute bottom-0 left-0 right-0 h-10 flex-row items-end",
      left:   "absolute top-10 bottom-10 left-0 w-10 flex-col items-start",
      right:  "absolute top-10 bottom-10 right-0 w-10 flex-col items-end",
    }[pos];

    const isHoriz = pos === "top" || pos === "bottom";

    if (!entranceSide) {
      // Phase 1: all strips prompt "set as entrance"
      return (
        <button
          onClick={() => { setEntranceSide(side); resetForms(); setActiveWall(null); }}
          className={`${posClasses} absolute flex justify-center cursor-pointer group z-10`}
        >
          <div className={`
            bg-mid-gold/10 hover:bg-mid-gold/25 border-2 border-dashed border-mid-gold/40
            hover:border-mid-gold transition-all
            ${isHoriz ? "w-full h-full flex items-center justify-center" : "w-full h-full flex items-center justify-center"}
            rounded-sm
          `}>
            <span className={`text-xs text-mid-gold font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap px-1`}>
              {isHoriz ? "Entrance here?" : <span className="[writing-mode:vertical-lr] rotate-180">Entrance?</span>}
            </span>
          </div>
        </button>
      );
    }

    // Phase 2: walls are labelled and clickable
    const bg = isActive
      ? "bg-mid-gold/20 border-mid-gold"
      : needsDoor
      ? "bg-red-50/80 border-red-300 hover:border-red-400"
      : isEntrance
      ? "bg-prussian-blue/10 border-prussian-blue/40 hover:border-prussian-blue/60"
      : "bg-stone-100/80 border-stone-300 hover:border-stone-400";

    return (
      <button
        onClick={() => role && openWall(role)}
        disabled={role === null}
        className={`${posClasses} absolute flex justify-center z-10`}
      >
        <div className={`border-2 ${bg} transition-all rounded-sm w-full h-full flex items-center justify-center gap-1 px-1`}>
          {isHoriz ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-stone-600 whitespace-nowrap">
                {role ? roleLabel(role) : ""}
              </span>
              {features.length > 0 && (
                <span className="text-xs">{features.slice(0, 3).map(featureEmoji).join("")}</span>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-0.5">
              <span className="[writing-mode:vertical-lr] rotate-180 text-[10px] font-semibold text-stone-600 whitespace-nowrap">
                {role ? roleLabel(role) : ""}
              </span>
            </div>
          )}
        </div>
      </button>
    );
  }

  // ── Feature panel ───────────────────────────────────────────────────────────

  function FeaturePanel() {
    if (!activeWall) return null;
    const wall = walls[activeWall];

    return (
      <div className="mt-4 bg-stone-50 border border-stone-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-stone-800 text-sm">
            {roleLabel(activeWall)} — features
          </h3>
          <button onClick={closePanel} className="text-stone-400 hover:text-stone-600 text-xs">
            Close ✕
          </button>
        </div>

        {/* Existing features */}
        {wall.features.length > 0 && (
          <div className="mb-3 space-y-1.5">
            {wall.features.map((f, i) => (
              <div key={i} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-stone-200 text-sm">
                <span>{featureEmoji(f)} {featureLabel(f)}</span>
                <button
                  onClick={() => removeFeature(activeWall, i)}
                  className="text-stone-300 hover:text-red-400 ml-3 text-xs"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add feature */}
        {featureType === null ? (
          <div>
            <p className="text-xs text-stone-500 mb-2">What's on this wall?</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(["window", "door", "fireplace", "nothing"] as FeatureType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => { setFeatureType(t); setWindowCount(null); }}
                  className="text-sm border border-stone-200 rounded-lg px-3 py-2 hover:border-mid-gold hover:bg-mid-gold/5 transition-all text-stone-700 text-left"
                >
                  {t === "window" && "🪟 Window(s)"}
                  {t === "door" && "🚪 Door"}
                  {t === "fireplace" && "🔥 Fireplace"}
                  {t === "nothing" && "— Nothing special"}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <button
              onClick={() => { setFeatureType(null); setWindowCount(null); }}
              className="text-xs text-stone-400 hover:text-stone-600 mb-3 flex items-center gap-1"
            >
              ← Back
            </button>
            {featureType === "door" && <DoorForm />}
            {featureType === "window" && <WindowForm />}
            {featureType === "fireplace" && <FireplaceForm />}
            {featureType === "nothing" && (
              <div>
                <p className="text-sm text-stone-500 mb-3">No special features on this wall.</p>
                <AddButton />
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  function DoorForm() {
    return (
      <div className="space-y-3">
        <FormField label="Door type">
          <RadioGroup
            options={[
              { value: "single", label: "Single door" },
              { value: "double", label: "Double / French doors" },
              { value: "sliding", label: "Sliding door" },
              { value: "bifold", label: "Bi-fold door" },
            ]}
            value={doorSubtype}
            onChange={(v) => setDoorSubtype(v as DoorFeature["subtype"])}
          />
        </FormField>
        <FormField label="Width (cm)">
          <NumberInput value={doorWidth} onChange={setDoorWidth} placeholder="80" />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Opens">
            <Toggle
              options={[{ value: "inward", label: "Inward" }, { value: "outward", label: "Outward" }]}
              value={doorOpensInward ? "inward" : "outward"}
              onChange={(v) => setDoorOpensInward(v === "inward")}
            />
          </FormField>
          <FormField label="Hinge side">
            <Toggle
              options={[{ value: "left", label: "Left" }, { value: "right", label: "Right" }]}
              value={doorHingeSide}
              onChange={(v) => setDoorHingeSide(v as "left" | "right")}
            />
          </FormField>
        </div>
        <p className="text-xs text-stone-400">Door swing area will be kept clear of furniture</p>
        <AddButton />
      </div>
    );
  }

  function WindowForm() {
    return (
      <div className="space-y-3">
        {windowCount === null ? (
          <FormField label="How many windows?">
            <RadioGroup
              options={[
                { value: "one",    label: "One window" },
                { value: "two",    label: "Two windows" },
                { value: "triple", label: "Three or more" },
                { value: "bay",    label: "Bay / Bow window" },
              ]}
              value={windowCount ?? ""}
              onChange={(v) => setWindowCount(v as WindowCount)}
            />
          </FormField>
        ) : windowCount === "bay" ? (
          <BayWindowForm />
        ) : (
          <StandardWindowForm />
        )}
      </div>
    );
  }

  function StandardWindowForm() {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <FormField label="Width (cm)">
            <NumberInput value={winWidth} onChange={setWinWidth} placeholder="120" />
          </FormField>
          <FormField label="Height (cm)">
            <NumberInput value={winHeight} onChange={setWinHeight} placeholder="120" />
          </FormField>
          <FormField label="Height from floor (cm)">
            <NumberInput value={winFromFloor} onChange={setWinFromFloor} placeholder="90" />
          </FormField>
        </div>
        <FormField label="">
          <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
            <input type="checkbox" checked={winRadiator} onChange={(e) => setWinRadiator(e.target.checked)} className="rounded" />
            Radiator below window
          </label>
        </FormField>
        <AddButton />
      </div>
    );
  }

  function BayWindowForm() {
    return (
      <div className="space-y-3">
        <FormField label="Bay window type">
          <div className="grid grid-cols-3 gap-2">
            {([
              { value: "bay_angular", label: "Angular bay", desc: "3 flat panels at angles" },
              { value: "bow",         label: "Bow window",  desc: "Curved, 4–5 panels" },
              { value: "box_bay",     label: "Box bay",     desc: "Square projection" },
            ] as { value: "bay_angular"|"bow"|"box_bay"; label: string; desc: string }[]).map(({ value, label, desc }) => (
              <button
                key={value}
                type="button"
                onClick={() => setBaySubtype(value)}
                className={`border rounded-lg p-2 text-left text-xs transition-all ${
                  baySubtype === value
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
            <NumberInput value={winWidth} onChange={setWinWidth} placeholder="180" />
          </FormField>
          <FormField label="Projection into room (cm)">
            <NumberInput value={bayProjection} onChange={setBayProjection} placeholder="45" />
          </FormField>
          <FormField label="Height (cm)">
            <NumberInput value={winHeight} onChange={setWinHeight} placeholder="130" />
          </FormField>
          <FormField label="Height from floor (cm)">
            <NumberInput value={winFromFloor} onChange={setWinFromFloor} placeholder="90" />
          </FormField>
        </div>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
            <input type="checkbox" checked={bayWindowSeat} onChange={(e) => setBayWindowSeat(e.target.checked)} className="rounded" />
            Has window seat
          </label>
          <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
            <input type="checkbox" checked={winRadiator} onChange={(e) => setWinRadiator(e.target.checked)} className="rounded" />
            Radiator below
          </label>
        </div>
        <AddButton />
      </div>
    );
  }

  function FireplaceForm() {
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
            value={fireplaceSubtype}
            onChange={(v) => setFireplaceSubtype(v as FireplaceFeature["subtype"])}
          />
        </FormField>
        {fireplaceSubtype === "traditional" && (
          <FormField label="Chimney breast width (cm)">
            <NumberInput value={chimneyWidth} onChange={setChimneyWidth} placeholder="120" />
          </FormField>
        )}
        <p className="text-xs text-stone-400">Furniture will be arranged to face this focal point</p>
        <AddButton />
      </div>
    );
  }

  function AddButton() {
    const ready = featureType === "window" ? (windowCount !== null) : featureType !== null;
    return (
      <button
        onClick={addFeature}
        disabled={!ready}
        className="mt-1 bg-prussian-blue text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40 hover:bg-prussian-blue/90 transition-colors"
      >
        Add to wall
      </button>
    );
  }

  // ── Wall summary cards ──────────────────────────────────────────────────────

  const ROLES: WallRole[] = ["entrance", "far", "left", "right"];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Phase 1 instruction */}
      {!entranceSide && (
        <div className="mb-3 rounded-xl bg-mid-gold/10 border border-mid-gold/30 px-4 py-3">
          <p className="text-sm font-medium text-stone-700">
            First, click the wall where your entrance door is
          </p>
          <p className="text-xs text-stone-500 mt-0.5">
            Hover over each edge of the floor plan and click when you see the entrance
          </p>
        </div>
      )}

      {/* Floor plan image with wall overlays */}
      <div className="relative w-full rounded-xl overflow-hidden border border-stone-200" style={{ minHeight: 240 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={floorPlanUrl}
          alt="Floor plan"
          className="w-full object-contain block"
          style={{ padding: "40px" }}
        />
        <WallStrip side="top"    pos="top"    />
        <WallStrip side="bottom" pos="bottom" />
        <WallStrip side="left"   pos="left"   />
        <WallStrip side="right"  pos="right"  />

        {/* Reset entrance button */}
        {entranceSide && (
          <button
            onClick={() => { setEntranceSide(null); setActiveWall(null); setWalls(emptyWalls()); }}
            className="absolute top-2 right-2 z-20 text-[10px] text-stone-400 hover:text-stone-600 bg-white/80 rounded px-1.5 py-0.5 border border-stone-200"
          >
            Reset
          </button>
        )}
      </div>

      {/* Feature panel */}
      {entranceSide && <FeaturePanel />}

      {/* Wall summary */}
      {entranceSide && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {ROLES.map((role) => {
            const features = walls[role].features;
            const isDoorWall = role === "entrance";
            const missingDoor = isDoorWall && !features.some(f => f.type === "door");
            const isActive = activeWall === role;
            return (
              <button
                key={role}
                onClick={() => openWall(role)}
                className={`text-left p-3 rounded-xl border text-sm transition-all ${
                  isActive
                    ? "border-mid-gold bg-mid-gold/10"
                    : missingDoor
                    ? "border-red-200 bg-red-50 hover:border-red-300"
                    : features.length > 0
                    ? "border-green-200 bg-green-50 hover:border-green-300"
                    : "border-stone-200 bg-stone-50 hover:border-stone-300"
                }`}
              >
                <div className="font-medium text-stone-700 text-xs uppercase tracking-wide mb-1">
                  {roleLabel(role)}
                </div>
                {features.length === 0 ? (
                  <span className="text-stone-400 text-xs">{missingDoor ? "⚠ Door required" : "Not marked yet"}</span>
                ) : (
                  <div className="space-y-0.5">
                    {features.map((f, i) => (
                      <div key={i} className="text-xs text-stone-600">
                        {featureEmoji(f)} {featureLabel(f)}
                      </div>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Validation hints + save */}
      {entranceSide && (
        <div className="mt-4 flex flex-col gap-2">
          {!hasDoor && (
            <p className="text-xs text-red-500">⚠ Mark the entrance door on the Entrance wall</p>
          )}
          {!hasWindow && (
            <p className="text-xs text-amber-600">⚠ Mark at least one window on any wall</p>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={!canSave || saving}
              className="bg-prussian-blue text-white rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-40 hover:bg-prussian-blue/90 transition-colors"
            >
              {saving ? "Saving…" : "Save room layout →"}
            </button>
            {!canSave && (
              <p className="text-xs text-stone-400">Mark entrance door + at least one window to continue</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small shared form primitives ───────────────────────────────────────────────

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      {label && <label className="block text-xs font-medium text-stone-500 mb-1">{label}</label>}
      {children}
    </div>
  );
}

function NumberInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
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
          <input
            type="radio"
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className="accent-[#D4A574]"
          />
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
            value === opt.value
              ? "bg-prussian-blue text-white"
              : "bg-white text-stone-600 hover:bg-stone-50"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Bay window type SVG diagrams ───────────────────────────────────────────────

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
