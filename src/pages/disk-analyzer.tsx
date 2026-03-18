import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { HardDrive, FolderSearch, RefreshCw, Folder, FileText, ChevronRight } from "lucide-react"
import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { open } from "@tauri-apps/plugin-dialog"

interface FolderSize {
  name: string
  path: string
  size_bytes: number
  size_mb: number
  file_count: number
  children: FolderSize[]
}

interface DiskAnalysisResult {
  root_path: string
  total_size_mb: number
  total_files: number
  folders: FolderSize[]
}

function formatSize(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`
  return `${mb.toFixed(1)} MB`
}

function SizeBar({ percent, color }: { percent: number; color: string }) {
  return (
    <div className="h-2 w-full rounded-full bg-muted/30 overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: color }} />
    </div>
  )
}

const COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
  "#14b8a6", "#a855f7", "#22c55e", "#eab308", "#d946ef", "#0ea5e9", "#64748b", "#fb923c", "#2dd4bf", "#818cf8"]

export default function DiskAnalyzerPage() {
  const [isScanning, setIsScanning] = useState(false)
  const [result, setResult] = useState<DiskAnalysisResult | null>(null)
  const [expandedFolder, setExpandedFolder] = useState<string | null>(null)

  async function selectAndScan() {
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: "Select folder to analyze",
      })
      if (!selectedPath) return

      setIsScanning(true)
      setExpandedFolder(null)

      const data = await invoke<DiskAnalysisResult>("analyze_disk_space", { targetDir: selectedPath as string })
      setResult(data)
    } catch (e) {
      console.error(e)
    } finally {
      setIsScanning(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Disk Space Analyzer</h1>
        <p className="text-sm text-muted-foreground mt-1">Visualize what's taking up space on your drives</p>
      </div>

      <Card>
        <CardContent className="flex items-center gap-4 p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
            {isScanning ? <RefreshCw className="h-6 w-6 text-blue-600 animate-spin" /> : <HardDrive className="h-6 w-6 text-blue-600" />}
          </div>
          <div className="flex-1">
            {result ? (
              <>
                <p className="font-medium">{result.root_path}</p>
                <p className="text-sm text-muted-foreground">
                  {formatSize(result.total_size_mb)} across {result.total_files.toLocaleString()} files in {result.folders.length} folders
                </p>
              </>
            ) : (
              <>
                <p className="font-medium">{isScanning ? "Analyzing folder structure..." : "Select a folder to analyze"}</p>
                <p className="text-sm text-muted-foreground">Deep-scan folder sizes with recursive traversal</p>
              </>
            )}
          </div>
          <Button onClick={selectAndScan} disabled={isScanning} className="gap-2">
            <FolderSearch className="h-4 w-4" /> {result ? "Scan Another" : "Select Folder"}
          </Button>
        </CardContent>
      </Card>

      {/* Size Distribution Bar */}
      {result && result.folders.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-medium">Space Distribution</h3>
            <div className="flex h-6 w-full rounded-lg overflow-hidden">
              {result.folders.map((folder, i) => {
                const percent = (folder.size_mb / result.total_size_mb) * 100
                if (percent < 1) return null
                return (
                  <div
                    key={folder.path}
                    className="h-full transition-opacity hover:opacity-80 cursor-pointer"
                    style={{ width: `${percent}%`, backgroundColor: COLORS[i % COLORS.length], minWidth: "2px" }}
                    title={`${folder.name}: ${formatSize(folder.size_mb)}`}
                    onClick={() => setExpandedFolder(expandedFolder === folder.path ? null : folder.path)}
                  />
                )
              })}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {result.folders.slice(0, 8).map((folder, i) => (
                <div key={folder.path} className="flex items-center gap-1.5 text-xs">
                  <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-muted-foreground">{folder.name}</span>
                  <span className="font-medium">{formatSize(folder.size_mb)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Folder List */}
      {result && result.folders.length > 0 && (
        <div className="space-y-1">
          {result.folders.map((folder, i) => {
            const percent = (folder.size_mb / result.total_size_mb) * 100
            const isExpanded = expandedFolder === folder.path
            return (
              <Card key={folder.path} className={isExpanded ? "border-primary/30" : ""}>
                <CardContent className="p-0">
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedFolder(isExpanded ? null : folder.path)}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: COLORS[i % COLORS.length] + "18" }}>
                      <Folder className="h-4 w-4" style={{ color: COLORS[i % COLORS.length] }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{folder.name}</p>
                        <Badge variant="secondary" className="text-[10px]">{folder.file_count.toLocaleString()} files</Badge>
                      </div>
                      <SizeBar percent={percent} color={COLORS[i % COLORS.length]} />
                    </div>
                    <div className="text-right shrink-0 w-24">
                      <p className="text-sm font-semibold">{formatSize(folder.size_mb)}</p>
                      <p className="text-xs text-muted-foreground">{percent.toFixed(1)}%</p>
                    </div>
                    <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                  </div>

                  {/* Expanded Children */}
                  {isExpanded && folder.children.length > 0 && (
                    <div className="border-t bg-muted/10">
                      {folder.children.map((child) => (
                        <div key={child.path} className="flex items-center gap-3 px-4 py-2 pl-14">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <p className="text-xs truncate flex-1 text-muted-foreground">{child.name}</p>
                          <span className="text-xs font-medium shrink-0">{formatSize(child.size_mb)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {result && result.folders.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-sm text-muted-foreground">No folders larger than 1 MB found in this directory.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
