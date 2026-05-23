"use client";
import type { RoomType } from "@/lib/api";

interface RoomTypeDef {
  id: RoomType;
  label: string;
  icon: string;
  description: string;
  typicalSize: string;
}

const AVAILABLE: RoomTypeDef[] = [
  { id: "living_room",       label: "Living Room",             icon: "🛋️",    description: "Lounge, sitting room",          typicalSize: "12–25m²" },
  { id: "dining_room",       label: "Dining Room",             icon: "🍽️",    description: "Formal or casual dining",       typicalSize: "10–20m²" },
  { id: "living_dining",     label: "Living / Dining",         icon: "🛋️🍽️", description: "Open plan living and dining",   typicalSize: "20–40m²" },
  { id: "bedroom_primary",   label: "Primary Bedroom",         icon: "🛏️",    description: "Master bedroom",                typicalSize: "12–20m²" },
  { id: "bedroom_secondary", label: "Guest / Secondary Bedroom", icon: "🛏️", description: "Spare room or guest bedroom",   typicalSize: "8–14m²"  },
  { id: "home_office",       label: "Home Office",             icon: "💼",    description: "Study or workspace",            typicalSize: "8–16m²"  },
];

const COMING_SOON = [
  { id: "kitchen",  label: "Kitchen",  icon: "🍳" },
  { id: "bathroom", label: "Bathroom", icon: "🛁" },
];

interface Props {
  selected: RoomType | null;
  onSelect: (roomType: RoomType) => void;
}

export function RoomTypeSelector({ selected, onSelect }: Props) {
  return (
    <div>
      <h2 className="text-lg font-bold mb-1" style={{ color: "#1B4965" }}>What room are you designing?</h2>
      <p className="text-sm text-stone-500 mb-5">Choose a room type to get personalised design recommendations.</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {AVAILABLE.map((room) => {
          const isSelected = selected === room.id;
          return (
            <button
              key={room.id}
              onClick={() => onSelect(room.id)}
              className={[
                "relative flex flex-col items-center text-center gap-1.5 px-3 py-4 rounded-2xl border-2 transition-all",
                isSelected
                  ? "border-[#1B4965] bg-[#e8f0f5] shadow-sm"
                  : "border-stone-200 hover:border-[#1B4965] hover:shadow-sm hover:-translate-y-0.5",
              ].join(" ")}
            >
              {isSelected && (
                <span className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ background: "#1B4965" }}>
                  ✓
                </span>
              )}
              <span className="text-3xl leading-none">{room.icon}</span>
              <span className="text-sm font-semibold text-stone-800 leading-tight">{room.label}</span>
              <span className="text-xs text-stone-500 leading-tight">{room.description}</span>
              <span className="text-[11px] text-stone-400 bg-stone-100 rounded-full px-2 py-0.5 mt-0.5">{room.typicalSize}</span>
            </button>
          );
        })}
      </div>

      <div className="border-t border-stone-100 pt-4">
        <p className="text-xs text-stone-400 mb-3">Coming soon</p>
        <div className="flex gap-3">
          {COMING_SOON.map((room) => (
            <div
              key={room.id}
              className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-2xl border-2 border-dashed border-stone-200 opacity-50 cursor-not-allowed"
            >
              <span className="text-2xl leading-none">{room.icon}</span>
              <span className="text-xs font-medium text-stone-500">{room.label}</span>
              <span className="text-[10px] bg-stone-100 text-stone-400 rounded-full px-2 py-0.5">Coming soon</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
