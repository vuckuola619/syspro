import { useEffect, useRef } from "react"
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
import { ScrollArea } from "@/components/ui/scroll-area"
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
  Flame,
  Lock,
  Globe,
  Package,
  Activity,
} from "lucide-react"
import { NavLink } from "react-router-dom"
import { AIAnalysis } from "@/components/ai-assistant"
import { useDashboard } from "@/context/dashboard-context"

const IMPACT_COLORS: Record<string, string> = { Critical: "#ef4444", High: "#f97316", Medium: "#eab308", Low: "#22c55e" }

function ScoreRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 58
  const offset = circumference - (score / 100) * circumference
  const color = score >= 80 ? "hsl(142, 71%, 45%)" : score >= 50 ? "hsl(38, 92%, 50%)" : "hsl(0, 84%, 60%)"

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
  const {
    isAnalyzing, analysisComplete, analysisPercent, analysisLog, currentStep,
    overview, health, junkResult, privacyResult, startupItems, networkSpeeds,
    registryIssues, optScore, featureSnap,
    analyzeSystem,
  } = useDashboard()

  const hasTriggered = useRef(false)
  useEffect(() => {
    // Auto-run only if never analyzed before
    if (!hasTriggered.current && !analysisComplete && !isAnalyzing) {
      hasTriggered.current = true
      analyzeSystem()
    }
  }, [analysisComplete, isAnalyzing, analyzeSystem])

  // Computed values
  const ramPercent = overview ? overview.ram_usage_percent : 0
  const totalJunkMb = junkResult ? junkResult.categories.reduce((s, c) => s + c.size_mb, 0) : health.junk_files_mb
  const totalJunkFiles = junkResult ? junkResult.categories.reduce((s, c) => s + c.files_count, 0) : 0
  const totalPrivacy = privacyResult ? privacyResult.categories.reduce((s, c) => s + c.items_count, 0) : health.privacy_traces
  const enabledStartup = startupItems.filter(s => s.enabled).length
  const totalDiskGb = overview?.disks?.reduce((s, d) => s + d.total_gb, 0) || 0
  const usedDiskGb = overview?.disks?.reduce((s, d) => s + d.used_gb, 0) || 0
  const totalNetBytes = networkSpeeds.reduce((s, n) => s + n.bytes_received + n.bytes_sent, 0)
  const finalScore = optScore ? optScore.overall_score : health.overall

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitor your system health and optimize performance
        </p>
      </div>

      {/* ── Analysis Card ── */}
      <Card>
        <CardContent className="flex items-center gap-8 p-6">
          {/* Left: Score ring or progress ring */}
          {analysisComplete ? (
            <ScoreRing score={finalScore} />
          ) : (
            <div className="relative flex h-36 w-36 shrink-0 items-center justify-center">
              <svg className="h-36 w-36 -rotate-90" viewBox="0 0 128 128">
                <circle cx="64" cy="64" r="58" fill="none" className="stroke-muted" strokeWidth="8" />
                {isAnalyzing && (
                  <circle cx="64" cy="64" r="58" fill="none" stroke="hsl(217, 91%, 60%)" strokeWidth="8"
                    strokeDasharray={2 * Math.PI * 58} strokeDashoffset={(2 * Math.PI * 58) * (1 - analysisPercent / 100)}
                    strokeLinecap="round" className="transition-all duration-500 ease-out" />
                )}
              </svg>
              <div className="absolute flex flex-col items-center">
                {isAnalyzing ? (
                  <>
                    <span className="text-2xl font-bold text-foreground">{analysisPercent}%</span>
                    <span className="text-[10px] text-muted-foreground">Analyzing</span>
                  </>
                ) : (
                  <>
                    <span className="text-lg font-semibold text-muted-foreground">—</span>
                    <span className="text-[10px] text-muted-foreground">Ready</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Right: Status + controls */}
          <div className="flex-1 space-y-3 min-w-0">
            {analysisComplete ? (
              <>
                <div>
                  <h2 className="text-lg font-semibold">
                    {optScore
                      ? optScore.grade === "A" || optScore.grade === "B" ? "Your system is in great shape"
                        : optScore.grade === "C" ? "Your system needs some attention"
                        : "Your system needs immediate care"
                      : "Analysis Complete"}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {optScore ? `Score: ${optScore.overall_score}/100 — Grade ${optScore.grade}` : `Health Score: ${health.overall}/100`}
                  </p>
                </div>

                <div className="flex gap-6">
                  <QuickStat icon={<Trash2 className="h-4 w-4" />} label="Junk Files" value={`${totalJunkMb} MB`} sub={totalJunkFiles > 0 ? `${totalJunkFiles.toLocaleString()} files` : undefined} status={totalJunkMb > 500 ? "warning" : "good"} href="/junk-cleaner" />
                  <QuickStat icon={<Rocket className="h-4 w-4" />} label="Startup" value={`${enabledStartup} enabled`} sub={`${startupItems.length} total`} status={enabledStartup > 10 ? "warning" : "good"} href="/startup" />
                  <QuickStat icon={<Shield className="h-4 w-4" />} label="Privacy" value={`${totalPrivacy} traces`} status={totalPrivacy > 100 ? "warning" : "good"} href="/privacy" />
                  <QuickStat icon={<Database className="h-4 w-4" />} label="Registry" value={registryIssues > 0 ? `${registryIssues} issues` : "Clean"} status={registryIssues > 20 ? "warning" : "good"} href="/registry" />
                </div>

                <Button onClick={analyzeSystem} disabled={isAnalyzing} variant="outline" className="gap-2">
                  <RefreshCw className="h-4 w-4" /> Re-analyze
                </Button>
              </>
            ) : (
              <>
                <div>
                  <h2 className="text-lg font-semibold">
                    {isAnalyzing ? "Analyzing System..." : "System Analysis"}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {isAnalyzing ? currentStep : "Run a full system scan to see your health score and recommendations"}
                  </p>
                </div>

                {isAnalyzing ? (
                  <>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{currentStep}</span>
                        <span>{analysisPercent}%</span>
                      </div>
                      <Progress value={analysisPercent} className="h-2" indicatorClassName="bg-blue-500 transition-all duration-500" />
                    </div>

                    <ScrollArea className="h-28 rounded-md border bg-muted/30">
                      <div className="p-2 font-mono text-[11px] text-muted-foreground space-y-0.5">
                        {analysisLog.map((line, i) => (
                          <p key={i} className={line.startsWith("  ✓") ? "text-green-600 dark:text-green-400" : line.startsWith("  ⚠") ? "text-amber-600 dark:text-amber-400" : ""}>{line}</p>
                        ))}
                      </div>
                    </ScrollArea>
                  </>
                ) : (
                  <Button onClick={analyzeSystem} className="gap-2">
                    <Sparkles className="h-4 w-4" /> Analyze System
                  </Button>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── System overview 4 cards ── */}
      {analysisComplete && (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-500/10">
                  <Cpu className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium">CPU</CardTitle>
                  <CardDescription className="text-xs truncate max-w-[140px]">{overview?.cpu_name || "N/A"}</CardDescription>
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
                  <CardDescription className="text-xs">{overview ? `${overview.ram_used_gb.toFixed(1)} / ${overview.ram_total_gb.toFixed(1)} GB` : "N/A"}</CardDescription>
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
                  <CardDescription className="text-xs">{totalDiskGb > 0 ? `${usedDiskGb.toFixed(0)} / ${totalDiskGb.toFixed(0)} GB used` : "N/A"}</CardDescription>
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
      )}

      {/* ── Junk breakdown ── */}
      {analysisComplete && junkResult && (
        <Card>
          <CardHeader><CardTitle className="text-base">Junk File Breakdown</CardTitle></CardHeader>
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

      {/* ── Feature Status Grid ── */}
      {analysisComplete && (
        <Card>
          <CardHeader><CardTitle className="text-base">Feature Overview</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <FeatureCard icon={<Trash2 className="h-4 w-4 text-red-500" />} title="Cleaning" value={`${totalJunkMb} MB junk`} status={totalJunkMb > 500 ? "warning" : "good"} href="/junk-cleaner" bg="bg-red-50 dark:bg-red-500/10" />
              <FeatureCard icon={<Rocket className="h-4 w-4 text-blue-500" />} title="Startup" value={`${enabledStartup} enabled / ${startupItems.length} total`} status={enabledStartup > 10 ? "warning" : "good"} href="/startup" bg="bg-blue-50 dark:bg-blue-500/10" />
              <FeatureCard icon={<Shield className="h-4 w-4 text-green-500" />} title="Security" value={featureSnap.defender?.real_time_protection ? "Defender Active" : "Defender Off"} status={featureSnap.defender?.real_time_protection ? "good" : "critical"} href="/anti-spyware" bg="bg-green-50 dark:bg-green-500/10" />
              <FeatureCard icon={<Lock className="h-4 w-4 text-purple-500" />} title="Privacy" value={`${totalPrivacy} traces`} status={totalPrivacy > 300 ? "warning" : "good"} href="/privacy" bg="bg-purple-50 dark:bg-purple-500/10" />
              <FeatureCard icon={<Globe className="h-4 w-4 text-cyan-500" />} title="Network" value={`${networkSpeeds.length} adapter${networkSpeeds.length !== 1 ? "s" : ""}`} status="good" href="/network-monitor" bg="bg-cyan-50 dark:bg-cyan-500/10" />
              <FeatureCard icon={<Activity className="h-4 w-4 text-teal-500" />} title="Disk Health" value={featureSnap.diskHealth.length > 0 ? `${featureSnap.diskHealth[0].health_percent}% healthy` : "No SMART data"} status={featureSnap.diskHealth.some(d => d.health_percent < 80) ? "warning" : "good"} href="/disk-health" bg="bg-teal-50 dark:bg-teal-500/10" />
              <FeatureCard icon={<Package className="h-4 w-4 text-orange-500" />} title="Software" value={featureSnap.softwareUpdates > 0 ? `${featureSnap.softwareUpdates} updates` : "All up to date"} status={featureSnap.softwareUpdates > 3 ? "warning" : "good"} href="/software-updater" bg="bg-orange-50 dark:bg-orange-500/10" />
              <FeatureCard icon={<Flame className="h-4 w-4 text-amber-500" />} title="Firewall" value={`${featureSnap.firewallCount} active rules`} status={featureSnap.firewallCount > 0 ? "good" : "critical"} href="/firewall" bg="bg-amber-50 dark:bg-amber-500/10" />
              <FeatureCard icon={<Database className="h-4 w-4 text-indigo-500" />} title="Registry" value={registryIssues > 0 ? `${registryIssues} issues` : "Clean"} status={registryIssues > 20 ? "warning" : "good"} href="/registry" bg="bg-indigo-50 dark:bg-indigo-500/10" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Score breakdown + Recommendations + AI (after analysis) ── */}
      {analysisComplete && optScore && (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <p className="text-sm font-medium mb-3">Category Breakdown</p>
              {optScore.categories.map(cat => (
                <div key={cat.name} className="flex items-center gap-3 p-2 rounded-lg bg-muted/20">
                  <span className="text-sm font-medium w-24">{cat.name}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{
                        width: `${(cat.score / cat.max_score) * 100}%`,
                        backgroundColor: cat.score >= cat.max_score * 0.75 ? "#22c55e" : cat.score >= cat.max_score * 0.5 ? "#eab308" : "#ef4444",
                      }} />
                  </div>
                  <span className="text-xs font-mono w-12 text-right">{cat.score}/{cat.max_score}</span>
                  <span className="text-xs text-muted-foreground w-28 text-right">{cat.status}</span>
                </div>
              ))}
            </CardContent>
          </Card>

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

function FeatureCard({ icon, title, value, status, href, bg }: {
  icon: React.ReactNode; title: string; value: string; status: "good" | "warning" | "critical"; href: string; bg: string
}) {
  const badgeColor = status === "good" ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400"
    : status === "warning" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
    : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400"
  const badgeLabel = status === "good" ? "OK" : status === "warning" ? "Attention" : "Critical"

  return (
    <NavLink to={href} className="flex items-center gap-3 p-3 rounded-lg border hover:border-primary/30 hover:shadow-sm transition-all">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${bg}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-[11px] text-muted-foreground truncate">{value}</p>
      </div>
      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${badgeColor}`}>{badgeLabel}</span>
    </NavLink>
  )
}
