import Link from 'next/link'
import { ArrowRight, Zap, Eye, Calculator, CheckCircle } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="text-2xl font-bold text-primary">Archai</div>
          <nav className="flex space-x-6">
            <Link href="/dashboard" className="hover:text-primary transition-colors">
              Dashboard
            </Link>
            <Link href="/about" className="hover:text-primary transition-colors">
              About
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="py-20 px-4">
          <div className="container mx-auto text-center">
            <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
              AI-Powered Architectural Design
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Generate intelligent building designs with our multi-agent AI system. 
              From site analysis to 3D visualization, create architecture that's both beautiful and compliant.
            </p>
            <div className="flex gap-4 justify-center">
              <Link 
                href="/dashboard"
                className="bg-primary text-primary-foreground px-8 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors flex items-center gap-2"
              >
                Start Designing <ArrowRight className="w-4 h-4" />
              </Link>
              <Link 
                href="/demo"
                className="border border-border px-8 py-3 rounded-lg font-semibold hover:bg-accent transition-colors"
              >
                View Demo
              </Link>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-16 bg-muted/50">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">Intelligent Design Features</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              <FeatureCard
                icon={<Zap className="w-8 h-8 text-primary" />}
                title="AI Generation"
                description="Multi-agent system generates optimized designs based on your requirements"
              />
              <FeatureCard
                icon={<Eye className="w-8 h-8 text-primary" />}
                title="3D Visualization"
                description="Real-time 3D rendering with VR walkthrough capabilities"
              />
              <FeatureCard
                icon={<Calculator className="w-8 h-8 text-primary" />}
                title="Cost Estimation"
                description="Accurate cost analysis and material optimization"
              />
              <FeatureCard
                icon={<CheckCircle className="w-8 h-8 text-primary" />}
                title="Compliance Check"
                description="Automated building code and zoning compliance verification"
              />
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to Design?</h2>
            <p className="text-muted-foreground mb-8">
              Join architects and designers using AI to create better buildings
            </p>
            <Link 
              href="/dashboard"
              className="bg-primary text-primary-foreground px-8 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
            >
              Get Started <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2024 Archai. AI-powered architectural design platform.</p>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description }: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="text-center p-6">
      <div className="flex justify-center mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  )
}