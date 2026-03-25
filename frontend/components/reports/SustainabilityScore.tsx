'use client'

import { Leaf, Sun, Droplets, Recycle, Award, TrendingUp } from 'lucide-react'

interface SustainabilityData {
  sustainability_score: number
  solar_analysis: {
    annual_solar_potential: number
    estimated_solar_generation: number
    solar_savings_annual: number
  }
  energy_efficiency: {
    efficiency_ratings: {
      building_energy_rating: number
    }
    water_efficiency: number
    renewable_energy_potential: number
  }
  material_sustainability: {
    carbon_savings: number
    waste_reduction: number
    recycled_content_percentage: number
  }
  certifications: {
    green_star_potential: string
    nabers_potential: string
    leed_potential: string
  }
  recommendations: string[]
}

interface SustainabilityScoreProps {
  data: SustainabilityData
}

export default function SustainabilityScore({ data }: SustainabilityScoreProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50'
    if (score >= 60) return 'text-yellow-600 bg-yellow-50'
    return 'text-red-600 bg-red-50'
  }

  const getScoreGrade = (score: number) => {
    if (score >= 90) return 'A+'
    if (score >= 80) return 'A'
    if (score >= 70) return 'B+'
    if (score >= 60) return 'B'
    if (score >= 50) return 'C'
    return 'D'
  }

  return (
    <div className="space-y-6">
      {/* Overall Score */}
      <div className="bg-card border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <Leaf className="w-5 h-5 text-green-600" />
            Sustainability Score
          </h3>
          <div className={`px-4 py-2 rounded-full font-bold text-2xl ${getScoreColor(data.sustainability_score)}`}>
            {getScoreGrade(data.sustainability_score)}
          </div>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <div className="text-3xl font-bold text-primary mb-2">
              {data.sustainability_score.toFixed(1)}/100
            </div>
            <p className="text-muted-foreground">
              Overall sustainability rating based on energy efficiency, materials, and environmental impact
            </p>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm">Energy Efficiency</span>
              <span className="font-medium">{data.energy_efficiency.efficiency_ratings.building_energy_rating}/10</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Renewable Energy</span>
              <span className="font-medium">{data.energy_efficiency.renewable_energy_potential}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Carbon Savings</span>
              <span className="font-medium">{data.material_sustainability.carbon_savings}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={<Sun className="w-5 h-5" />}
          title="Solar Generation"
          value={`${data.solar_analysis.estimated_solar_generation.toLocaleString()} kWh/year`}
          subtitle={`$${data.solar_analysis.solar_savings_annual.toLocaleString()} annual savings`}
          color="text-yellow-600"
        />
        
        <MetricCard
          icon={<Droplets className="w-5 h-5" />}
          title="Water Efficiency"
          value={`${data.energy_efficiency.water_efficiency}%`}
          subtitle="Reduction vs baseline"
          color="text-blue-600"
        />
        
        <MetricCard
          icon={<Recycle className="w-5 h-5" />}
          title="Recycled Content"
          value={`${data.material_sustainability.recycled_content_percentage}%`}
          subtitle="Of building materials"
          color="text-green-600"
        />
        
        <MetricCard
          icon={<TrendingUp className="w-5 h-5" />}
          title="Waste Reduction"
          value={`${data.material_sustainability.waste_reduction}%`}
          subtitle="Construction waste saved"
          color="text-purple-600"
        />
      </div>

      {/* Certifications */}
      <div className="bg-card border rounded-lg p-6">
        <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Award className="w-5 h-5 text-yellow-600" />
          Certification Potential
        </h4>
        
        <div className="grid md:grid-cols-3 gap-4">
          <CertificationCard
            name="Green Star"
            rating={data.certifications.green_star_potential}
            description="Australian green building rating"
          />
          <CertificationCard
            name="NABERS"
            rating={data.certifications.nabers_potential}
            description="Energy efficiency rating"
          />
          <CertificationCard
            name="LEED"
            rating={data.certifications.leed_potential}
            description="International green building"
          />
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-card border rounded-lg p-6">
        <h4 className="text-lg font-semibold mb-4">Sustainability Recommendations</h4>
        <div className="space-y-3">
          {data.recommendations.slice(0, 6).map((recommendation, index) => (
            <div key={index} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
              <p className="text-sm">{recommendation}</p>
            </div>
          ))}
        </div>
        
        {data.recommendations.length > 6 && (
          <button className="mt-4 text-sm text-primary hover:underline">
            View all {data.recommendations.length} recommendations
          </button>
        )}
      </div>
    </div>
  )
}

function MetricCard({ icon, title, value, subtitle, color }: {
  icon: React.ReactNode
  title: string
  value: string
  subtitle: string
  color: string
}) {
  return (
    <div className="bg-card border rounded-lg p-4">
      <div className={`${color} mb-2`}>{icon}</div>
      <div className="text-sm text-muted-foreground mb-1">{title}</div>
      <div className="text-lg font-semibold mb-1">{value}</div>
      <div className="text-xs text-muted-foreground">{subtitle}</div>
    </div>
  )
}

function CertificationCard({ name, rating, description }: {
  name: string
  rating: string
  description: string
}) {
  return (
    <div className="border rounded-lg p-4 text-center">
      <div className="font-semibold text-lg mb-1">{name}</div>
      <div className="text-sm text-primary font-medium mb-2">{rating}</div>
      <div className="text-xs text-muted-foreground">{description}</div>
    </div>
  )
}