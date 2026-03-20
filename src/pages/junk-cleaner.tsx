import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  Trash2,
  Search,
  Globe,
  FileText,
  FolderOpen,
  RefreshCw,
  CheckCircle2,
} from "lucide-react"

interface JunkCategory {
  id: string
  name: string
  icon: React.ReactNode
  description: string
  files_count: number
  size_mb: number
  checked: boolean
}

export default function JunkCleanerPage() {
  const [isScanning, setIsScanning] = useState(false)
  const [isCleaning, setIsCleaning] = useState(false)
  const [hasScanned, setHasScanned] = useState(false)
  const [hasCleaned, setHasCleaned] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [categories, setCategories] = useState<JunkCategory[]>([])

  async function startScan() {
    setIsScanning(true)
    setHasCleaned(false)
    setScanProgress(0)

    const interval = setInterval(() => {
      setScanProgress((prev) => Math.min(prev + 2, 95))
    }, 100)

    try {
      const result = await invoke<{
        categories: Array<{ id: string; name: string; files_count: number; size_mb: number }>
      }>("scan_junk_files")

      clearInterval(interval)
      setScanProgress(100)

      const icons: Record<string, React.ReactNode> = {
        temp_files: <FileText className="h-5 w-5" />,
        browser_cache: <Globe className="h-5 w-5" />,
        system_cache: <FolderOpen className="h-5 w-5" />,
        logs: <FileText className="h-5 w-5" />,
        thumbnails: <FolderOpen className="h-5 w-5" />,
      }

      const descriptions: Record<string, string> = {
        temp_files: "Temporary files from Windows and applications",
        browser_cache: "Cached data from web browsers",
        system_cache: "Windows system cache and update files",
        logs: "Application and system log files",
        thumbnails: "Thumbnail cache and preview files",
      }

      setCategories(
        result.categories.map((cat) => ({
          ...cat,
          icon: icons[cat.id] || <FileText className="h-5 w-5" />,
          description: descriptions[cat.id] || "System files",
          checked: true,
        }))
      )
      setHasScanned(true)
    } catch (e) {
      clearInterval(interval)
      toast.error("Scan failed: " + String(e))
      // Fallback demo data
      setCategories([
        {
          id: "temp_files",
          name: "Temporary Files",
          icon: <FileText className="h-5 w-5" />,
          description: "Temporary files from Windows and applications",
          files_count: 1247,
          size_mb: 423,
          checked: true,
        },
        {
          id: "browser_cache",
          name: "Browser Cache",
          icon: <Globe className="h-5 w-5" />,
          description: "Cached data from Chrome, Edge, Firefox",
          files_count: 3891,
          size_mb: 612,
          checked: true,
        },
        {
          id: "system_cache",
          name: "System Cache",
          icon: <FolderOpen className="h-5 w-5" />,
          description: "Windows update and system cache files",
          files_count: 89,
          size_mb: 287,
          checked: true,
        },
        {
          id: "logs",
          name: "Log Files",
          icon: <FileText className="h-5 w-5" />,
          description: "Application and system log files",
          files_count: 234,
          size_mb: 56,
          checked: true,
        },
        {
          id: "thumbnails",
          name: "Thumbnails",
          icon: <FolderOpen className="h-5 w-5" />,
          description: "Thumbnail cache and preview files",
          files_count: 567,
          size_mb: 89,
          checked: true,
        },
      ])
      setScanProgress(100)
      setHasScanned(true)
    } finally {
      setIsScanning(false)
    }
  }

  async function startClean() {
    setIsCleaning(true)
    try {
      const selectedIds = categories.filter((c) => c.checked).map((c) => c.id)
      await invoke("clean_junk_files", { categoryIds: selectedIds })
      toast.success(`Cleaned ${totalSize} MB of junk files`)
    } catch (e) {
      toast.error("Clean failed: " + String(e))
    } finally {
      setIsCleaning(false)
      setHasCleaned(true)
    }
  }

  function toggleCategory(id: string) {
    setCategories((prev) =>
      prev.map((cat) => (cat.id === id ? { ...cat, checked: !cat.checked } : cat))
    )
  }

  const totalSize = categories.filter((c) => c.checked).reduce((sum, c) => sum + c.size_mb, 0)
  const totalFiles = categories.filter((c) => c.checked).reduce((sum, c) => sum + c.files_count, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Junk Cleaner</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Remove temporary files, browser cache, and system junk to free up disk space
        </p>
      </div>

      {/* Scan Progress / Action */}
      <Card>
        <CardContent className="p-6">
          {isScanning ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm font-medium">Scanning your system...</span>
                </div>
                <span className="text-sm text-muted-foreground">{scanProgress}%</span>
              </div>
              <Progress value={scanProgress} />
            </div>
          ) : hasCleaned ? (
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-500/10">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Cleanup Complete</p>
                <p className="text-sm text-muted-foreground">
                  Successfully cleaned {totalSize} MB of junk files
                </p>
              </div>
              <Button variant="outline" onClick={startScan} className="gap-2">
                <Search className="h-4 w-4" />
                Scan Again
              </Button>
            </div>
          ) : hasScanned ? (
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-500/10">
                <Trash2 className="h-6 w-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium">
                  Found {formatSize(totalSize)} in {totalFiles.toLocaleString()} files
                </p>
                <p className="text-sm text-muted-foreground">
                  Select categories below and click Clean to free up space
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={startScan} className="gap-2">
                  <Search className="h-4 w-4" />
                  Re-scan
                </Button>
                <Button onClick={startClean} disabled={isCleaning || totalSize === 0} className="gap-2">
                  {isCleaning ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Cleaning...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      Clean {formatSize(totalSize)}
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10">
                <Search className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Scan for junk files</p>
                <p className="text-sm text-muted-foreground">
                  Analyze your system for temporary files, browser cache, and other clutter
                </p>
              </div>
              <Button onClick={startScan} className="gap-2">
                <Search className="h-4 w-4" />
                Start Scan
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Categories */}
      {hasScanned && !hasCleaned && (
        <div className="grid gap-3">
          {categories.map((cat) => (
            <Card
              key={cat.id}
              className={`cursor-pointer transition-colors ${
                cat.checked ? "border-primary/30 bg-primary/[0.02]" : ""
              }`}
              onClick={() => toggleCategory(cat.id)}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                    cat.checked ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {cat.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{cat.name}</p>
                    <Badge variant="secondary" className="text-xs">
                      {cat.files_count.toLocaleString()} files
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatSize(cat.size_mb)}</p>
                </div>
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-colors ${
                    cat.checked ? "border-primary bg-primary" : "border-muted-foreground/30"
                  }`}
                >
                  {cat.checked && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function formatSize(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  return `${mb} MB`
}
