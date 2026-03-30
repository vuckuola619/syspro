import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react"
import { invoke } from "@tauri-apps/api/core"

// ── Types ──

export interface SystemOverview {
  cpu_name: string; cpu_usage: number
  ram_total_gb: number; ram_used_gb: number; ram_usage_percent: number
  disks: DiskInfo[]; os_name: string; os_version: string
  hostname: string; uptime_hours: number
}
export interface DiskInfo {
  name: string; mount_point: string; total_gb: number; used_gb: number
  free_gb: number; usage_percent: number; fs_type: string
}
export interface HealthScore {
  overall: number; junk_files_mb: number; startup_items: number; privacy_traces: number
}
export interface JunkScanResult {
  categories: { id: string; name: string; files_count: number; size_mb: number }[]
}
export interface PrivacyScanResult {
  categories: { id: string; name: string; items_count: number }[]
}
export interface StartupItem { name: string; enabled: boolean }
export interface NetworkSpeed { adapter_name: string; bytes_sent: number; bytes_received: number }
export interface ScoreCategory { name: string; score: number; max_score: number; status: string }
export interface Recommendation { title: string; description: string; impact: string; category: string; auto_fixable: boolean }
export interface OptimizationScore { overall_score: number; grade: string; categories: ScoreCategory[]; recommendations: Recommendation[] }

export interface DefenderInfo {
  antivirus_enabled: boolean; real_time_protection: boolean; definition_date: string
  definition_version: string; last_scan_time: string; engine_version: string
}
export interface FirewallRule {
  name: string; display_name: string; direction: string; action: string; enabled: boolean; program: string; profile: string
}
export interface DiskHealthInfo {
  model: string; serial: string; status: string; temperature: string; size_gb: number
  media_type: string; read_errors: number; write_errors: number; power_on_hours: number
  wear: number; health_percent: number; attributes: { name: string; value: string; status: string }[]
}
export interface SoftwareItem {
  name: string; current_version: string; latest_version: string; publisher: string; needs_update: boolean
}

export interface FeatureSnapshot {
  defender: DefenderInfo | null
  firewallCount: number
  diskHealth: DiskHealthInfo[]
  softwareUpdates: number
}

// ── Cached Dashboard (from Rust cache.rs) ──

interface CachedDashboard {
  overview: SystemOverview | null
  junk: JunkScanResult | null
  startup: StartupItem[] | null
  privacy: PrivacyScanResult | null
  network: NetworkSpeed[] | null
  disk_health: DiskHealthInfo[] | null
  defender: DefenderInfo | null
  firewall_rules: FirewallRule[] | null
  software_updates: number | null
  registry_count: number | null
  health: HealthScore | null
}

// ── Analysis step definition ──

export interface AnalysisStep { id: string; label: string; percent: number }

export const ANALYSIS_STEPS: AnalysisStep[] = [
  { id: "system",   label: "Checking system info...",        percent: 10 },
  { id: "junk",     label: "Scanning junk files...",         percent: 20 },
  { id: "startup",  label: "Checking startup items...",      percent: 30 },
  { id: "privacy",  label: "Scanning privacy traces...",     percent: 40 },
  { id: "network",  label: "Checking network...",            percent: 50 },
  { id: "disk",     label: "Analyzing disk health...",       percent: 60 },
  { id: "security", label: "Checking security...",           percent: 70 },
  { id: "software", label: "Scanning software updates...",   percent: 80 },
  { id: "registry", label: "Scanning registry...",           percent: 90 },
  { id: "score",    label: "Computing optimization score...", percent: 95 },
  { id: "done",     label: "Analysis complete!",             percent: 100 },
]

// ── Context shape ──

interface DashboardContextType {
  // Analysis progress
  isAnalyzing: boolean
  isOptimizing: boolean
  analysisComplete: boolean
  analysisPercent: number
  analysisLog: string[]
  currentStep: string
  isCachedLoad: boolean

  // Data
  overview: SystemOverview | null
  health: HealthScore
  junkResult: JunkScanResult | null
  privacyResult: PrivacyScanResult | null
  startupItems: StartupItem[]
  networkSpeeds: NetworkSpeed[]
  registryIssuesList: { id: string }[]
  optScore: OptimizationScore | null
  featureSnap: FeatureSnapshot

  // Actions
  analyzeSystem: () => Promise<void>
  optimizeSystem: () => Promise<void>
}

const DashboardContext = createContext<DashboardContextType | null>(null)

export function useDashboard() {
  const ctx = useContext(DashboardContext)
  if (!ctx) throw new Error("useDashboard must be used inside DashboardProvider")
  return ctx
}

// ── Provider ──

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [analysisComplete, setAnalysisComplete] = useState(false)
  const [analysisPercent, setAnalysisPercent] = useState(0)
  const [analysisLog, setAnalysisLog] = useState<string[]>([])
  const [currentStep, setCurrentStep] = useState("")
  const [isCachedLoad, setIsCachedLoad] = useState(false)

  const [overview, setOverview] = useState<SystemOverview | null>(null)
  const [health, setHealth] = useState<HealthScore>({ overall: 0, junk_files_mb: 0, startup_items: 0, privacy_traces: 0 })
  const [junkResult, setJunkResult] = useState<JunkScanResult | null>(null)
  const [privacyResult, setPrivacyResult] = useState<PrivacyScanResult | null>(null)
  const [startupItems, setStartupItems] = useState<StartupItem[]>([])
  const [networkSpeeds, setNetworkSpeeds] = useState<NetworkSpeed[]>([])
  const [registryIssuesList, setRegistryIssuesList] = useState<{ id: string }[]>([])
  const [optScore, setOptScore] = useState<OptimizationScore | null>(null)
  const [featureSnap, setFeatureSnap] = useState<FeatureSnapshot>({ defender: null, firewallCount: 0, diskHealth: [], softwareUpdates: 0 })

  const running = useRef(false)
  const cacheLoaded = useRef(false)

  function logStep(step: AnalysisStep) {
    setCurrentStep(step.label)
    setAnalysisPercent(step.percent)
    setAnalysisLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${step.label}`])
  }

  // ── Load cached data on mount for instant paint ──
  useEffect(() => {
    if (cacheLoaded.current) return
    cacheLoaded.current = true
    ;(async () => {
      try {
        const cached = await invoke<CachedDashboard | null>("get_cached_dashboard")
        if (!cached) return
        let hasData = false
        if (cached.overview) { setOverview(cached.overview); hasData = true }
        if (cached.junk) { setJunkResult(cached.junk); hasData = true }
        if (cached.startup) { setStartupItems(cached.startup); hasData = true }
        if (cached.privacy) { setPrivacyResult(cached.privacy); hasData = true }
        if (cached.network) { setNetworkSpeeds(cached.network); hasData = true }
        if (cached.disk_health) { setFeatureSnap(prev => ({ ...prev, diskHealth: cached.disk_health! })); hasData = true }
        if (cached.defender) { setFeatureSnap(prev => ({ ...prev, defender: cached.defender })); hasData = true }
        if (cached.firewall_rules) { setFeatureSnap(prev => ({ ...prev, firewallCount: cached.firewall_rules!.filter((r: FirewallRule) => r.enabled).length })); hasData = true }
        if (cached.software_updates != null) { setFeatureSnap(prev => ({ ...prev, softwareUpdates: cached.software_updates! })); hasData = true }
        if (cached.health) { setHealth(cached.health); hasData = true }
        if (hasData) {
          setIsCachedLoad(true)
          setAnalysisComplete(true)
        }
      } catch { /* first run, no cache */ }
    })()
  }, [])

  // ── Full analysis using batch_invoke (single IPC roundtrip) ──
  const analyzeSystem = useCallback(async () => {
    if (running.current) return
    running.current = true
    setIsAnalyzing(true)
    setAnalysisComplete(false)
    setAnalysisPercent(0)
    setAnalysisLog([])
    setCurrentStep("")
    setIsCachedLoad(false)

    try {
      logStep(ANALYSIS_STEPS[0])
      setAnalysisLog(prev => [...prev, `  ⚡ Using batch pipeline (single roundtrip)`])

      // Single IPC call — all commands run in parallel on Rust side
      const results = await invoke<Record<string, unknown>>("batch_invoke", {
        commands: [
          "get_system_overview", "scan_junk_files", "get_startup_items",
          "scan_privacy_traces", "get_network_speed", "get_smart_health",
          "get_defender_status", "get_firewall_rules", "check_software_updates",
          "scan_registry_issues", "run_health_check", "get_optimization_score"
        ]
      })

      // Apply results step by step with progress updates
      logStep(ANALYSIS_STEPS[0])
      if (results.get_system_overview) {
        const data = results.get_system_overview as SystemOverview
        setOverview(data)
        setAnalysisLog(prev => [...prev, `  ✓ ${data.cpu_name} | ${data.ram_total_gb?.toFixed(1)} GB RAM`])
      }

      logStep(ANALYSIS_STEPS[1])
      if (results.scan_junk_files) {
        const junk = results.scan_junk_files as JunkScanResult
        setJunkResult(junk)
        const mb = junk.categories?.reduce((s, c) => s + c.size_mb, 0) ?? 0
        setAnalysisLog(prev => [...prev, `  ✓ ${mb.toFixed(0)} MB junk across ${junk.categories?.length ?? 0} categories`])
      }

      logStep(ANALYSIS_STEPS[2])
      if (results.get_startup_items) {
        const items = results.get_startup_items as StartupItem[]
        setStartupItems(items)
        setAnalysisLog(prev => [...prev, `  ✓ ${items.filter(s => s.enabled).length} enabled / ${items.length} total`])
      }

      logStep(ANALYSIS_STEPS[3])
      if (results.scan_privacy_traces) {
        const p = results.scan_privacy_traces as PrivacyScanResult
        setPrivacyResult(p)
        setAnalysisLog(prev => [...prev, `  ✓ ${p.categories?.reduce((s, c) => s + c.items_count, 0) ?? 0} traces`])
      }

      logStep(ANALYSIS_STEPS[4])
      if (results.get_network_speed) {
        const net = results.get_network_speed as NetworkSpeed[]
        setNetworkSpeeds(net)
        setAnalysisLog(prev => [...prev, `  ✓ ${net.length} adapter${net.length !== 1 ? "s" : ""}`])
      }

      logStep(ANALYSIS_STEPS[5])
      if (results.get_smart_health) {
        const disks = results.get_smart_health as DiskHealthInfo[]
        setFeatureSnap(prev => ({ ...prev, diskHealth: disks }))
        setAnalysisLog(prev => [...prev, `  ✓ ${disks.length} disk${disks.length !== 1 ? "s" : ""}`])
      }

      logStep(ANALYSIS_STEPS[6])
      const defender = results.get_defender_status as DefenderInfo | null
      const fwRules = results.get_firewall_rules as FirewallRule[] | null
      const fwCount = fwRules?.filter(r => r.enabled).length ?? 0
      setFeatureSnap(prev => ({ ...prev, defender: defender ?? null, firewallCount: fwCount }))
      setAnalysisLog(prev => [...prev, `  ✓ Defender: ${defender?.real_time_protection ? "Active" : "Off"} | Firewall: ${fwCount} rules`])

      logStep(ANALYSIS_STEPS[7])
      if (results.check_software_updates) {
        const sw = results.check_software_updates as { needs_update: boolean }[]
        const updates = Array.isArray(sw) ? sw.filter(s => s.needs_update).length : 0
        setFeatureSnap(prev => ({ ...prev, softwareUpdates: updates }))
        setAnalysisLog(prev => [...prev, `  ✓ ${Array.isArray(sw) ? sw.length : 0} software, ${updates} need updates`])
      }

      logStep(ANALYSIS_STEPS[8])
      if (results.scan_registry_issues) {
        const reg = results.scan_registry_issues as { id: string }[]
        const list = Array.isArray(reg) ? reg : []
        setRegistryIssuesList(list)
        setAnalysisLog(prev => [...prev, `  ✓ Registry: ${list.length > 0 ? `${list.length} issues` : "Clean"}`])
      }

      logStep(ANALYSIS_STEPS[9])
      if (results.run_health_check) {
        setHealth(results.run_health_check as HealthScore)
      }
      if (results.get_optimization_score) {
        const raw = results.get_optimization_score as OptimizationScore
        // Ensure arrays are always arrays even if Rust returned unexpected shape
        const score: OptimizationScore = {
          ...raw,
          overall_score: raw.overall_score ?? 0,
          grade: raw.grade ?? "F",
          categories: Array.isArray(raw.categories) ? raw.categories : [],
          recommendations: Array.isArray(raw.recommendations) ? raw.recommendations : [],
        }
        setOptScore(score)
        setAnalysisLog(prev => [...prev, `  ✓ Score: ${score.overall_score}/100 — Grade ${score.grade}`])
      }

      // Done — only mark complete if we got at least the system overview
      logStep(ANALYSIS_STEPS[10])
      setAnalysisComplete(!!(results.get_system_overview))
    } catch (e) {
      setAnalysisLog(prev => [...prev, `❌ Analysis failed: ${e}`])
    } finally {
      setIsAnalyzing(false)
      running.current = false
    }
  }, [])

  const optimizeSystem = useCallback(async () => {
    if (running.current) return
    running.current = true
    setIsOptimizing(true)
    setAnalysisLog([])
    setAnalysisPercent(5)
    setCurrentStep("Starting optimization...")

    try {
      // 1. Clean Junk
      if (junkResult?.categories && Array.isArray(junkResult.categories) && junkResult.categories.length > 0) {
        setCurrentStep("Cleaning junk files...")
        setAnalysisPercent(20)
        setAnalysisLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Cleaning junk files...`])
        await invoke("clean_junk_files", { categoryIds: junkResult.categories.map(c => c.id) }).catch(() => {})
      }
      
      // 2. Clean Privacy
      if (privacyResult?.categories && Array.isArray(privacyResult.categories) && privacyResult.categories.length > 0) {
        setCurrentStep("Erasing privacy traces...")
        setAnalysisPercent(40)
        setAnalysisLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Erasing privacy traces...`])
        await invoke("clean_privacy_traces", { categoryIds: privacyResult.categories.map(c => c.id) }).catch(() => {})
      }

      // 3. Fix Registry
      if (Array.isArray(registryIssuesList) && registryIssuesList.length > 0) {
        setCurrentStep("Fixing registry issues...")
        setAnalysisPercent(60)
        setAnalysisLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Fixing registry issues...`])
        await invoke("backup_registry").catch(() => {})
        await invoke("clean_registry_issues", { issueIds: registryIssuesList.map(i => i.id) }).catch(() => {})
      }

      // 4. Memory (if RAM > 70%)
      if (overview && (overview.ram_usage_percent ?? 0) > 70) {
        setCurrentStep("Optimizing memory...")
        setAnalysisPercent(75)
        setAnalysisLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Optimizing memory...`])
        await invoke("optimize_memory").catch(() => {})
      }

      // 5. Quick targeted refresh — only the fast commands (skip SMART/software which hang)
      setCurrentStep("Refreshing results...")
      setAnalysisPercent(85)
      setAnalysisLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Refreshing system data...`])
      const refreshCmds = ["get_system_overview", "scan_junk_files", "scan_privacy_traces",
                           "scan_registry_issues", "run_health_check", "get_optimization_score"]
      const refreshResult = await invoke<Record<string, unknown>>("batch_invoke", { commands: refreshCmds }).catch(() => ({}))
      const refreshed = (refreshResult ?? {}) as Record<string, unknown>

      // Apply refreshed data
      if (refreshed["get_system_overview"]) setOverview(refreshed["get_system_overview"] as SystemOverview)
      if (refreshed["scan_junk_files"]) {
        const raw = refreshed["scan_junk_files"] as JunkScanResult
        setJunkResult({ ...raw, categories: Array.isArray(raw.categories) ? raw.categories : [] })
      }
      if (refreshed["scan_privacy_traces"]) {
        const raw = refreshed["scan_privacy_traces"] as PrivacyScanResult
        setPrivacyResult({ ...raw, categories: Array.isArray(raw.categories) ? raw.categories : [] })
      }
      if (refreshed["scan_registry_issues"]) {
        const issues = refreshed["scan_registry_issues"] as { id: string }[]
        setRegistryIssuesList(Array.isArray(issues) ? issues : [])
      }
      if (refreshed["run_health_check"]) setHealth(refreshed["run_health_check"] as HealthScore)
      if (refreshed["get_optimization_score"]) {
        const raw = refreshed["get_optimization_score"] as OptimizationScore
        setOptScore({
          ...raw,
          overall_score: raw.overall_score ?? 0,
          grade: raw.grade ?? "F",
          categories: Array.isArray(raw.categories) ? raw.categories : [],
          recommendations: Array.isArray(raw.recommendations) ? raw.recommendations : [],
        })
      }

      setAnalysisPercent(100)
      setCurrentStep("Optimization complete!")
      setAnalysisLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✅ Optimization complete!`])
    } catch (e) {
      setAnalysisLog(prev => [...prev, `❌ Optimization failed: ${e}`])
    } finally {
      setIsOptimizing(false)
      running.current = false
    }
  }, [junkResult, privacyResult, registryIssuesList, overview])

  return (
    <DashboardContext.Provider value={{
      isAnalyzing, isOptimizing, analysisComplete, analysisPercent, analysisLog, currentStep,
      isCachedLoad,
      overview, health, junkResult, privacyResult, startupItems, networkSpeeds,
      registryIssuesList, optScore, featureSnap,
      analyzeSystem, optimizeSystem
    }}>
      {children}
    </DashboardContext.Provider>
  )
}
