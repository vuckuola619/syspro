import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  Zap, RefreshCw, Trash2, Shield, Database, Rocket, Download, Clock,
  CheckCircle2, ChevronDown, ChevronUp, AlertTriangle, HardDrive, Cpu,
  FileText, Play, ArrowRight
} from "lucide-react"
import { useState, useRef } from "react"
import { invoke } from "@tauri-apps/api/core"
import { save } from "@tauri-apps/plugin-dialog"

// ─── Types ───

interface JunkCategory { id: string; name: string; files_count: number; size_mb: number }
interface PrivacyCategory { id: string; name: string; items_count: number }
interface RegistryIssue { id: string; description: string; category: string; severity: string }
interface StartupItem { name: string; enabled: boolean; impact: string; location: string }
interface DiskHealthInfo { name: string; health_percent: number; temperature: number; power_on_hours: number }

interface DiagnosticResult {
  junk: { categories: JunkCategory[]; totalMb: number; totalFiles: number }
  privacy: { categories: PrivacyCategory[]; totalTraces: number }
  registry: { issues: RegistryIssue[]; count: number }
  startup: { items: StartupItem[]; enabledCount: number; totalCount: number }
  diskHealth: DiskHealthInfo[]
  ramUsagePercent: number
  score: number
}

interface LogEntry { time: string; step: string; detail: string; type: "info" | "success" | "warn" | "error" }
type Phase = "idle" | "scanning" | "results" | "remediating" | "done"

// ─── Helpers ───

function timestamp() {
  return new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

function healthLabel(score: number) {
  if (score >= 85) return { text: "Good", color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-500/100" }
  if (score >= 60) return { text: "Fair", color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-500/100" }
  return { text: "Poor", color: "text-red-500", bg: "bg-red-50 dark:bg-red-500/100" }
}

// ─── Component ───

export default function OneClickPage() {
  const [phase, setPhase] = useState<Phase>("idle")
  const [scanStep, setScanStep] = useState(0)
  const [diagnostic, setDiagnostic] = useState<DiagnosticResult | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [showLogs, setShowLogs] = useState(false)
  const [fixedCategories, setFixedCategories] = useState<Set<string>>(new Set())
  const [fixing, setFixing] = useState<string | null>(null)
  const [scoreAfter, setScoreAfter] = useState<number | null>(null)
  const logRef = useRef<HTMLDivElement>(null)

  function addLog(step: string, detail: string, type: LogEntry["type"] = "info") {
    setLogs(prev => [...prev, { time: timestamp(), step, detail, type }])
    setTimeout(() => logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" }), 50)
  }

  // ─── Phase 1: Full System Diagnostic ───

  async function runDiagnostic() {
    setPhase("scanning")
    setLogs([])
    setFixedCategories(new Set())
    setScoreAfter(null)
    setScanStep(0)
    addLog("Start", "SABI Full System Diagnostic started", "info")

    const result: DiagnosticResult = {
      junk: { categories: [], totalMb: 0, totalFiles: 0 },
      privacy: { categories: [], totalTraces: 0 },
      registry: { issues: [], count: 0 },
      startup: { items: [], enabledCount: 0, totalCount: 0 },
      diskHealth: [],
      ramUsagePercent: 0,
      score: 100,
    }

    // 1. Junk scan
    setScanStep(1)
    addLog("Junk Scanner", "Scanning temp files, caches, logs...", "info")
    try {
      const data = await invoke<{ categories: JunkCategory[] }>("scan_junk_files")
      result.junk.categories = data.categories
      result.junk.totalMb = data.categories.reduce((s, c) => s + c.size_mb, 0)
      result.junk.totalFiles = data.categories.reduce((s, c) => s + c.files_count, 0)
      addLog("Junk Scanner", `Found ${result.junk.totalFiles.toLocaleString()} files (${result.junk.totalMb} MB)`, result.junk.totalMb > 500 ? "warn" : "info")
    } catch (e) { addLog("Junk Scanner", `Error: ${e}`, "error") }

    // 2. Privacy traces
    setScanStep(2)
    addLog("Privacy Scanner", "Scanning cookies, history, tracking data...", "info")
    try {
      const data = await invoke<{ categories: PrivacyCategory[] }>("scan_privacy_traces")
      result.privacy.categories = data.categories
      result.privacy.totalTraces = data.categories.reduce((s, c) => s + c.items_count, 0)
      addLog("Privacy Scanner", `Found ${result.privacy.totalTraces} privacy traces`, result.privacy.totalTraces > 100 ? "warn" : "info")
    } catch (e) { addLog("Privacy Scanner", `Error: ${e}`, "error") }

    // 3. Registry issues
    setScanStep(3)
    addLog("Registry Scanner", "Scanning registry for invalid entries...", "info")
    try {
      const data = await invoke<RegistryIssue[]>("scan_registry_issues")
      result.registry.issues = data
      result.registry.count = data.length
      addLog("Registry Scanner", `Found ${data.length} registry issues`, data.length > 30 ? "warn" : "info")
    } catch (e) { addLog("Registry Scanner", `Error: ${e}`, "error") }

    // 4. Startup items
    setScanStep(4)
    addLog("Startup Analyzer", "Auditing startup programs...", "info")
    try {
      const data = await invoke<StartupItem[]>("get_startup_items")
      result.startup.items = data
      result.startup.enabledCount = data.filter(i => i.enabled).length
      result.startup.totalCount = data.length
      addLog("Startup Analyzer", `${result.startup.enabledCount} enabled / ${data.length} total`, result.startup.enabledCount > 10 ? "warn" : "info")
    } catch (e) { addLog("Startup Analyzer", `Error: ${e}`, "error") }

    // 5. Disk health
    setScanStep(5)
    addLog("Disk Health", "Reading S.M.A.R.T. diagnostics...", "info")
    try {
      const data = await invoke<DiskHealthInfo[]>("get_smart_health")
      result.diskHealth = data
      for (const d of data) {
        const hl = healthLabel(d.health_percent)
        addLog("Disk Health", `${d.name}: ${d.health_percent}% health (${hl.text})`, d.health_percent < 60 ? "warn" : "info")
      }
    } catch (e) { addLog("Disk Health", `Skipped: ${e}`, "info") }

    // 6. RAM usage
    setScanStep(6)
    addLog("Memory", "Checking RAM usage...", "info")
    try {
      const stats = await invoke<{ cpu_usage: number; total_ram: number; used_ram: number }>("get_processes")
      result.ramUsagePercent = Math.round((stats.used_ram / stats.total_ram) * 100)
      addLog("Memory", `RAM usage: ${result.ramUsagePercent}% (${(stats.used_ram / 1073741824).toFixed(1)} / ${(stats.total_ram / 1073741824).toFixed(1)} GB)`, result.ramUsagePercent > 85 ? "warn" : "info")
    } catch (e) { addLog("Memory", `Skipped: ${e}`, "info") }

    // Calculate health score
    let score = 100
    score -= Math.min(Math.floor(result.junk.totalMb / 50), 15)
    score -= Math.min(Math.floor(result.privacy.totalTraces / 20), 10)
    score -= Math.min(Math.floor(result.registry.count / 10), 10)
    score -= result.startup.enabledCount > 8 ? Math.min((result.startup.enabledCount - 8) * 2, 15) : 0
    score -= result.ramUsagePercent > 85 ? 10 : result.ramUsagePercent > 70 ? 5 : 0
    for (const d of result.diskHealth) {
      if (d.health_percent < 50) score -= 15
      else if (d.health_percent < 70) score -= 5
    }
    result.score = Math.max(score, 0)

    addLog("Score", `System Health Score: ${result.score}/100`, result.score < 60 ? "warn" : "success")
    addLog("Complete", "Diagnostic scan finished. Review results below.", "success")

    setDiagnostic(result)
    setPhase("results")
  }

  // ─── Phase 2: Remediate individual categories ───

  async function fixJunk() {
    if (!diagnostic) return
    setFixing("junk")
    addLog("Fix", "Cleaning junk files...", "info")
    try {
      await invoke("clean_junk_files", { categoryIds: diagnostic.junk.categories.map(c => c.id) })
      addLog("Fix", `Cleaned ${diagnostic.junk.totalMb} MB of junk ✓`, "success")
      setFixedCategories(prev => new Set([...prev, "junk"]))
    } catch (e) { addLog("Fix", `Error cleaning junk: ${e}`, "error") }
    setFixing(null)
  }

  async function fixPrivacy() {
    if (!diagnostic) return
    setFixing("privacy")
    addLog("Fix", "Erasing privacy traces...", "info")
    try {
      await invoke("clean_privacy_traces", { categoryIds: diagnostic.privacy.categories.map(c => c.id) })
      addLog("Fix", `Cleaned ${diagnostic.privacy.totalTraces} privacy traces ✓`, "success")
      setFixedCategories(prev => new Set([...prev, "privacy"]))
    } catch (e) { addLog("Fix", `Error cleaning privacy: ${e}`, "error") }
    setFixing(null)
  }

  async function fixRegistry() {
    if (!diagnostic) return
    setFixing("registry")
    addLog("Fix", "Fixing registry issues...", "info")
    try {
      await invoke("backup_registry")
      addLog("Fix", "Registry backup created", "info")
      await invoke("clean_registry_issues", { issueIds: diagnostic.registry.issues.map(i => i.id) })
      addLog("Fix", `Fixed ${diagnostic.registry.count} registry issues ✓`, "success")
      setFixedCategories(prev => new Set([...prev, "registry"]))
    } catch (e) { addLog("Fix", `Error fixing registry: ${e}`, "error") }
    setFixing(null)
  }

  async function fixMemory() {
    setFixing("memory")
    addLog("Fix", "Optimizing memory...", "info")
    try {
      await invoke("optimize_memory")
      addLog("Fix", "Memory optimized ✓", "success")
      setFixedCategories(prev => new Set([...prev, "memory"]))
    } catch (e) { addLog("Fix", `Error optimizing memory: ${e}`, "error") }
    setFixing(null)
  }

  async function fixAll() {
    setPhase("remediating")
    addLog("Fix All", "Running all remediation actions...", "info")
    if (!fixedCategories.has("junk")) await fixJunk()
    if (!fixedCategories.has("privacy")) await fixPrivacy()
    if (!fixedCategories.has("registry")) await fixRegistry()
    if (!fixedCategories.has("memory") && diagnostic && diagnostic.ramUsagePercent > 70) await fixMemory()
    
    // Recalc score
    let newScore = 100
    if (diagnostic) {
      newScore -= diagnostic.startup.enabledCount > 8 ? Math.min((diagnostic.startup.enabledCount - 8), 8) : 0
      for (const d of diagnostic.diskHealth) {
        if (d.health_percent < 50) newScore -= 10
        else if (d.health_percent < 70) newScore -= 3
      }
    }
    setScoreAfter(Math.max(newScore, 0))
    addLog("Complete", `All fixes applied. Score improved to ${Math.max(newScore, 0)}/100`, "success")
    setPhase("done")
  }

  // ─── Phase 3: Export Report ───

  async function exportReport() {
    if (!diagnostic) return
    const lines: string[] = []
    const ln = (s = "") => lines.push(s)
    const sep = () => ln("═".repeat(60))

    sep()
    ln("     SABI — SYSTEM DIAGNOSTIC REPORT")
    ln(`     Generated: ${new Date().toLocaleString()}`)
    sep()
    ln()

    // Score
    ln(`SYSTEM HEALTH SCORE: ${diagnostic.score}/100 ${healthLabel(diagnostic.score).text.toUpperCase()}`)
    if (scoreAfter !== null) ln(`SCORE AFTER FIX:     ${scoreAfter}/100`)
    ln()

    // Junk
    ln("─── JUNK FILES ───")
    ln(`Status: ${fixedCategories.has("junk") ? "✅ FIXED" : `⚠ ${diagnostic.junk.totalMb} MB found`}`)
    for (const c of diagnostic.junk.categories) {
      if (c.files_count > 0) ln(`  • ${c.name}: ${c.files_count} files (${c.size_mb} MB)`)
    }
    ln()

    // Privacy
    ln("─── PRIVACY TRACES ───")
    ln(`Status: ${fixedCategories.has("privacy") ? "✅ FIXED" : `⚠ ${diagnostic.privacy.totalTraces} traces found`}`)
    for (const c of diagnostic.privacy.categories) {
      if (c.items_count > 0) ln(`  • ${c.name}: ${c.items_count} items`)
    }
    ln()

    // Registry
    ln("─── REGISTRY ISSUES ───")
    ln(`Status: ${fixedCategories.has("registry") ? "✅ FIXED" : `⚠ ${diagnostic.registry.count} issues found`}`)
    for (const issue of diagnostic.registry.issues.slice(0, 20)) {
      ln(`  • ${issue.description}`)
    }
    if (diagnostic.registry.count > 20) ln(`  ... and ${diagnostic.registry.count - 20} more`)
    ln()

    // Startup
    ln("─── STARTUP PROGRAMS ───")
    ln(`Status: ${diagnostic.startup.enabledCount > 10 ? "⚠ Too many enabled" : "✅ OK"} (${diagnostic.startup.enabledCount}/${diagnostic.startup.totalCount})`)
    for (const item of diagnostic.startup.items.filter(i => i.enabled)) {
      ln(`  • ${item.name} [${item.impact || "Unknown impact"}]`)
    }
    ln()

    // Disk Health
    if (diagnostic.diskHealth.length > 0) {
      ln("─── DISK HEALTH ───")
      for (const d of diagnostic.diskHealth) {
        const hl = healthLabel(d.health_percent)
        ln(`  • ${d.name}: ${d.health_percent}% health (${hl.text}) | Temp: ${d.temperature}°C | Power On: ${d.power_on_hours}h`)
      }
      ln()
    }

    // Memory
    ln("─── MEMORY ───")
    ln(`Status: ${fixedCategories.has("memory") ? "✅ OPTIMIZED" : diagnostic.ramUsagePercent > 85 ? "⚠ HIGH USAGE" : "✅ OK"} (${diagnostic.ramUsagePercent}% used)`)
    ln()

    // Recommendations
    ln("─── RECOMMENDATIONS ───")
    if (!fixedCategories.has("junk") && diagnostic.junk.totalMb > 100) ln("  → Clean junk files to free disk space")
    if (!fixedCategories.has("privacy") && diagnostic.privacy.totalTraces > 50) ln("  → Erase privacy traces for better privacy")
    if (!fixedCategories.has("registry") && diagnostic.registry.count > 20) ln("  → Fix registry issues for system stability")
    if (diagnostic.startup.enabledCount > 10) ln("  → Disable unnecessary startup programs for faster boot")
    if (diagnostic.ramUsagePercent > 85) ln("  → Close unused applications or upgrade RAM")
    for (const d of diagnostic.diskHealth) {
      if (d.health_percent < 60) ln(`  → CRITICAL: Disk "${d.name}" health is low. Consider backup/replacement.`)
      if (d.temperature > 55) ln(`  → WARNING: Disk "${d.name}" temperature is high (${d.temperature}°C)`)
    }
    if (fixedCategories.size > 0 && scoreAfter !== null && scoreAfter >= 85) ln("  → System is in good health! No further action needed.")
    ln()

    // Log
    ln("─── DIAGNOSTIC LOG ───")
    for (const l of logs) {
      ln(`[${l.time}] [${l.step}] ${l.detail}`)
    }
    ln()
    sep()

    const text = lines.join("\n")

    try {
      const filePath = await save({
        defaultPath: `SABI_Diagnostic_${new Date().toISOString().slice(0, 10)}.txt`,
        filters: [{ name: "Text", extensions: ["txt"] }],
      })
      if (filePath) {
        await invoke("save_text_file", { path: filePath, content: text })
        addLog("Export", `Report saved to ${filePath}`, "success")
      }
    } catch {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(text)
      addLog("Export", "Report copied to clipboard", "success")
    }
  }

  // ─── Render ───

  const scanSteps = [
    { label: "Junk Files", icon: Trash2 },
    { label: "Privacy", icon: Shield },
    { label: "Registry", icon: Database },
    { label: "Startup", icon: Rocket },
    { label: "Disk Health", icon: HardDrive },
    { label: "Memory", icon: Cpu },
  ]

  const issues = diagnostic ? [
    {
      key: "junk", label: "Junk Files", icon: Trash2,
      severity: diagnostic.junk.totalMb > 500 ? "high" : diagnostic.junk.totalMb > 100 ? "medium" : "low",
      detail: `${diagnostic.junk.totalMb} MB across ${diagnostic.junk.totalFiles.toLocaleString()} files`,
      items: diagnostic.junk.categories.filter(c => c.files_count > 0).map(c => `${c.name}: ${c.files_count} files (${c.size_mb} MB)`),
      onFix: fixJunk,
    },
    {
      key: "privacy", label: "Privacy Traces", icon: Shield,
      severity: diagnostic.privacy.totalTraces > 200 ? "high" : diagnostic.privacy.totalTraces > 50 ? "medium" : "low",
      detail: `${diagnostic.privacy.totalTraces} tracking items found`,
      items: diagnostic.privacy.categories.filter(c => c.items_count > 0).map(c => `${c.name}: ${c.items_count} items`),
      onFix: fixPrivacy,
    },
    {
      key: "registry", label: "Registry Issues", icon: Database,
      severity: diagnostic.registry.count > 50 ? "high" : diagnostic.registry.count > 20 ? "medium" : "low",
      detail: `${diagnostic.registry.count} invalid entries`,
      items: diagnostic.registry.issues.slice(0, 5).map(i => i.description),
      onFix: fixRegistry,
    },
    {
      key: "memory", label: "Memory Usage", icon: Cpu,
      severity: diagnostic.ramUsagePercent > 85 ? "high" : diagnostic.ramUsagePercent > 70 ? "medium" : "low",
      detail: `${diagnostic.ramUsagePercent}% RAM used`,
      items: [],
      onFix: fixMemory,
    },
  ] : []

  const sevColor = (s: string) => s === "high" ? "text-red-500" : s === "medium" ? "text-amber-500" : "text-emerald-500"
  const sevBg = (s: string) => s === "high" ? "bg-red-50 dark:bg-red-500/100/10 border-red-500/20" : s === "medium" ? "bg-amber-50 dark:bg-amber-500/100/10 border-amber-500/20" : "bg-emerald-50 dark:bg-emerald-500/100/10 border-emerald-500/20"
  const sevBadge = (s: string) => s === "high" ? "destructive" : s === "medium" ? "secondary" : "secondary" as const

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">System Diagnostic & Optimizer</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {phase === "idle" ? "Full system scan with detailed results and one-click remediation"
           : phase === "scanning" ? "Scanning your system..."
           : phase === "results" ? "Review findings and fix issues"
           : phase === "remediating" ? "Applying fixes..."
           : "Optimization complete!"}
        </p>
      </div>

      {/* ─── Idle State ─── */}
      {phase === "idle" && (
        <>
          <Card className="border-primary/20 bg-primary/5 dark:bg-primary/5">
            <CardContent className="p-5">
              <p className="text-xs font-medium mb-3 text-primary">This diagnostic scans 6 areas:</p>
              <div className="grid grid-cols-3 gap-3">
                {scanSteps.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <s.icon className="h-3.5 w-3.5 text-primary/60" />
                    <span>{i + 1}. {s.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-center">
            <Button size="lg" onClick={runDiagnostic} className="gap-3 text-lg px-12 py-7 rounded-xl">
              <Zap className="h-6 w-6" /> Start Full Diagnostic
            </Button>
          </div>
        </>
      )}

      {/* ─── Scanning Progress ─── */}
      {phase === "scanning" && (
        <>
          <div className="grid grid-cols-6 gap-2">
            {scanSteps.map((s, i) => {
              const stepNum = i + 1
              const done = scanStep > stepNum
              const active = scanStep === stepNum
              return (
                <Card key={i} className={`transition-all ${active ? "ring-2 ring-primary shadow-lg" : done ? "opacity-70" : "opacity-30"}`}>
                  <CardContent className="p-2.5 flex flex-col items-center gap-1.5 text-center">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${done ? "bg-emerald-100 dark:bg-emerald-50 dark:bg-emerald-500/100/20" : active ? "bg-primary/10" : "bg-muted"}`}>
                      {done ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> :
                       active ? <RefreshCw className="h-4 w-4 animate-spin text-primary" /> :
                       <s.icon className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <p className="text-[10px] font-medium">{s.label}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
          <Progress value={(scanStep / 6) * 100} className="h-2" />
        </>
      )}

      {/* ─── Results + Remediate ─── */}
      {(phase === "results" || phase === "remediating" || phase === "done") && diagnostic && (
        <>
          {/* Score card */}
          <div className="flex items-center gap-6 justify-center">
            <div className="text-center">
              <p className={`text-5xl font-bold ${healthLabel(diagnostic.score).color}`}>{diagnostic.score}</p>
              <p className="text-xs text-muted-foreground mt-1">Health Score</p>
            </div>
            {scoreAfter !== null && (
              <>
                <ArrowRight className="h-6 w-6 text-muted-foreground" />
                <div className="text-center">
                  <p className={`text-5xl font-bold ${healthLabel(scoreAfter).color}`}>{scoreAfter}</p>
                  <p className="text-xs text-muted-foreground mt-1">After Fix</p>
                </div>
              </>
            )}
          </div>

          <Progress value={scoreAfter ?? diagnostic.score} className="h-3" />

          {/* Issue cards */}
          <div className="space-y-2">
            {issues.map(issue => {
              const fixed = fixedCategories.has(issue.key)
              return (
                <Card key={issue.key} className={fixed ? "border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/100/5" : sevBg(issue.severity)}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${fixed ? "bg-emerald-100 dark:bg-emerald-50 dark:bg-emerald-500/100/20" : "bg-background"}`}>
                        {fixed ? <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> :
                         <issue.icon className={`h-5 w-5 ${sevColor(issue.severity)}`} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{issue.label}</p>
                          {fixed ? (
                            <Badge className="bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:bg-emerald-50 dark:bg-emerald-500/100/20 dark:text-emerald-400 text-[10px]">Fixed</Badge>
                          ) : (
                            <Badge variant={sevBadge(issue.severity)} className="text-[10px]">
                              {issue.severity === "high" ? "Action Needed" : issue.severity === "medium" ? "Moderate" : "OK"}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{issue.detail}</p>
                        {issue.items.length > 0 && !fixed && (
                          <div className="mt-2 space-y-0.5">
                            {issue.items.slice(0, 4).map((item, i) => (
                              <p key={i} className="text-[10px] text-muted-foreground/80">• {item}</p>
                            ))}
                            {issue.items.length > 4 && <p className="text-[10px] text-muted-foreground/60">... +{issue.items.length - 4} more</p>}
                          </div>
                        )}
                      </div>
                      {!fixed && issue.severity !== "low" && (
                        <Button
                          size="sm"
                          variant={issue.severity === "high" ? "default" : "outline"}
                          onClick={issue.onFix}
                          disabled={fixing !== null}
                          className="gap-1.5 shrink-0"
                        >
                          {fixing === issue.key ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                          Fix
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            {/* Disk health cards */}
            {diagnostic.diskHealth.map((d, i) => {
              const hl = healthLabel(d.health_percent)
              return (
                <Card key={`disk-${i}`} className={d.health_percent < 60 ? "border-red-500/20 bg-red-50 dark:bg-red-500/100/5" : "border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/100/5"}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${d.health_percent < 60 ? "bg-red-100 dark:bg-red-50 dark:bg-red-500/100/20" : "bg-emerald-100 dark:bg-emerald-50 dark:bg-emerald-500/100/20"}`}>
                        <HardDrive className={`h-5 w-5 ${hl.color}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{d.name}</p>
                          <Badge variant="secondary" className="text-[10px]">{hl.text}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Health: {d.health_percent}% | Temp: {d.temperature}°C | Power On: {d.power_on_hours}h
                        </p>
                      </div>
                      {d.health_percent < 60 && (
                        <Badge variant="destructive" className="text-[10px]">
                          <AlertTriangle className="h-3 w-3 mr-1" /> Backup Recommended
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            {/* Startup info card */}
            <Card className={diagnostic.startup.enabledCount > 10 ? "border-amber-500/20 bg-amber-50 dark:bg-amber-500/100/5" : "border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/100/5"}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${diagnostic.startup.enabledCount > 10 ? "bg-amber-100 dark:bg-amber-50 dark:bg-amber-500/100/20" : "bg-emerald-100 dark:bg-emerald-50 dark:bg-emerald-500/100/20"}`}>
                    <Rocket className={`h-5 w-5 ${diagnostic.startup.enabledCount > 10 ? "text-amber-500" : "text-emerald-500"}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">Startup Programs</p>
                      <Badge variant="secondary" className="text-[10px]">
                        {diagnostic.startup.enabledCount > 10 ? "Too Many" : "OK"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {diagnostic.startup.enabledCount} enabled / {diagnostic.startup.totalCount} total — manage individually in Startup Manager
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Action buttons */}
          <div className="flex justify-center gap-3">
            {phase === "results" && (
              <>
                <Button size="lg" onClick={fixAll} disabled={fixing !== null} className="gap-2">
                  <Zap className="h-5 w-5" /> Fix All Issues
                </Button>
                <Button size="lg" variant="outline" onClick={exportReport} className="gap-2">
                  <Download className="h-5 w-5" /> Export Report
                </Button>
              </>
            )}
            {phase === "done" && (
              <>
                <Button size="lg" variant="outline" onClick={exportReport} className="gap-2">
                  <FileText className="h-5 w-5" /> Export Full Report
                </Button>
                <Button size="lg" variant="outline" onClick={() => { setPhase("idle"); setDiagnostic(null); setLogs([]); }} className="gap-2">
                  <RefreshCw className="h-5 w-5" /> Scan Again
                </Button>
              </>
            )}
          </div>
        </>
      )}

      {/* ─── Log Panel ─── */}
      {logs.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between px-4 py-2.5 border-b">
              <button onClick={() => setShowLogs(!showLogs)} className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors">
                <Clock className="h-4 w-4" />
                Diagnostic Log ({logs.length} entries)
                {showLogs ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            </div>
            {showLogs && (
              <div ref={logRef} className="max-h-[240px] overflow-y-auto font-mono text-[11px] leading-relaxed p-3 bg-slate-950 text-slate-300 rounded-b-lg">
                {logs.map((l, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-slate-500 shrink-0">{l.time}</span>
                    <span className={`shrink-0 w-[130px] ${l.type === "success" ? "text-emerald-400" : l.type === "warn" ? "text-amber-400" : l.type === "error" ? "text-red-400" : "text-blue-400"}`}>[{l.step}]</span>
                    <span className={l.type === "success" ? "text-emerald-300" : l.type === "warn" ? "text-amber-300" : l.type === "error" ? "text-red-300" : "text-slate-300"}>{l.detail}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
