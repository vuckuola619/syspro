import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Puzzle, RefreshCw, Shield, AlertTriangle } from "lucide-react"
import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"

interface BrowserExtension {
  browser: string
  name: string
  version: string
  description: string
  permissions: string[]
  risk_level: string
  risk_score: number
  extension_id: string
  path: string
}

const BROWSER_ICONS: Record<string, string> = {
  Chrome: "🌐",
  Edge: "🔵",
  Firefox: "🦊",
}

const RISK_COLORS: Record<string, string> = {
  High: "#ef4444",
  Medium: "#f59e0b",
  Low: "#22c55e",
}

export default function BrowserExtensionsPage() {
  const [isScanning, setIsScanning] = useState(false)
  const [extensions, setExtensions] = useState<BrowserExtension[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterBrowser, setFilterBrowser] = useState("All")
  const [filterRisk, setFilterRisk] = useState("All")

  async function scan() {
    setIsScanning(true)
    try {
      const data = await invoke<BrowserExtension[]>("scan_browser_extensions")
      setExtensions(data)
      toast.success(`Found ${data.length} browser extensions`)
    } catch (e) {
      toast.error(String(e))
    } finally {
      setIsScanning(false)
    }
  }

  const browsers = ["All", ...new Set(extensions.map(e => e.browser))]
  const riskLevels = ["All", "High", "Medium", "Low"]

  const filtered = extensions
    .filter(e => filterBrowser === "All" || e.browser === filterBrowser)
    .filter(e => filterRisk === "All" || e.risk_level === filterRisk)

  const highRiskCount = extensions.filter(e => e.risk_level === "High").length
  const totalExtensions = extensions.length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Browser Extensions</h1>
        <p className="text-sm text-muted-foreground mt-1">Scan and analyze installed browser extensions for security risks</p>
      </div>

      {/* Scan + Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:border-primary/30 transition-colors" onClick={scan}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10">
              {isScanning ? <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" /> : <Puzzle className="h-5 w-5 text-blue-600" />}
            </div>
            <div>
              <p className="text-sm font-medium">Scan Extensions</p>
              <p className="text-xs text-muted-foreground">{totalExtensions > 0 ? `${totalExtensions} found` : "Click to scan"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 dark:bg-red-500/10">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-medium">High Risk</p>
              <p className="text-xs text-muted-foreground">{highRiskCount} extensions</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 dark:bg-green-500/10">
              <Shield className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Read-Only</p>
              <p className="text-xs text-muted-foreground">No modifications made</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      {extensions.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {browsers.map(b => (
            <button
              key={b}
              onClick={() => setFilterBrowser(b)}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${filterBrowser === b ? "bg-primary/10 border-primary text-primary" : "bg-muted/50 border-transparent hover:bg-muted"}`}
            >
              {b !== "All" && <span className="mr-1">{BROWSER_ICONS[b] || "🔌"}</span>}
              {b} {b === "All" ? `(${totalExtensions})` : `(${extensions.filter(e => e.browser === b).length})`}
            </button>
          ))}
          <span className="border-l mx-1" />
          {riskLevels.map(r => (
            <button
              key={r}
              onClick={() => setFilterRisk(r)}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${filterRisk === r ? "bg-primary/10 border-primary text-primary" : "bg-muted/50 border-transparent hover:bg-muted"}`}
            >
              {r !== "All" && <span className="inline-block h-2 w-2 rounded-full mr-1.5" style={{ backgroundColor: RISK_COLORS[r] }} />}
              {r}
            </button>
          ))}
        </div>
      )}

      {/* Extension list */}
      {filtered.length > 0 && (
        <div className="space-y-1">
          {filtered.map(ext => {
            const color = RISK_COLORS[ext.risk_level] || "#64748b"
            const isExpanded = expandedId === ext.extension_id
            return (
              <Card key={ext.extension_id + ext.browser} className={ext.risk_level === "High" ? "border-red-200 dark:border-red-500/20" : ""}>
                <CardContent className="p-0">
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : ext.extension_id)}
                  >
                    <div className="text-xl shrink-0">{BROWSER_ICONS[ext.browser] || "🔌"}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{ext.name}</p>
                        <Badge variant="secondary" className="text-[10px]">v{ext.version}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{ext.description || "No description"}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className="text-[10px]" style={{ backgroundColor: color + "20", color, border: `1px solid ${color}40` }}>
                        {ext.risk_level} Risk
                      </Badge>
                      <div className="w-8 h-2 rounded-full bg-muted/30 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${ext.risk_score}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="border-t bg-muted/10 px-4 py-3 space-y-2">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Browser:</span>
                        <span className="font-medium">{ext.browser}</span>
                        <span className="text-muted-foreground ml-4">ID:</span>
                        <span className="font-mono text-[10px]">{ext.extension_id}</span>
                      </div>
                      {ext.permissions.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Permissions ({ext.permissions.length}):</p>
                          <div className="flex flex-wrap gap-1">
                            {ext.permissions.map(p => (
                              <span
                                key={p}
                                className="px-1.5 py-0.5 rounded text-[10px] bg-muted/50 text-muted-foreground"
                              >
                                {p}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Risk Score: {ext.risk_score}/100 — {ext.risk_level === "High" ? "This extension has broad access to your browsing data." : ext.risk_level === "Medium" ? "This extension has moderate permissions." : "This extension has minimal permissions."}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {extensions.length === 0 && !isScanning && (
        <Card>
          <CardContent className="p-8 text-center">
            <Puzzle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Click "Scan Extensions" to find installed browser extensions.</p>
            <p className="text-xs text-muted-foreground mt-1">Scans Chrome, Edge, and Firefox. Read-only — no extensions are modified.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
