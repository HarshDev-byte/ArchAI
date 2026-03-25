const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    }

    const response = await fetch(url, config)

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  // Projects
  async createProject(projectData: any) {
    return this.request('/api/projects', {
      method: 'POST',
      body: JSON.stringify(projectData),
    })
  }

  async getProjects() {
    return this.request('/api/projects')
  }

  async getProject(id: string) {
    return this.request(`/api/projects/${id}`)
  }

  async updateProject(id: string, updates: any) {
    return this.request(`/api/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  }

  // Generation
  async startGeneration(generationRequest: any) {
    return this.request('/api/generate/start', {
      method: 'POST',
      body: JSON.stringify(generationRequest),
    })
  }

  async getGenerationStatus(projectId: string) {
    return this.request(`/api/generate/status/${projectId}`)
  }

  async getGenerationResults(projectId: string) {
    return this.request(`/api/generate/results/${projectId}`)
  }

  // Agents
  async getAgentsStatus() {
    return this.request('/api/agents/status')
  }

  async getAgentCapabilities() {
    return this.request('/api/agents/capabilities')
  }

  // 3D Models
  async getModelFiles(projectId: string) {
    return this.request(`/api/models/${projectId}/files`)
  }

  async getModelPreview(projectId: string) {
    return this.request(`/api/models/${projectId}/preview`)
  }
}

export const apiClient = new ApiClient()