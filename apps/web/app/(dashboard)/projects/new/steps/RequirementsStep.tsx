"use client"

import { useNewProjectStore, type BHKType } from "@/store/new-project"
import { cn } from "@/lib/utils"
import { 
  Home, 
  Plus, 
  Minus, 
  Car, 
  Waves, 
  Dumbbell, 
  Users, 
  TreePine,
  ShoppingBag,
  Sun,
  Zap,
  Building
} from "lucide-react"

// ─────────────────────────────────────────────────────────────
// Unit Mix Configuration
// ─────────────────────────────────────────────────────────────

const UNIT_TYPES: Array<{
  type: BHKType
  label: string
  description: string
  icon: React.ComponentType<{ size?: number; className?: string }>
}> = [
  { type: "studio", label: "Studio", description: "350-450 sqft", icon: Home },
  { type: "1bhk", label: "1 BHK", description: "450-650 sqft", icon: Home },
  { type: "2bhk", label: "2 BHK", description: "650-950 sqft", icon: Home },
  { type: "3bhk", label: "3 BHK", description: "950-1,400 sqft", icon: Home },
  { type: "4bhk_plus", label: "4+ BHK", description: "1,400+ sqft", icon: Home },
]

function UnitMixSelector() {
  const { unitMix, toggleUnitType, setUnitCount } = useNewProjectStore()

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Unit Mix</h3>
        <p className="text-sm text-white/60">
          Select the types and quantities of units you want
        </p>
      </div>

      <div className="space-y-3">
        {UNIT_TYPES.map(({ type, label, description, icon: Icon }) => {
          const entry = unitMix.find(u => u.type === type)
          const isEnabled = entry?.enabled || false
          const count = entry?.count || 0

          return (
            <div
              key={type}
              className={cn(
                "flex items-center justify-between p-4 rounded-xl border transition-all duration-200",
                isEnabled
                  ? "border-[#7F77DD] bg-[#7F77DD]/5"
                  : "border-white/10 bg-white/2"
              )}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleUnitType(type)}
                  className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                    isEnabled
                      ? "border-[#7F77DD] bg-[#7F77DD]"
                      : "border-white/30 hover:border-white/50"
                  )}
                >
                  {isEnabled && (
                    <div className="w-2 h-2 bg-white rounded-sm" />
                  )}
                </button>
                
                <Icon 
                  size={20} 
                  className={cn(
                    isEnabled ? "text-[#7F77DD]" : "text-white/40"
                  )} 
                />
                
                <div>
                  <h4 className={cn(
                    "font-medium",
                    isEnabled ? "text-white" : "text-white/60"
                  )}>
                    {label}
                  </h4>
                  <p className="text-xs text-white/40">{description}</p>
                </div>
              </div>

              {isEnabled && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setUnitCount(type, Math.max(0, count - 1))}
                    disabled={count <= 0}
                    className="w-8 h-8 rounded-lg border border-white/20 bg-white/5 flex items-center justify-center hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <Minus size={14} />
                  </button>
                  
                  <span className="w-12 text-center font-semibold text-white">
                    {count}
                  </span>
                  
                  <button
                    onClick={() => setUnitCount(type, count + 1)}
                    className="w-8 h-8 rounded-lg border border-white/20 bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Amenities Selector
// ─────────────────────────────────────────────────────────────

const AMENITIES: Array<{
  id: string
  label: string
  description: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  category: "parking" | "recreation" | "wellness" | "utility" | "outdoor"
}> = [
  { id: "pool", label: "Swimming Pool", description: "Community pool", icon: Waves, category: "recreation" },
  { id: "podium_parking", label: "Podium Parking", description: "Above-ground parking", icon: Car, category: "parking" },
  { id: "basement_parking", label: "Basement Parking", description: "Underground parking", icon: Car, category: "parking" },
  { id: "gym", label: "Gymnasium", description: "Fitness center", icon: Dumbbell, category: "wellness" },
  { id: "clubhouse", label: "Clubhouse", description: "Community center", icon: Users, category: "recreation" },
  { id: "kids_play", label: "Kids Play Area", description: "Children's playground", icon: Users, category: "recreation" },
  { id: "garden", label: "Landscaped Garden", description: "Green spaces", icon: TreePine, category: "outdoor" },
  { id: "retail", label: "Ground Floor Retail", description: "Commercial spaces", icon: ShoppingBag, category: "utility" },
  { id: "rooftop", label: "Rooftop Amenities", description: "Terrace garden/lounge", icon: Building, category: "outdoor" },
  { id: "solar", label: "Solar Panels", description: "Renewable energy", icon: Sun, category: "utility" },
  { id: "ev_charging", label: "EV Charging", description: "Electric vehicle charging", icon: Zap, category: "utility" },
]

function AmenitiesSelector() {
  const { amenities, toggleAmenity } = useNewProjectStore()

  const categories = [
    { id: "parking", label: "Parking" },
    { id: "recreation", label: "Recreation" },
    { id: "wellness", label: "Wellness" },
    { id: "outdoor", label: "Outdoor" },
    { id: "utility", label: "Utilities" },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Amenities</h3>
        <p className="text-sm text-white/60">
          Select the amenities you want to include
        </p>
      </div>

      {categories.map(category => {
        const categoryAmenities = AMENITIES.filter(a => a.category === category.id)
        
        return (
          <div key={category.id} className="space-y-2">
            <h4 className="text-sm font-medium text-white/70 uppercase tracking-wider">
              {category.label}
            </h4>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {categoryAmenities.map(({ id, label, description, icon: Icon }) => {
                const isSelected = amenities.includes(id)
                
                return (
                  <button
                    key={id}
                    onClick={() => toggleAmenity(id)}
                    className={cn(
                      "p-3 rounded-lg border transition-all duration-200 text-left",
                      "hover:border-[#7F77DD]/50 hover:bg-[#7F77DD]/5",
                      isSelected
                        ? "border-[#7F77DD] bg-[#7F77DD]/10"
                        : "border-white/10 bg-white/2"
                    )}
                  >
                    <Icon 
                      size={20} 
                      className={cn(
                        "mb-2",
                        isSelected ? "text-[#7F77DD]" : "text-white/40"
                      )} 
                    />
                    <h4 className={cn(
                      "font-medium text-sm mb-1",
                      isSelected ? "text-white" : "text-white/70"
                    )}>
                      {label}
                    </h4>
                    <p className="text-xs text-white/40">
                      {description}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Special Notes
// ─────────────────────────────────────────────────────────────

function SpecialNotes() {
  const { specialNotes, setSpecialNotes } = useNewProjectStore()

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Special Requirements</h3>
        <p className="text-sm text-white/60">
          Any specific requirements or preferences (optional)
        </p>
      </div>
      
      <textarea
        value={specialNotes}
        onChange={(e) => setSpecialNotes(e.target.value)}
        placeholder="e.g., Vastu compliance, specific room layouts, accessibility features..."
        className="w-full h-24 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#7F77DD] focus:ring-offset-1 focus:ring-offset-[#111318] resize-none"
        maxLength={300}
      />
      
      <div className="flex justify-between items-center text-xs text-white/40">
        <span>Optional - helps AI generate better layouts</span>
        <span>{specialNotes.length}/300</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export function RequirementsStep() {
  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Requirements</h2>
        <p className="text-white/60">
          Define your unit mix, amenities, and special requirements
        </p>
      </div>

      {/* Unit Mix */}
      <UnitMixSelector />

      {/* Amenities */}
      <AmenitiesSelector />

      {/* Special Notes */}
      <SpecialNotes />
    </div>
  )
}