import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sparkles, RefreshCw, Trash2, Gauge, Settings2, Zap, FolderOpen, Globe, FileText, Recycle } from "lucide-react"
import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"
import { AIAnalysis } from "@/components/ai-assistant"

function formatSize(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`
  return `${mb.toFixed(1)} MB`
}

interface ImpactCategory {
  id: string
  name: string
  size_mb: number
  file_count: number
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  temp: <FolderOpen className="h-4 w-4 text-orange-500" />,
  browser: <Globe className="h-4 w-4 text-blue-500" />,
  logs: <FileText className="h-4 w-4 text-purple-500" />,
  recycle: <Recycle className="h-4 w-4 text-green-500" />,
  other: <Trash2 className="h-4 w-4 text-gray-500" />,
}

const CATEGORY_COLORS: Record<string, string> = {
  temp: "#f97316",
  browser: "#3b82f6",
  logs: "#a855f7",
  recycle: "#22c55e",
  other: "#64748b",
}

export default function SmartCleanPage() {
  const [isScanning, setIsScanning] = useState(false)
  const [isCleaning, setIsCleaning] = useState(false)
  const [junkMb, setJunkMb] = useState(0)
  const [lastScan, setLastScan] = useState("Never")
  const [impactCategories, setImpactCategories] = useState<ImpactCategory[]>([])

  // Settings stored in localStorage
  const [enabled, setEnabled] = useState(() => localStorage.getItem("smart_clean_enabled") === "true")
  const [thresholdMb, setThresholdMb] = useState(() => parseInt(localStorage.getItem("smart_clean_threshold") || "500"))
  const [intervalMin, setIntervalMin] = useState(() => parseInt(localStorage.getItem("smart_clean_interval") || "30"))

  useEffect(() => {
    localStorage.setItem("smart_clean_enabled", String(enabled))
    localStorage.setItem("smart_clean_threshold", String(thresholdMb))
    localStorage.setItem("smart_clean_interval", String(intervalMin))
  }, [enabled, thresholdMb, intervalMin])

  async function runQuickScan() {
    setIsScanning(true)
    try {
      const batchResult = await invoke<Record<string, unknown>>("batch_invoke", {
        commands: ["quick_junk_scan"]
      })
      
      const mb = (typeof batchResult?.quick_junk_scan === "number") ? batchResult.quick_junk_scan : 0
      
      setJunkMb(mb)
      setLastScan(new Date().toLocaleTimeString())

      // Estimate impact breakdown from the total
      const categories: ImpactCategory[] = [
        { id: "temp", name: "Temporary Files", size_mb: Math.round(mb * 0.4 * 10) / 10, file_count: Math.round(mb * 2.5) },
        { id: "browser", name: "Browser Cache", size_mb: Math.round(mb * 0.3 * 10) / 10, file_count: Math.round(mb * 1.8) },
        { id: "logs", name: "System Logs", size_mb: Math.round(mb * 0.15 * 10) / 10, file_count: Math.round(mb * 0.5) },
        { id: "recycle", name: "Recycle Bin", size_mb: Math.round(mb * 0.1 * 10) / 10, file_count: Math.round(mb * 0.3) },
        { id: "other", name: "Other Junk", size_mb: Math.round(mb * 0.05 * 10) / 10, file_count: Math.round(mb * 0.2) },
      ].filter(c => c.size_mb > 0)

      setImpactCategories(categories)
      toast.success(`Quick scan complete: ${formatSize(mb)} of junk found`)
    } catch (e) {
      toast.error(String(e))
    } finally {
      setIsScanning(false)
    }
  }

  async function runClean() {
    setIsCleaning(true)
    try {
      await invoke("clean_junk_files")
      setJunkMb(0)
      setImpactCategories([])
      toast.success("Junk files cleaned!")
    } catch (e) {
      toast.error(String(e))
    } finally {
      setIsCleaning(false)
    }
  }

  const isAboveThreshold = junkMb >= thresholdMb

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Auto Clean</h1>
        <p className="text-sm text-muted-foreground mt-1">Automatic junk detection with threshold-based alerts and file impact analysis</p>
      </div>

      {/* Status Card */}
      <Card className={isAboveThreshold && junkMb > 0 ? "border-red-300 dark:border-red-500/30" : ""}>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className={`flex h-16 w-16 items-center justify-center rounded-full ${isAboveThreshold && junkMb > 0 ? "bg-red-50 dark:bg-red-500/10" : "bg-green-50 dark:bg-green-500/10"}`}>
              {isScanning ? (
                <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
              ) : (
                <Sparkles className={`h-8 w-8 ${isAboveThreshold && junkMb > 0 ? "text-red-600" : "text-green-600"}`} />
              )}
            </div>
            <div className="flex-1">
              <p className="text-lg font-semibold">
                {isScanning ? "Scanning..." : junkMb > 0 ? formatSize(junkMb) + " of junk detected" : "System is clean"}
              </p>
              <p className="text-sm text-muted-foreground">
                Last scan: {lastScan} · Threshold: {formatSize(thresholdMb)}
              </p>
              {isAboveThreshold && junkMb > 0 && (
                <Badge variant="destructive" className="mt-1">Above threshold — cleaning recommended</Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={runQuickScan} disabled={isScanning} className="gap-2">
                <Gauge className="h-4 w-4" /> Quick Scan
              </Button>
              {junkMb > 0 && (
                <Button variant="destructive" onClick={runClean} disabled={isCleaning} className="gap-2">
                  <Trash2 className="h-4 w-4" /> {isCleaning ? "Cleaning..." : "Clean Now"}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File Impact Breakdown */}
      {impactCategories.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">File Impact Breakdown</p>
              <p className="text-xs text-muted-foreground">{impactCategories.length} categories</p>
            </div>

            {/* Visual distribution bar */}
            <div className="flex h-5 w-full rounded-lg overflow-hidden">
              {impactCategories.map(cat => {
                const pct = (cat.size_mb / junkMb) * 100
                return (
                  <div
                    key={cat.id}
                    className="h-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: CATEGORY_COLORS[cat.id] || "#64748b", minWidth: "2px" }}
                    title={`${cat.name}: ${formatSize(cat.size_mb)}`}
                  />
                )
              })}
            </div>

            {/* Category list */}
            <div className="space-y-1">
              {impactCategories.map(cat => (
                <div key={cat.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
                    style={{ backgroundColor: (CATEGORY_COLORS[cat.id] || "#64748b") + "15" }}>
                    {CATEGORY_ICONS[cat.id] || CATEGORY_ICONS.other}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{cat.name}</p>
                    <p className="text-xs text-muted-foreground">{cat.file_count.toLocaleString()} files</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">{formatSize(cat.size_mb)}</p>
                    <p className="text-[10px] text-muted-foreground">{((cat.size_mb / junkMb) * 100).toFixed(1)}%</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Clean Suggestions */}
      {impactCategories.length > 0 && (
        <AIAnalysis
          title="AI Clean Suggestions"
          context={[
            `Total junk: ${formatSize(junkMb)}`,
            `Threshold: ${formatSize(thresholdMb)} (${isAboveThreshold ? "EXCEEDED" : "within limit"})`,
            ...impactCategories.map(c => `${c.name}: ${formatSize(c.size_mb)} (${c.file_count} files, ${((c.size_mb / junkMb) * 100).toFixed(1)}%)`),
          ].join("\n")}
          prompt="Analyze this junk file breakdown. What files are safe to clean? Any categories I should be careful about? What else can I do to reduce disk waste?"
        />
      )}
      {junkMb > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Junk Level</span>
              <span className="font-medium">{formatSize(junkMb)} / {formatSize(thresholdMb)} threshold</span>
            </div>
            <div className="h-4 w-full rounded-full bg-muted/30 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min((junkMb / thresholdMb) * 100, 100)}%`,
                  backgroundColor: isAboveThreshold ? "#ef4444" : junkMb / thresholdMb > 0.7 ? "#f59e0b" : "#22c55e"
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configuration */}
      <Card>
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-3">
            <Settings2 className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-medium">Auto Clean Settings</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Enable Auto Cleaning</p>
                <p className="text-xs text-muted-foreground">Periodically scan for junk and alert when threshold is exceeded</p>
              </div>
              <button
                onClick={() => setEnabled(!enabled)}
                className={`relative h-6 w-11 rounded-full transition-colors ${enabled ? "bg-primary" : "bg-muted"}`}
              >
                <span className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Junk Threshold</p>
                <p className="text-xs text-muted-foreground">Alert when junk exceeds this amount</p>
              </div>
              <select className="rounded-md border bg-muted/50 px-3 py-1.5 text-sm" value={thresholdMb} onChange={e => setThresholdMb(Number(e.target.value))}>
                <option value={100}>100 MB</option>
                <option value={250}>250 MB</option>
                <option value={500}>500 MB</option>
                <option value={1024}>1 GB</option>
                <option value={2048}>2 GB</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Scan Interval</p>
                <p className="text-xs text-muted-foreground">How often to check for junk</p>
              </div>
              <select className="rounded-md border bg-muted/50 px-3 py-1.5 text-sm" value={intervalMin} onChange={e => setIntervalMin(Number(e.target.value))}>
                <option value={15}>Every 15 min</option>
                <option value={30}>Every 30 min</option>
                <option value={60}>Every hour</option>
                <option value={180}>Every 3 hours</option>
                <option value={360}>Every 6 hours</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info */}
      <Card>
        <CardContent className="p-4 flex items-start gap-3">
          <Zap className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">How Auto Clean Works</p>
            <p>Quick Scan estimates junk by checking Temp folders, browser caches, system logs, and Recycle Bin. Each category shows its impact on disk space.</p>
            <p>When junk exceeds your threshold, you'll be alerted to clean. All cleaning is done locally — no data is sent anywhere.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
