import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Zap, RefreshCw, Trash2, Shield, Database, Rocket, Download, Clock, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react"
import { useState, useRef } from "react"
import { invoke } from "@tauri-apps/api/core"

interface OptimizeResult {
  junk_cleaned_mb: number; privacy_traces: number; registry_issues: number
  startup_optimized: number; total_score_before: number; total_score_after: number
}

interface LogEntry {
  time: string
  step: string
  detail: string
  type: "info" | "success" | "warn"
}

function timestamp() {
  const d = new Date()
  return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

export default function OneClickPage() {
  const [isRunning, setIsRunning] = useState(false)
  const [result, setResult] = useState<OptimizeResult | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [showLogs, setShowLogs] = useState(true)
  const [currentStep, setCurrentStep] = useState(0)
  const logRef = useRef<HTMLDivElement>(null)

  function addLog(step: string, detail: string, type: LogEntry["type"] = "info") {
    setLogs(prev => [...prev, { time: timestamp(), step, detail, type }])
    setTimeout(() => logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" }), 50)
  }

  async function run() {
    setIsRunning(true)
    setResult(null)
    setLogs([])
    setShowLogs(true)
    setCurrentStep(0)

    addLog("Start", "One-Click Optimization started", "info")

    // Step 1: Junk scan + clean
    setCurrentStep(1)
    addLog("Junk Cleaner", "Scanning temporary files, caches, logs...", "info")
    try {
      const junk = await invoke<{ categories: { id: string; name: string; files_count: number; size_mb: number }[] }>("scan_junk_files")
      const totalMb = junk.categories.reduce((s, c) => s + c.size_mb, 0)
      const totalFiles = junk.categories.reduce((s, c) => s + c.files_count, 0)
      addLog("Junk Cleaner", `Found ${totalFiles.toLocaleString()} junk files (${totalMb} MB)`, "info")
      for (const cat of junk.categories) {
        if (cat.files_count > 0) addLog("Junk Cleaner", `  ${cat.name}: ${cat.files_count} files (${cat.size_mb} MB)`, "info")
      }
      const ids = junk.categories.map(c => c.id)
      await invoke("clean_junk_files", { categoryIds: ids })
      addLog("Junk Cleaner", `Cleaned ${totalMb} MB of junk files ✓`, "success")
    } catch (e) { addLog("Junk Cleaner", `Error: ${e}`, "warn") }

    // Step 2: Privacy traces
    setCurrentStep(2)
    addLog("Privacy Eraser", "Scanning privacy traces, cookies, history...", "info")
    try {
      const privacy = await invoke<{ categories: { id: string; name: string; items_count: number }[] }>("scan_privacy_traces")
      const totalTraces = privacy.categories.reduce((s, c) => s + c.items_count, 0)
      for (const cat of privacy.categories) {
        if (cat.items_count > 0) addLog("Privacy Eraser", `  ${cat.name}: ${cat.items_count} traces`, "info")
      }
      const ids = privacy.categories.map(c => c.id)
      await invoke("clean_privacy_traces", { categoryIds: ids })
      addLog("Privacy Eraser", `Cleaned ${totalTraces} privacy traces ✓`, "success")
    } catch (e) { addLog("Privacy Eraser", `Error: ${e}`, "warn") }

    // Step 3: Registry
    setCurrentStep(3)
    addLog("Registry Cleaner", "Scanning registry for invalid entries...", "info")
    try {
      const issues = await invoke<{ id: string; description: string }[]>("scan_registry_issues")
      addLog("Registry Cleaner", `Found ${issues.length} registry issues`, issues.length > 20 ? "warn" : "info")
    } catch (e) { addLog("Registry Cleaner", `Error: ${e}`, "warn") }

    // Step 4: Startup audit
    setCurrentStep(4)
    addLog("Startup Manager", "Auditing startup applications...", "info")
    try {
      const items = await invoke<{ name: string; enabled: boolean }[]>("get_startup_items")
      const enabled = items.filter(i => i.enabled).length
      addLog("Startup Manager", `${enabled} startup apps enabled out of ${items.length} total`, enabled > 10 ? "warn" : "info")
    } catch (e) { addLog("Startup Manager", `Error: ${e}`, "warn") }

    // Final: run the combined optimize command for the score
    setCurrentStep(5)
    addLog("Finishing", "Calculating optimization score...", "info")
    try {
      const res = await invoke<OptimizeResult>("run_one_click_optimize")
      setResult(res)
      addLog("Complete", `Score improved: ${res.total_score_before} → ${res.total_score_after}`, "success")
      addLog("Summary", `Junk: ${res.junk_cleaned_mb} MB | Privacy: ${res.privacy_traces} traces | Registry: ${res.registry_issues} issues | Startup: ${res.startup_optimized} apps`, "success")
    } catch (e) {
      addLog("Error", `Optimization failed: ${e}`, "warn")
    }

    setIsRunning(false)
  }

  function exportLog() {
    const lines = [
      `SystemPro One-Click Optimizer — Log Export`,
      `Date: ${new Date().toLocaleString()}`,
      `${"─".repeat(60)}`,
      "",
      ...logs.map(l => `[${l.time}] [${l.step}] ${l.detail}`),
      "",
      `${"─".repeat(60)}`,
    ]
    if (result) {
      lines.push(
        `Results:`,
        `  Junk Cleaned: ${result.junk_cleaned_mb} MB`,
        `  Privacy Traces Cleaned: ${result.privacy_traces}`,
        `  Registry Issues Found: ${result.registry_issues}`,
        `  Startup Apps Active: ${result.startup_optimized}`,
        `  Score: ${result.total_score_before} → ${result.total_score_after}`,
      )
    }
    const blob = new Blob([lines.join("\n")], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `systempro-optimize-log-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const steps = [
    { label: "Junk Cleaner", icon: Trash2, color: "blue" },
    { label: "Privacy Eraser", icon: Shield, color: "purple" },
    { label: "Registry Scan", icon: Database, color: "amber" },
    { label: "Startup Audit", icon: Rocket, color: "emerald" },
  ]

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">One-Click Optimizer</h1>
        <p className="text-sm text-muted-foreground mt-1">Scan and optimize your entire system in one click</p>
      </div>

      {/* What it does */}
      {!result && !isRunning && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-blue-800 mb-2">This tool performs 4 optimizations sequentially:</p>
            <div className="grid grid-cols-4 gap-3">
              {steps.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-blue-700">
                  <s.icon className="h-3.5 w-3.5" />
                  <span>{i + 1}. {s.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress Steps */}
      {isRunning && (
        <div className="grid grid-cols-4 gap-3">
          {steps.map((s, i) => {
            const stepNum = i + 1
            const done = currentStep > stepNum
            const active = currentStep === stepNum
            return (
              <Card key={i} className={active ? "ring-2 ring-primary" : done ? "opacity-70" : "opacity-40"}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${done ? "bg-emerald-100" : active ? `bg-${s.color}-100` : "bg-muted"}`}>
                    {done ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> :
                     active ? <RefreshCw className="h-4 w-4 animate-spin text-primary" /> :
                     <s.icon className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div>
                    <p className="text-xs font-medium">{s.label}</p>
                    <p className="text-[10px] text-muted-foreground">{done ? "Done" : active ? "Running..." : "Pending"}</p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Start Button */}
      <div className="flex justify-center">
        <Button size="lg" onClick={run} disabled={isRunning} className="gap-3 text-lg px-12 py-7 rounded-xl">
          {isRunning ? <RefreshCw className="h-6 w-6 animate-spin" /> : <Zap className="h-6 w-6" />}
          {isRunning ? "Optimizing..." : result ? "Optimize Again" : "Optimize Now"}
        </Button>
      </div>

      {/* Results */}
      {result && (
        <>
          <div className="flex justify-center gap-8 items-center">
            <div className="text-center">
              <p className="text-4xl font-bold text-red-500">{result.total_score_before}</p>
              <p className="text-xs text-muted-foreground">Before</p>
            </div>
            <span className="text-2xl text-muted-foreground">→</span>
            <div className="text-center">
              <p className="text-4xl font-bold text-emerald-500">{result.total_score_after}</p>
              <p className="text-xs text-muted-foreground">After</p>
            </div>
          </div>

          <Progress value={result.total_score_after} className="h-3" indicatorClassName="bg-emerald-500" />

          <div className="grid grid-cols-4 gap-4">
            {[
              { icon: Trash2, color: "blue", value: `${result.junk_cleaned_mb} MB`, label: "Junk Cleaned" },
              { icon: Shield, color: "purple", value: `${result.privacy_traces}`, label: "Privacy Traces" },
              { icon: Database, color: "amber", value: `${result.registry_issues}`, label: "Registry Issues" },
              { icon: Rocket, color: "emerald", value: `${result.startup_optimized}`, label: "Startup Items" },
            ].map((s, i) => (
              <Card key={i}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg bg-${s.color}-50 flex items-center justify-center`}>
                    <s.icon className={`h-5 w-5 text-${s.color}-600`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Log Panel */}
      {logs.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between px-4 py-2.5 border-b">
              <button onClick={() => setShowLogs(!showLogs)} className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors">
                <Clock className="h-4 w-4" />
                Optimization Log ({logs.length} entries)
                {showLogs ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              <Button variant="outline" size="sm" onClick={exportLog} className="gap-1.5 text-xs h-7">
                <Download className="h-3.5 w-3.5" /> Export Log
              </Button>
            </div>
            {showLogs && (
              <div ref={logRef} className="max-h-[280px] overflow-y-auto font-mono text-[11px] leading-relaxed p-3 bg-slate-950 text-slate-300">
                {logs.map((l, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-slate-500 shrink-0">{l.time}</span>
                    <span className={`shrink-0 w-[120px] ${l.type === "success" ? "text-emerald-400" : l.type === "warn" ? "text-amber-400" : "text-blue-400"}`}>[{l.step}]</span>
                    <span className={l.type === "success" ? "text-emerald-300" : l.type === "warn" ? "text-amber-300" : "text-slate-300"}>{l.detail}</span>
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
