import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Cloud, RefreshCw, Trash2 } from "lucide-react"
import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"

interface CloudCacheEntry {
  service: string
  path: string
  size_bytes: number
  size_display: string
  file_count: number
}

const SERVICE_COLORS: Record<string, string> = {
  OneDrive: "#0078d4",
  Dropbox: "#0061ff",
  "Google Drive": "#34a853",
  iCloud: "#999999",
}
const SERVICE_ICONS: Record<string, string> = {
  OneDrive: "☁️",
  Dropbox: "📦",
  "Google Drive": "🔵",
  iCloud: "🍏",
}

export default function CloudCleanerPage() {
  const [caches, setCaches] = useState<CloudCacheEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)

  async function scan() {
    setIsLoading(true)
    try {
      const data = await invoke<CloudCacheEntry[]>("scan_cloud_caches")
      const safeData = Array.isArray(data) ? data : []
      setCaches(safeData)
      const total = safeData.reduce((s, c) => s + (c.size_bytes ?? 0), 0)
      const display = total >= 1048576 ? `${(total / 1048576).toFixed(1)} MB` : `${(total / 1024).toFixed(1)} KB`
      toast.success(`Found ${safeData.length} cache(s) — ${display} total`)
    } catch (e) { toast.error(String(e)) }
    finally { setIsLoading(false) }
  }

  async function clean(path: string) {
    try {
      const msg = await invoke<string>("clean_cloud_cache", { path })
      toast.success(msg)
      setCaches(prev => prev.filter(c => c.path !== path))
    } catch (e) { toast.error(String(e)) }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cloud Cleaner</h1>
        <p className="text-sm text-muted-foreground mt-1">Clean OneDrive, Dropbox, Google Drive, and iCloud cache files</p>
      </div>

      <Card className="cursor-pointer hover:border-primary/30 transition-colors" onClick={scan}>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10">
            {isLoading ? <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" /> : <Cloud className="h-5 w-5 text-blue-600" />}
          </div>
          <div>
            <p className="text-sm font-medium">Scan Cloud Caches</p>
            <p className="text-xs text-muted-foreground">{caches.length > 0 ? `${caches.length} cache(s) found` : "Click to scan"}</p>
          </div>
        </CardContent>
      </Card>

      {caches.length > 0 && (
        <div className="grid grid-cols-1 gap-2">
          {caches.map(cache => {
            const color = SERVICE_COLORS[cache.service] || "#64748b"
            const icon = SERVICE_ICONS[cache.service] || "☁️"
            return (
              <Card key={cache.path} className="hover:border-primary/20 transition-colors">
                <CardContent className="p-4 flex items-center gap-4">
                  <span className="text-2xl">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{cache.service}</span>
                      <Badge style={{ backgroundColor: color + "20", color, border: `1px solid ${color}40` }} className="text-[10px]">{cache.size_display}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{cache.file_count} files</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">{cache.path}</p>
                  </div>
                  <button onClick={() => clean(cache.path)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 transition-colors">
                    <Trash2 className="h-3 w-3" /> Clean
                  </button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {caches.length === 0 && !isLoading && (
        <Card>
          <CardContent className="p-8 text-center">
            <Cloud className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Click "Scan Cloud Caches" to find cleanable cloud storage files.</p>
            <p className="text-xs text-muted-foreground mt-1">Scans OneDrive, Dropbox, Google Drive, and iCloud cache directories.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
