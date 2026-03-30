import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Package, RefreshCw, Trash2, CheckSquare } from "lucide-react"
import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"

interface UwpJunkItem {
  app_name: string
  package_name: string
  path: string
  size_mb: number
  junk_type: string
}

function formatSize(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`
  return `${mb.toFixed(1)} MB`
}

const JUNK_TYPE_COLORS: Record<string, string> = {
  "Temp State": "#f59e0b",
  "App Cache": "#3b82f6",
  "Local Cache": "#8b5cf6",
  "Update Cache": "#ef4444",
}

export default function AppJunkPage() {
  const [isScanning, setIsScanning] = useState(false)
  const [items, setItems] = useState<UwpJunkItem[]>([])
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())
  const [isCleaning, setIsCleaning] = useState(false)

  async function scan() {
    setIsScanning(true)
    setSelectedPaths(new Set())
    try {
      const data = await invoke<UwpJunkItem[]>("scan_uwp_junk")
      const safeData = Array.isArray(data) ? data : []
      setItems(safeData)
      const total = safeData.reduce((s, i) => s + (i.size_mb ?? 0), 0)
      toast.success(`Found ${safeData.length} junk entries (${formatSize(total)})`)
    } catch (e) {
      toast.error(String(e))
    } finally {
      setIsScanning(false)
    }
  }

  async function cleanSelected() {
    if (selectedPaths.size === 0) return
    if (!confirm(`Clean ${selectedPaths.size} selected junk locations?`)) return
    setIsCleaning(true)
    try {
      const paths = Array.from(selectedPaths)
      const result = await invoke<string>("clean_uwp_junk", { paths })
      setItems(prev => prev.filter(i => !selectedPaths.has(i.path)))
      setSelectedPaths(new Set())
      toast.success(result)
    } catch (e) {
      toast.error(String(e))
    } finally {
      setIsCleaning(false)
    }
  }

  async function cleanAll() {
    if (items.length === 0) return
    if (!confirm(`Clean ALL ${items.length} junk locations?`)) return
    setIsCleaning(true)
    try {
      const paths = items.map(i => i.path)
      const result = await invoke<string>("clean_uwp_junk", { paths })
      setItems([])
      setSelectedPaths(new Set())
      toast.success(result)
    } catch (e) {
      toast.error(String(e))
    } finally {
      setIsCleaning(false)
    }
  }

  function toggleSelect(path: string) {
    const next = new Set(selectedPaths)
    if (next.has(path)) next.delete(path)
    else next.add(path)
    setSelectedPaths(next)
  }

  function toggleSelectAll() {
    if (selectedPaths.size === items.length) setSelectedPaths(new Set())
    else setSelectedPaths(new Set(items.map(i => i.path)))
  }

  const totalMb = items.reduce((s, i) => s + i.size_mb, 0)
  const selectedMb = items.filter(i => selectedPaths.has(i.path)).reduce((s, i) => s + i.size_mb, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">App-Specific Junk</h1>
        <p className="text-sm text-muted-foreground mt-1">Clean UWP/MS Store app caches and Windows Update leftovers</p>
      </div>

      {/* Scan control */}
      <Card>
        <CardContent className="flex items-center gap-4 p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-50 dark:bg-purple-500/10">
            {isScanning ? <RefreshCw className="h-6 w-6 text-purple-600 animate-spin" /> : <Package className="h-6 w-6 text-purple-600" />}
          </div>
          <div className="flex-1">
            <p className="font-medium">
              {isScanning ? "Scanning UWP packages..." : items.length > 0 ? `Found ${items.length} junk entries (${formatSize(totalMb)})` : "Scan for app-specific junk"}
            </p>
            <p className="text-sm text-muted-foreground">Scans MS Store app caches, temp data, and Windows Update downloads</p>
          </div>
          <Button onClick={scan} disabled={isScanning} className="gap-2">
            <Package className="h-4 w-4" /> {items.length > 0 ? "Rescan" : "Scan Now"}
          </Button>
        </CardContent>
      </Card>

      {/* Bulk actions */}
      {items.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={toggleSelectAll} className="gap-2 text-xs">
              <CheckSquare className="h-3.5 w-3.5" />
              {selectedPaths.size === items.length ? "Deselect All" : "Select All"}
            </Button>
            {selectedPaths.size > 0 && <Badge variant="secondary">{selectedPaths.size} selected ({formatSize(selectedMb)})</Badge>}
          </div>
          <div className="flex gap-2">
            {selectedPaths.size > 0 && (
              <Button variant="destructive" size="sm" onClick={cleanSelected} disabled={isCleaning} className="gap-2">
                <Trash2 className="h-3.5 w-3.5" /> Clean Selected
              </Button>
            )}
            <Button variant="destructive" size="sm" onClick={cleanAll} disabled={isCleaning || items.length === 0} className="gap-2">
              <Trash2 className="h-3.5 w-3.5" /> Clean All ({formatSize(totalMb)})
            </Button>
          </div>
        </div>
      )}

      {/* Junk list */}
      {items.length > 0 && (
        <div className="space-y-1">
          {items.map(item => {
            const color = JUNK_TYPE_COLORS[item.junk_type] || "#64748b"
            return (
              <Card key={item.path} className={selectedPaths.has(item.path) ? "border-primary/30" : ""}>
                <CardContent className="flex items-center gap-3 px-4 py-3 p-0">
                  <input
                    type="checkbox"
                    checked={selectedPaths.has(item.path)}
                    onChange={() => toggleSelect(item.path)}
                    className="h-3.5 w-3.5 rounded shrink-0"
                  />
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0" style={{ backgroundColor: color + "18" }}>
                    <Package className="h-4 w-4" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.app_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.path}</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] shrink-0" style={{ color }}>{item.junk_type}</Badge>
                  <div className="text-right shrink-0 w-20">
                    <p className="text-sm font-semibold">{formatSize(item.size_mb)}</p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {items.length === 0 && !isScanning && (
        <Card>
          <CardContent className="p-8 text-center">
            <Package className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Click "Scan Now" to find UWP app junk and update caches.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
