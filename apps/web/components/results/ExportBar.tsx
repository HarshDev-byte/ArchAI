"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Download, Share, FileText, Box, FileImage, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { apiClient } from "@/lib/api-client"
import { cn } from "@/lib/utils"

interface ExportBarProps {
  projectId: string
  selectedLayoutId?: string
}

export function ExportBar({ projectId, selectedLayoutId }: ExportBarProps) {
  const router = useRouter()
  const [exportingType, setExportingType] = useState<string | null>(null)

  const handleExport = async (type: "pdf" | "gltf" | "dxf") => {
    if (exportingType) return

    setExportingType(type)
    
    try {
      const response = await apiClient.post(`/export/${type}`, {
        project_id: projectId,
        layout_id: selectedLayoutId
      })

      if (response.data.download_url) {
        // Direct download
        window.open(response.data.download_url, '_blank')
      } else {
        // Background job started - could show toast or polling UI
        console.log(`${type.toUpperCase()} export started:`, response.data.message)
        // TODO: Implement job status polling and download when ready
      }
    } catch (error) {
      console.error(`Failed to export ${type}:`, error)
      // TODO: Show error toast
    } finally {
      setExportingType(null)
    }
  }

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      // TODO: Show "Copied!" toast
      console.log("Link copied to clipboard")
    } catch (error) {
      console.error("Failed to copy link:", error)
    }
  }

  return (
    <div className="sticky bottom-0 left-0 right-0 z-40 bg-[#0a0b10] border-t border-white/8 p-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => router.push("/dashboard/projects")}
          className="gap-2"
        >
          <ArrowLeft size={16} />
          Back to projects
        </Button>

        {/* Export Buttons */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("pdf")}
            disabled={!!exportingType}
            className="gap-2"
          >
            {exportingType === "pdf" ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <FileText size={16} />
            )}
            Download PDF
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("gltf")}
            disabled={!!exportingType}
            className="gap-2"
          >
            {exportingType === "gltf" ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Box size={16} />
            )}
            Export 3D GLB
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("dxf")}
            disabled={!!exportingType}
            className="gap-2"
          >
            {exportingType === "dxf" ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <FileImage size={16} />
            )}
            Export DXF
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            className="gap-2"
          >
            <Share size={16} />
            Share link
          </Button>
        </div>
      </div>
    </div>
  )
}