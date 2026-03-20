/**
 * Utility functions for formatting data in the DesignAI application
 */

/**
 * Format Indian currency in Crores and Lakhs
 */
export function formatInrCrore(amount: number): string {
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(1)} Cr`
  }
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(1)} L`
  }
  return `₹${amount.toLocaleString('en-IN')}`
}

/**
 * Format area in square feet with proper comma separation
 */
export function formatArea(sqft: number): string {
  return `${Math.round(sqft).toLocaleString('en-IN')} sqft`
}

/**
 * Format percentage with one decimal place
 */
export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`
}

/**
 * Convert feet to meters
 */
export function feetToMeters(feet: number): number {
  return feet * 0.3048
}

/**
 * Format setback measurements in both feet and meters
 */
export function formatSetback(feet: number): string {
  const meters = feetToMeters(feet)
  return `${feet}ft (${meters.toFixed(1)}m)`
}

/**
 * Capitalize first letter of each word
 */
export function capitalize(str: string): string {
  return str.split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ')
}

/**
 * Get ROI color based on percentage
 */
export function getRoiColor(roi: number): string {
  if (roi > 20) return "text-green-400"
  if (roi >= 10) return "text-amber-400"
  return "text-red-400"
}

/**
 * Format unit mix summary
 */
export function formatUnitMix(unitMix: Array<{ type: string; count: number }>): string {
  const formatted = unitMix
    .filter(unit => unit.count > 0)
    .map(unit => `${unit.count} × ${unit.type.toUpperCase()}`)
    .join('  ·  ')
  
  const totalUnits = unitMix.reduce((sum, unit) => sum + unit.count, 0)
  return `${formatted}  =  ${totalUnits} units`
}

/**
 * Translate common rejection reasons to user-friendly messages
 */
export function translateRejectionReason(reason: string, plotArea?: number): string {
  const lowerReason = reason.toLowerCase()
  
  if (lowerReason.includes('plot too small')) {
    return plotArea 
      ? `Your plot of ${formatArea(plotArea)} is below the 2,000 sqft minimum for apartment buildings`
      : 'Plot size is below the minimum requirement for this building type'
  }
  
  if (lowerReason.includes('fsi') || lowerReason.includes('far')) {
    return 'The requested building size exceeds the maximum Floor Space Index (FSI) allowed for this location'
  }
  
  if (lowerReason.includes('setback')) {
    return 'The plot dimensions don\'t allow for the required building setbacks from property boundaries'
  }
  
  if (lowerReason.includes('parking')) {
    return 'Insufficient space for the required parking facilities based on the number of units'
  }
  
  // Return original reason if no translation found
  return reason
}