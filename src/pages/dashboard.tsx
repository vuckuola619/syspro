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
import { Badge } from "@/components/ui/badge"
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
  Wifi,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  Zap,
} from "lucide-react"
import { NavLink } from "react-router-dom"
import { toast } from "sonner"
import { AIAnalysis } from "@/components/ai-assistant"

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

/* ── Smart Analyze types (merged from Smart Optimize) ── */
interface ScoreCategory {
  name: string; score: number; max_score: number; status: string
}
interface Recommendation {
  title: string; description: string; impact: string; category: string; auto_fixable: boolean
}
interface OptimizationScore {
  overall_score: number; grade: string; categories: ScoreCategory[]; recommendations: Recommendation[]
}

const IMPACT_COLORS: Record<string, string> = { Critical: "#ef4444", High: "#f97316", Medium: "#eab308", Low: "#22c55e" }
const GRADE_COLORS: Record<string, string> = { "A+": "#22c55e", A: "#22c55e", B: "#3b82f6", C: "#eab308", D: "#f97316", F: "#ef4444" }

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
  // Smart Analyze (merged from Smart Optimize)
  const [optScore, setOptScore] = useState<OptimizationScore | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

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

  async function runSmartAnalyze() {
    setIsAnalyzing(true)
    try {
      const data = await invoke<OptimizationScore>("get_optimization_score")
      setOptScore(data)
      toast.success(`Smart Analyze: ${data.overall_score}/100 — Grade ${data.grade}`)
    } catch (e) { toast.error(String(e)) }
    finally { setIsAnalyzing(false) }
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
              <Progress value={overview?.cpu_usage || 0} indicatorClassName={(overview?.cpu_usage || 0) > 80 ? "bg-red-500" : "bg-blue-500"} />
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
              <Progress value={ramPercent} indicatorClassName={ramPercent > 85 ? "bg-red-500" : "bg-violet-500"} />
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
                  <Progress value={disk.usage_percent} className="h-2 bg-secondary" indicatorClassName={disk.usage_percent > 90 ? "bg-red-500" : "bg-emerald-500"} />
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

      {/* ── Smart Analyze Section (merged from Smart Optimize) ── */}
      <Card className="cursor-pointer hover:border-primary/30 transition-colors" onClick={runSmartAnalyze}>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-50 dark:bg-purple-500/10">
            {isAnalyzing ? <RefreshCw className="h-5 w-5 text-purple-600 animate-spin" /> : <Sparkles className="h-5 w-5 text-purple-600" />}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">{isAnalyzing ? "Analyzing system..." : "Smart Analyze"}</p>
            <p className="text-xs text-muted-foreground">{optScore ? `Score: ${optScore.overall_score}/100 — Grade ${optScore.grade}` : "Click to run deep system analysis with recommendations"}</p>
          </div>
          {optScore && (
            <span className="text-3xl font-bold" style={{ color: GRADE_COLORS[optScore.grade] || "#3b82f6" }}>{optScore.grade}</span>
          )}
        </CardContent>
      </Card>

      {optScore && (
        <>
          {/* Category breakdown */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <p className="text-sm font-medium mb-3">Category Breakdown</p>
              {optScore.categories.map(cat => (
                <div key={cat.name} className="flex items-center gap-3 p-2 rounded-lg bg-muted/20">
                  <span className="text-sm font-medium w-24">{cat.name}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(cat.score / cat.max_score) * 100}%`,
                        backgroundColor: cat.score >= cat.max_score * 0.75 ? "#22c55e" : cat.score >= cat.max_score * 0.5 ? "#eab308" : "#ef4444",
                      }}
                    />
                  </div>
                  <span className="text-xs font-mono w-12 text-right">{cat.score}/{cat.max_score}</span>
                  <span className="text-xs text-muted-foreground w-28 text-right">{cat.status}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recommendations */}
          {optScore.recommendations.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <p className="text-sm font-medium mb-3">Recommendations</p>
                {optScore.recommendations.map((rec, i) => {
                  const color = IMPACT_COLORS[rec.impact] || "#64748b"
                  return (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg border">
                      {rec.impact === "Critical" || rec.impact === "High"
                        ? <AlertTriangle className="h-4 w-4 mt-0.5" style={{ color }} />
                        : <Zap className="h-4 w-4 mt-0.5" style={{ color }} />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{rec.title}</span>
                          <Badge style={{ backgroundColor: color + "20", color, border: `1px solid ${color}40` }} className="text-[10px]">{rec.impact}</Badge>
                          {rec.auto_fixable && <Badge variant="outline" className="text-[10px]">Auto-fixable</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{rec.description}</p>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}

          {optScore.recommendations.length === 0 && (
            <Card className="border-green-200 dark:border-green-500/20">
              <CardContent className="p-4 flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-sm font-medium text-green-700 dark:text-green-400">Your system is well optimized. No recommendations at this time.</span>
              </CardContent>
            </Card>
          )}
          {/* AI-Powered Remediation */}
          <AIAnalysis
            title="AI Remediation Suggestions"
            context={[
              overview ? `System: ${overview.cpu_name}, RAM: ${overview.ram_used_gb.toFixed(1)}/${overview.ram_total_gb.toFixed(1)} GB, CPU: ${overview.cpu_usage.toFixed(1)}%` : "",
              optScore ? `Optimization Score: ${optScore.overall_score}/100 (Grade ${optScore.grade})` : "",
              optScore ? `Categories: ${optScore.categories.map(c => `${c.name}: ${c.score}/${c.max_score} (${c.status})`).join(", ")}` : "",
              optScore?.recommendations?.length ? `Issues found: ${optScore.recommendations.map(r => `[${r.impact}] ${r.title}: ${r.description}`).join("; ")}` : "",
              health ? `Health Score: ${health.overall}/100` : "",
              junkResult ? `Junk Files: ${junkResult.categories.reduce((s, c) => s + c.size_mb, 0).toFixed(1)} MB` : "",
              registryIssues > 0 ? `Registry Issues: ${registryIssues}` : "",
            ].filter(Boolean).join("\n")}
            prompt="Based on these system scan results, what are the top remediation steps I should take? Prioritize by impact. Include specific steps for each suggestion."
          />
        </>
      )}
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


