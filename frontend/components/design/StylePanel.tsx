'use client'

import { useState } from 'react'
import { Slider } from '@/components/ui/slider'

interface StyleMix {
  modern: number
  traditional: number
  minimalist: number
  industrial: number
  sustainable: number
  luxury: number
}

interface StylePanelProps {
  onStyleChange: (styleMix: StyleMix) => void
  initialStyles?: Partial<StyleMix>
}

const styleDescriptions = {
  modern: 'Clean lines, large windows, open spaces',
  traditional: 'Classic proportions, symmetry, timeless appeal',
  minimalist: 'Simple forms, neutral colors, uncluttered spaces',
  industrial: 'Raw materials, exposed structure, urban aesthetic',
  sustainable: 'Eco-friendly materials, energy efficiency, green features',
  luxury: 'Premium materials, sophisticated details, high-end finishes'
}

export default function StylePanel({ onStyleChange, initialStyles = {} }: StylePanelProps) {
  const [styleMix, setStyleMix] = useState<StyleMix>({
    modern: 50,
    traditional: 20,
    minimalist: 15,
    industrial: 10,
    sustainable: 5,
    luxury: 0,
    ...initialStyles
  })

  const updateStyle = (style: keyof StyleMix, value: number) => {
    const newStyleMix = { ...styleMix, [style]: value }
    
    // Normalize to ensure total is 100%
    const total = Object.values(newStyleMix).reduce((sum, val) => sum + val, 0)
    if (total > 0) {
      Object.keys(newStyleMix).forEach(key => {
        newStyleMix[key as keyof StyleMix] = (newStyleMix[key as keyof StyleMix] / total) * 100
      })
    }
    
    setStyleMix(newStyleMix)
    onStyleChange(newStyleMix)
  }

  const presetStyles = [
    { name: 'Contemporary', mix: { modern: 70, minimalist: 20, sustainable: 10, traditional: 0, industrial: 0, luxury: 0 } },
    { name: 'Classic', mix: { traditional: 60, luxury: 25, modern: 15, minimalist: 0, industrial: 0, sustainable: 0 } },
    { name: 'Eco-Modern', mix: { sustainable: 50, modern: 30, minimalist: 20, traditional: 0, industrial: 0, luxury: 0 } },
    { name: 'Urban Loft', mix: { industrial: 50, modern: 30, minimalist: 20, traditional: 0, sustainable: 0, luxury: 0 } }
  ]

  const applyPreset = (preset: typeof presetStyles[0]) => {
    setStyleMix(preset.mix)
    onStyleChange(preset.mix)
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Design Style Preferences</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Adjust the style mix to define your architectural preferences. The AI will blend these styles intelligently.
        </p>
      </div>

      {/* Preset Buttons */}
      <div>
        <h4 className="text-sm font-medium mb-3">Quick Presets</h4>
        <div className="grid grid-cols-2 gap-2">
          {presetStyles.map((preset) => (
            <button
              key={preset.name}
              onClick={() => applyPreset(preset)}
              className="p-3 text-sm border rounded-lg hover:bg-accent transition-colors text-left"
            >
              <div className="font-medium">{preset.name}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {Object.entries(preset.mix)
                  .filter(([_, value]) => value > 0)
                  .map(([style, value]) => `${style} ${value}%`)
                  .join(', ')}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Style Sliders */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium">Custom Mix</h4>
        {Object.entries(styleMix).map(([style, value]) => (
          <div key={style} className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium capitalize">{style}</label>
              <span className="text-sm text-muted-foreground">{Math.round(value)}%</span>
            </div>
            <Slider
              value={[value]}
              onValueChange={(newValue) => updateStyle(style as keyof StyleMix, newValue[0])}
              max={100}
              step={5}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              {styleDescriptions[style as keyof typeof styleDescriptions]}
            </p>
          </div>
        ))}
      </div>

      {/* Style Preview */}
      <div className="border rounded-lg p-4 bg-muted/50">
        <h4 className="text-sm font-medium mb-3">Style DNA Preview</h4>
        <div className="space-y-2">
          {Object.entries(styleMix)
            .filter(([_, value]) => value > 5)
            .sort(([_, a], [__, b]) => b - a)
            .map(([style, value]) => (
              <div key={style} className="flex justify-between text-sm">
                <span className="capitalize">{style}</span>
                <span className="font-medium">{Math.round(value)}%</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}