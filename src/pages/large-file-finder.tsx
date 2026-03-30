import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FileSearch, FolderSearch, RefreshCw, Trash2, FolderOpen, ArrowUpDown } from "lucide-react"
import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"
import { open } from "@tauri-apps/plugin-dialog"

interface LargeFileItem {
  name: string
  path: string
  size_mb: number
  size_bytes: number
  extension: string
  category: string
  modified: string
}

function formatSize(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`
  return `${mb.toFixed(1)} MB`
}

const CATEGORY_COLORS: Record<string, string> = {
  "Video": "#ef4444",
  "Disk Image": "#f97316",
  "Archive": "#eab308",
  "Log / Temp": "#84cc16",
  "Installer": "#8b5cf6",
  "System": "#6366f1",
  "Design / RAW": "#ec4899",
  "Audio": "#14b8a6",
  "Document": "#3b82f6",
  "Other": "#64748b",
}

const SIZE_OPTIONS = [
  { label: "50 MB+", value: 50 },
  { label: "100 MB+", value: 100 },
  { label: "250 MB+", value: 250 },
  { label: "500 MB+", value: 500 },
  { label: "1 GB+", value: 1024 },
]

export default function LargeFileFinderPage() {
  const [isScanning, setIsScanning] = useState(false)
  const [files, setFiles] = useState<LargeFileItem[]>([])
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [minSize, setMinSize] = useState(100)
  const [filterCategory, setFilterCategory] = useState("All")
  const [sortBy, setSortBy] = useState<"size" | "name" | "category">("size")
  const [deleting, setDeleting] = useState<string | null>(null)

  async function selectAndScan() {
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: "Select folder to scan for large files",
      })
      if (!selectedPath) return

      setIsScanning(true)
      setSelectedFiles(new Set())

      const data = await invoke<LargeFileItem[]>("scan_large_files", {
        targetDir: selectedPath as string,
        minSizeMb: minSize,
      })
      const safeData = Array.isArray(data) ? data : []
      setFiles(safeData)
      toast.success(`Found ${safeData.length} large files`)
    } catch (e) {
      toast.error(String(e))
    } finally {
      setIsScanning(false)
    }
  }

  async function openInExplorer(path: string) {
    try {
      // Open parent folder
      const parent = path.substring(0, path.lastIndexOf("\\"))
      await invoke("open_in_explorer", { path: parent })
    } catch (e) { toast.error(String(e)) }
  }

  async function deleteSelectedFiles() {
    if (selectedFiles.size === 0) return
    if (!confirm(`Delete ${selectedFiles.size} selected file(s)?\n\nThis cannot be undone.`)) return

    let deleted = 0
    for (const filePath of selectedFiles) {
      try {
        await invoke<string>("delete_file", { filePath })
        deleted++
      } catch (e) { toast.error(String(e)) }
    }
    setFiles(prev => prev.filter(f => !selectedFiles.has(f.path)))
    setSelectedFiles(new Set())
    toast.success(`Deleted ${deleted} files`)
  }

  async function deleteSingle(path: string) {
    if (!confirm(`Delete this file?\n\n${path}\n\nThis cannot be undone.`)) return
    setDeleting(path)
    try {
      const result = await invoke<string>("delete_file", { filePath: path })
      setFiles(prev => prev.filter(f => f.path !== path))
      selectedFiles.delete(path)
      setSelectedFiles(new Set(selectedFiles))
      toast.success(result)
    } catch (e) { toast.error(String(e)) }
    finally { setDeleting(null) }
  }

  function toggleSelect(path: string) {
    const next = new Set(selectedFiles)
    if (next.has(path)) next.delete(path)
    else next.add(path)
    setSelectedFiles(next)
  }

  function toggleSelectAll() {
    if (selectedFiles.size === displayFiles.length) setSelectedFiles(new Set())
    else setSelectedFiles(new Set(displayFiles.map(f => f.path)))
  }

  // Get unique categories
  const categories = ["All", ...new Set(files.map(f => f.category))]

  // Filter and sort
  const displayFiles = files
    .filter(f => filterCategory === "All" || f.category === filterCategory)
    .sort((a, b) => {
      if (sortBy === "size") return b.size_bytes - a.size_bytes
      if (sortBy === "name") return a.name.localeCompare(b.name)
      return a.category.localeCompare(b.category)
    })

  const totalSelectedMb = files.filter(f => selectedFiles.has(f.path)).reduce((sum, f) => sum + f.size_mb, 0)
  const totalFoundMb = files.reduce((sum, f) => sum + f.size_mb, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Large File Finder</h1>
        <p className="text-sm text-muted-foreground mt-1">Find and remove large files to free up disk space</p>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="flex items-center gap-4 p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 dark:bg-orange-500/10">
            {isScanning ? <RefreshCw className="h-6 w-6 text-orange-600 animate-spin" /> : <FileSearch className="h-6 w-6 text-orange-600" />}
          </div>
          <div className="flex-1">
            <p className="font-medium">{isScanning ? "Scanning for large files..." : files.length > 0 ? `Found ${files.length} files (${formatSize(totalFoundMb)} total)` : "Select a folder to scan"}</p>
            <p className="text-sm text-muted-foreground">Finds files larger than the minimum size threshold</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="rounded-md border bg-muted/50 px-3 py-2 text-sm"
              value={minSize}
              onChange={e => setMinSize(Number(e.target.value))}
            >
              {SIZE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <Button onClick={selectAndScan} disabled={isScanning} className="gap-2">
              <FolderSearch className="h-4 w-4" /> {files.length > 0 ? "Scan Again" : "Select Folder"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Category distribution */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categories.map(cat => {
            const count = cat === "All" ? files.length : files.filter(f => f.category === cat).length
            const color = cat === "All" ? "#64748b" : (CATEGORY_COLORS[cat] || "#64748b")
            return (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors border ${filterCategory === cat ? "bg-primary/10 border-primary text-primary" : "bg-muted/50 border-transparent hover:bg-muted"}`}
              >
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                {cat} ({count})
              </button>
            )
          })}
        </div>
      )}

      {/* Bulk actions */}
      {selectedFiles.size > 0 && (
        <Card className="border-red-200 dark:border-red-500/30">
          <CardContent className="flex items-center justify-between p-4">
            <span className="text-sm font-medium">{selectedFiles.size} files selected ({formatSize(totalSelectedMb)})</span>
            <Button variant="destructive" size="sm" onClick={deleteSelectedFiles} className="gap-2">
              <Trash2 className="h-4 w-4" /> Delete Selected
            </Button>
          </CardContent>
        </Card>
      )}

      {/* File list */}
      {displayFiles.length > 0 && (
        <div className="space-y-1">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={selectedFiles.size === displayFiles.length && displayFiles.length > 0}
              onChange={toggleSelectAll}
              className="h-3.5 w-3.5 rounded"
            />
            <span className="flex-1">File</span>
            <button onClick={() => setSortBy(sortBy === "size" ? "name" : sortBy === "name" ? "category" : "size")} className="flex items-center gap-1 hover:text-foreground">
              <ArrowUpDown className="h-3 w-3" /> Sort: {sortBy}
            </button>
          </div>

          {displayFiles.map((file) => {
            const color = CATEGORY_COLORS[file.category] || "#64748b"
            return (
              <Card key={file.path}>
                <CardContent className="flex items-center gap-3 px-4 py-3 p-0">
                  <input
                    type="checkbox"
                    checked={selectedFiles.has(file.path)}
                    onChange={() => toggleSelect(file.path)}
                    className="h-3.5 w-3.5 rounded shrink-0"
                  />
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0" style={{ backgroundColor: color + "18" }}>
                    <FileSearch className="h-4 w-4" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{file.path}</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] shrink-0" style={{ color }}>{file.category}</Badge>
                  <div className="text-right shrink-0 w-24">
                    <p className="text-sm font-semibold">{formatSize(file.size_mb)}</p>
                    <p className="text-xs text-muted-foreground">.{file.extension || "?"}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-blue-600" onClick={() => openInExplorer(file.path)} title="Open in Explorer">
                      <FolderOpen className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600" onClick={() => deleteSingle(file.path)} disabled={deleting === file.path} title="Delete file">
                      {deleting === file.path ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {files.length > 0 && displayFiles.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-sm text-muted-foreground">No files match the selected filter.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
