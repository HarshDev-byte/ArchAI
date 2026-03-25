import Link from 'next/link'
import { Plus, FolderOpen, Clock, CheckCircle2 } from 'lucide-react'

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-primary">
            Archai
          </Link>
          <nav className="flex items-center space-x-4">
            <span className="text-sm text-muted-foreground">Welcome back</span>
            <div className="w-8 h-8 bg-primary rounded-full"></div>
          </nav>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Your Projects</h1>
            <p className="text-muted-foreground">
              Manage and create architectural designs with AI
            </p>
          </div>
          <Link
            href="/project/new"
            className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Project
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <StatsCard
            title="Total Projects"
            value="12"
            icon={<FolderOpen className="w-5 h-5" />}
          />
          <StatsCard
            title="In Progress"
            value="3"
            icon={<Clock className="w-5 h-5" />}
          />
          <StatsCard
            title="Completed"
            value="9"
            icon={<CheckCircle2 className="w-5 h-5" />}
          />
        </div>

        {/* Projects Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <ProjectCard
            id="1"
            name="Modern Family Home"
            type="Residential"
            status="completed"
            location="Melbourne, VIC"
            thumbnail="/placeholder-house.jpg"
            updatedAt="2 days ago"
          />
          <ProjectCard
            id="2"
            name="Sustainable Office Complex"
            type="Commercial"
            status="generating"
            location="Sydney, NSW"
            thumbnail="/placeholder-office.jpg"
            updatedAt="1 hour ago"
          />
          <ProjectCard
            id="3"
            name="Coastal Retreat"
            type="Residential"
            status="draft"
            location="Gold Coast, QLD"
            thumbnail="/placeholder-coastal.jpg"
            updatedAt="1 week ago"
          />
          
          {/* New Project Card */}
          <Link
            href="/project/new"
            className="border-2 border-dashed border-border rounded-lg p-8 flex flex-col items-center justify-center hover:border-primary/50 hover:bg-accent/50 transition-colors"
          >
            <Plus className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-2">Create New Project</h3>
            <p className="text-muted-foreground text-center">
              Start designing with AI-powered architectural generation
            </p>
          </Link>
        </div>
      </div>
    </div>
  )
}

function StatsCard({ title, value, icon }: {
  title: string
  value: string
  icon: React.ReactNode
}) {
  return (
    <div className="bg-card border rounded-lg p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        <div className="text-primary">{icon}</div>
      </div>
    </div>
  )
}

function ProjectCard({ id, name, type, status, location, thumbnail, updatedAt }: {
  id: string
  name: string
  type: string
  status: 'draft' | 'generating' | 'completed'
  location: string
  thumbnail: string
  updatedAt: string
}) {
  const statusColors = {
    draft: 'bg-gray-100 text-gray-800',
    generating: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800'
  }

  return (
    <Link href={`/project/${id}`} className="group">
      <div className="bg-card border rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
        <div className="aspect-video bg-muted flex items-center justify-center">
          <FolderOpen className="w-12 h-12 text-muted-foreground" />
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-semibold group-hover:text-primary transition-colors">
              {name}
            </h3>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status]}`}>
              {status}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mb-1">{type}</p>
          <p className="text-sm text-muted-foreground mb-3">{location}</p>
          <p className="text-xs text-muted-foreground">Updated {updatedAt}</p>
        </div>
      </div>
    </Link>
  )
}