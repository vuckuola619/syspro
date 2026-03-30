import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ShieldBan, RefreshCw, ShieldCheck, ShieldOff, ChevronDown } from "lucide-react"
import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"

interface BlockCategory {
  name: string
  count: number
  domains: string[]
}

interface HostsBlockStatus {
  total_blocked: number
  is_active: boolean
  backup_exists: boolean
  categories: BlockCategory[]
}

const CATEGORY_ICONS: Record<string, string> = {
  Ads: "📢",
  Trackers: "👁️",
  Telemetry: "📡",
  Malware: "🦠",
}

export default function AdBlockerPage() {
  const [status, setStatus] = useState<HostsBlockStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [expandedCat, setExpandedCat] = useState<string | null>(null)

  async function loadStatus() {
    setIsLoading(true)
    try {
      const data = await invoke<HostsBlockStatus>("get_hosts_block_status")
      if (data) {
        setStatus({ ...data, categories: Array.isArray(data.categories) ? data.categories : [] })
        toast.success(data.is_active ? `Blocking ${data.total_blocked ?? 0} domains` : "Ad blocker is inactive")
      }
    } catch (e) {
      toast.error(String(e))
    } finally {
      setIsLoading(false)
    }
  }

  async function enable() {
    try {
      const msg = await invoke<string>("enable_hosts_blocking")
      toast.success(msg)
      loadStatus()
    } catch (e) {
      toast.error(String(e))
    }
  }

  async function disable() {
    try {
      const msg = await invoke<string>("disable_hosts_blocking")
      toast.success(msg)
      loadStatus()
    } catch (e) {
      toast.error(String(e))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ad Blocker</h1>
        <p className="text-sm text-muted-foreground mt-1">System-level ad, tracker, and telemetry blocking via hosts file</p>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:border-primary/30 transition-colors" onClick={loadStatus}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10">
              {isLoading ? <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" /> : <ShieldBan className="h-5 w-5 text-blue-600" />}
            </div>
            <div>
              <p className="text-sm font-medium">Check Status</p>
              <p className="text-xs text-muted-foreground">{status ? `${status.total_blocked} blocked` : "Click to check"}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-green-300 transition-colors" onClick={enable}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 dark:bg-green-500/10">
              <ShieldCheck className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Enable Blocking</p>
              <p className="text-xs text-muted-foreground">Block ads & trackers</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-red-300 transition-colors" onClick={disable}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 dark:bg-red-500/10">
              <ShieldOff className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Disable Blocking</p>
              <p className="text-xs text-muted-foreground">{status?.backup_exists ? "Restore from backup" : "Remove entries"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status display */}
      {status && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {status.is_active ? <ShieldCheck className="h-5 w-5 text-green-500" /> : <ShieldOff className="h-5 w-5 text-muted-foreground" />}
                <span className="text-sm font-medium">{status.is_active ? "Protection Active" : "Protection Inactive"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={status.is_active ? "default" : "secondary"}>{status.total_blocked} domains blocked</Badge>
                {status.backup_exists && <Badge variant="outline" className="text-[10px]">Backup exists</Badge>}
              </div>
            </div>

            {/* Categories */}
            {Array.isArray(status.categories) && status.categories.length > 0 && (
              <div className="space-y-1 mt-3">
                {status.categories.map(cat => (
                  <div key={cat.name} className="rounded-lg border">
                    <div
                      className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => setExpandedCat(expandedCat === cat.name ? null : cat.name)}
                    >
                      <div className="flex items-center gap-2">
                        <span>{CATEGORY_ICONS[cat.name] || "🔒"}</span>
                        <span className="text-sm font-medium">{cat.name}</span>
                        <Badge variant="secondary" className="text-[10px]">{cat.count}</Badge>
                      </div>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedCat === cat.name ? "rotate-180" : ""}`} />
                    </div>
                    {expandedCat === cat.name && (
                      <div className="border-t px-3 py-2 bg-muted/10">
                        <div className="flex flex-wrap gap-1">
                          {Array.isArray(cat.domains) && cat.domains.map(d => (
                            <span key={d} className="px-2 py-0.5 rounded text-[10px] bg-muted/50 text-muted-foreground font-mono">{d}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!status && !isLoading && (
        <Card>
          <CardContent className="p-8 text-center">
            <ShieldBan className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Click "Check Status" to see current hosts-file blocking.</p>
            <p className="text-xs text-muted-foreground mt-1">Blocks ads, trackers, telemetry, and known malware domains at the system level. Requires Administrator to modify.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
