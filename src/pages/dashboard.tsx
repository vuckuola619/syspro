import { useEffect, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  HardDrive,
  Cpu,
  MemoryStick,
  Trash2,
  Shield,
  Rocket,
  RefreshCw,
  Database,
  Package,
  Monitor,
  Wifi,
} from "lucide-react"
import { NavLink } from "react-router-dom"

interface SystemOverview {
  cpu_name: string
  cpu_usage: number
  ram_total_gb: number
  ram_used_gb: number
  ram_usage_percent: number
  disks: DiskInfo[]
  os_name: string
  os_version: string
  hostname: string
  uptime_hours: number
}

interface DiskInfo {
  name: string
  mount_point: string
  total_gb: number
  used_gb: number
  free_gb: number
  usage_percent: number
  fs_type: string
}

interface HealthScore {
  overall: number
  junk_files_mb: number
  startup_items: number
  privacy_traces: number
}

interface JunkScanResult {
  categories: { id: string; name: string; files_count: number; size_mb: number }[]
}

interface PrivacyScanResult {
  categories: { id: string; name: string; items_count: number }[]
}

interface StartupItem {
  name: string
  enabled: boolean
}

interface NetworkSpeed {
  adapter_name: string
  bytes_sent: number
  bytes_received: number
}

function ScoreRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 58
  const offset = circumference - (score / 100) * circumference
  const color =
    score >= 80
      ? "hsl(142, 71%, 45%)"
      : score >= 50
        ? "hsl(38, 92%, 50%)"
        : "hsl(0, 84%, 60%)"

  return (
    <div className="relative flex h-36 w-36 items-center justify-center">
      <svg className="h-36 w-36 -rotate-90" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r="58" fill="none" className="stroke-muted" strokeWidth="8" />
        <circle cx="64" cy="64" r="58" fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold text-foreground">{score}</span>
        <span className="text-xs text-muted-foreground">Health Score</span>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [overview, setOverview] = useState<SystemOverview | null>(null)
  const [health, setHealth] = useState<HealthScore>({ overall: 0, junk_files_mb: 0, startup_items: 0, privacy_traces: 0 })
  const [isScanning, setIsScanning] = useState(false)
  const [hasScanned, setHasScanned] = useState(false)
  // Extended stats
  const [junkResult, setJunkResult] = useState<JunkScanResult | null>(null)
  const [privacyResult, setPrivacyResult] = useState<PrivacyScanResult | null>(null)
  const [startupItems, setStartupItems] = useState<StartupItem[]>([])
  const [networkSpeeds, setNetworkSpeeds] = useState<NetworkSpeed[]>([])
  const [registryIssues, setRegistryIssues] = useState<number>(0)

  useEffect(() => {
    loadSystemInfo()
    loadExtendedStats()
  }, [])

  async function loadSystemInfo() {
    try {
      const data = await invoke<SystemOverview>("get_system_overview")
      setOverview(data)
    } catch (e) { console.error("Failed to get system overview:", e) }
  }

  async function loadExtendedStats() {
    try {
      const [startup, network] = await Promise.allSettled([
        invoke<StartupItem[]>("get_startup_items"),
        invoke<NetworkSpeed[]>("get_network_speed"),
      ])
      if (startup.status === "fulfilled") setStartupItems(startup.value)
      if (network.status === "fulfilled") setNetworkSpeeds(network.value)
    } catch (e) { console.error(e) }
  }

  async function runHealthCheck() {
    setIsScanning(true)
    try {
      const [healthRes, junkRes, privacyRes, regRes] = await Promise.allSettled([
        invoke<HealthScore>("run_health_check"),
        invoke<JunkScanResult>("scan_junk_files"),
        invoke<PrivacyScanResult>("scan_privacy_traces"),
        invoke<{ issues: { id: string }[] }[]>("scan_registry_issues"),
      ])
      if (healthRes.status === "fulfilled") setHealth(healthRes.value)
      if (junkRes.status === "fulfilled") setJunkResult(junkRes.value)
      if (privacyRes.status === "fulfilled") setPrivacyResult(privacyRes.value)
      if (regRes.status === "fulfilled") {
        const issues = regRes.value
        setRegistryIssues(Array.isArray(issues) ? issues.length : 0)
      }
      setHasScanned(true)
    } catch (e) {
      console.error("Health check failed:", e)
      setHasScanned(true)
    } finally {
      setIsScanning(false)
    }
  }

  const ramPercent = overview ? overview.ram_usage_percent : 0
  const totalJunkMb = junkResult ? junkResult.categories.reduce((s, c) => s + c.size_mb, 0) : health.junk_files_mb
  const totalJunkFiles = junkResult ? junkResult.categories.reduce((s, c) => s + c.files_count, 0) : 0
  const totalPrivacy = privacyResult ? privacyResult.categories.reduce((s, c) => s + c.items_count, 0) : health.privacy_traces
  const enabledStartup = startupItems.filter(s => s.enabled).length
  const totalDiskGb = overview?.disks?.reduce((s, d) => s + d.total_gb, 0) || 0
  const usedDiskGb = overview?.disks?.reduce((s, d) => s + d.used_gb, 0) || 0
  const totalNetBytes = networkSpeeds.reduce((s, n) => s + n.bytes_received + n.bytes_sent, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitor your system health and optimize performance
        </p>
      </div>

      {/* Health Score + Quick Scan */}
      <Card>
        <CardContent className="flex items-center gap-8 p-6">
          <ScoreRing score={hasScanned ? health.overall : 0} />
          <div className="flex-1 space-y-3">
            <div>
              <h2 className="text-lg font-semibold">
                {hasScanned
                  ? health.overall >= 80 ? "Your system is in great shape"
                    : health.overall >= 50 ? "Your system needs some attention"
                    : "Your system needs immediate care"
                  : "Run a health check to get started"}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {hasScanned
                  ? "We found some areas that can be optimized for better performance."
                  : "Scan your system to identify junk files, startup issues, and privacy traces."}
              </p>
            </div>

            {hasScanned && (
              <div className="flex gap-6">
                <QuickStat icon={<Trash2 className="h-4 w-4" />} label="Junk Files" value={`${totalJunkMb} MB`} sub={totalJunkFiles > 0 ? `${totalJunkFiles.toLocaleString()} files` : undefined} status={totalJunkMb > 500 ? "warning" : "good"} href="/junk-cleaner" />
                <QuickStat icon={<Rocket className="h-4 w-4" />} label="Startup" value={`${enabledStartup} enabled`} sub={`${startupItems.length} total`} status={enabledStartup > 10 ? "warning" : "good"} href="/startup" />
                <QuickStat icon={<Shield className="h-4 w-4" />} label="Privacy" value={`${totalPrivacy} traces`} status={totalPrivacy > 100 ? "warning" : "good"} href="/privacy" />
                <QuickStat icon={<Database className="h-4 w-4" />} label="Registry" value={registryIssues > 0 ? `${registryIssues} issues` : "Clean"} status={registryIssues > 20 ? "warning" : "good"} href="/registry" />
              </div>
            )}

            <Button onClick={runHealthCheck} disabled={isScanning} className="gap-2">
              {isScanning ? <><RefreshCw className="h-4 w-4 animate-spin" /> Scanning...</> : <><RefreshCw className="h-4 w-4" /> {hasScanned ? "Re-scan" : "Run Health Check"}</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* System Overview — 4 cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-500/10">
                <Cpu className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-sm font-medium">CPU</CardTitle>
                <CardDescription className="text-xs truncate max-w-[140px]">{overview?.cpu_name || "Loading..."}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Usage</span>
                <span className="font-medium">{overview?.cpu_usage.toFixed(1) || 0}%</span>
              </div>
              <Progress value={overview?.cpu_usage || 0} indicatorClassName={(overview?.cpu_usage || 0) > 80 ? "bg-red-50 dark:bg-red-500/100" : "bg-blue-50 dark:bg-blue-500/100"} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-500/10">
                <MemoryStick className="h-4 w-4 text-violet-600" />
              </div>
              <div>
                <CardTitle className="text-sm font-medium">Memory</CardTitle>
                <CardDescription className="text-xs">{overview ? `${overview.ram_used_gb.toFixed(1)} / ${overview.ram_total_gb.toFixed(1)} GB` : "Loading..."}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Usage</span>
                <span className="font-medium">{ramPercent.toFixed(1)}%</span>
              </div>
              <Progress value={ramPercent} indicatorClassName={ramPercent > 85 ? "bg-red-50 dark:bg-red-500/100" : "bg-violet-50 dark:bg-violet-500/100"} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
                <HardDrive className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-sm font-medium">Storage</CardTitle>
                <CardDescription className="text-xs">{totalDiskGb > 0 ? `${usedDiskGb.toFixed(0)} / ${totalDiskGb.toFixed(0)} GB used` : "Loading..."}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overview?.disks?.slice(0, 2).map((disk, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{disk.mount_point} ({disk.fs_type})</span>
                    <span className="font-medium">{disk.free_gb.toFixed(1)} GB free</span>
                  </div>
                  <Progress value={disk.usage_percent} className="h-2" indicatorClassName={disk.usage_percent > 90 ? "bg-red-50 dark:bg-red-500/100" : "bg-emerald-50 dark:bg-emerald-500/100"} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-500/10">
                <Wifi className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <CardTitle className="text-sm font-medium">Network</CardTitle>
                <CardDescription className="text-xs">{networkSpeeds.length} adapter{networkSpeeds.length !== 1 ? "s" : ""}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Traffic</span>
                <span className="font-medium">{(totalNetBytes / 1024 / 1024 / 1024).toFixed(1)} GB</span>
              </div>
              {networkSpeeds.slice(0, 2).map((n, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground truncate max-w-[100px]">{n.adapter_name}</span>
                  <span>↓{(n.bytes_received / 1024 / 1024).toFixed(0)} ↑{(n.bytes_sent / 1024 / 1024).toFixed(0)} MB</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Junk breakdown after scan */}
      {junkResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Junk File Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              {junkResult.categories.map(cat => (
                <div key={cat.id} className="flex items-center gap-3 p-3 rounded-lg border">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10">
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{cat.size_mb} MB</p>
                    <p className="text-[10px] text-muted-foreground">{cat.name}</p>
                    <p className="text-[10px] text-muted-foreground">{cat.files_count.toLocaleString()} files</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* System Details + Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        {overview && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Monitor className="h-4 w-4" /> System Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <InfoRow label="Hostname" value={overview.hostname} />
                <InfoRow label="OS" value={`${overview.os_name} ${overview.os_version}`} />
                <InfoRow label="Uptime" value={`${Math.floor(overview.uptime_hours)}h ${Math.round((overview.uptime_hours % 1) * 60)}m`} />
                <InfoRow label="Startup Apps" value={`${enabledStartup} active / ${startupItems.length} total`} />
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Rocket className="h-4 w-4" /> Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "One-Click Optimize", href: "/one-click", icon: <RefreshCw className="h-3.5 w-3.5" /> },
                { label: "Clean Junk Files", href: "/junk-cleaner", icon: <Trash2 className="h-3.5 w-3.5" /> },
                { label: "Fix Privacy", href: "/privacy", icon: <Shield className="h-3.5 w-3.5" /> },
                { label: "Clean Registry", href: "/registry", icon: <Database className="h-3.5 w-3.5" /> },
                { label: "Manage Startup", href: "/startup", icon: <Rocket className="h-3.5 w-3.5" /> },
                { label: "Update Software", href: "/software-updater", icon: <Package className="h-3.5 w-3.5" /> },
              ].map(a => (
                <NavLink key={a.href} to={a.href} className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                  {a.icon} {a.label}
                </NavLink>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function QuickStat({ icon, label, value, sub, status, href }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; status: "good" | "warning"; href?: string
}) {
  const inner = (
    <div className="flex items-center gap-2">
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${status === "good" ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600" : "bg-amber-50 dark:bg-amber-500/10 text-amber-600"}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  )
  return href ? <NavLink to={href} className="hover:opacity-80 transition-opacity">{inner}</NavLink> : inner
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  )
}
