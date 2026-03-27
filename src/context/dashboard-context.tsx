import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react"
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

  function logStep(step: AnalysisStep) {
    setCurrentStep(step.label)
    setAnalysisPercent(step.percent)
    setAnalysisLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${step.label}`])
  }

  const analyzeSystem = useCallback(async () => {
    if (running.current) return
    running.current = true
    setIsAnalyzing(true)
    setAnalysisComplete(false)
    setAnalysisPercent(0)
    setAnalysisLog([])
    setCurrentStep("")

    try {
      // 1: System info
      logStep(ANALYSIS_STEPS[0])
      try {
        const data = await invoke<SystemOverview>("get_system_overview")
        setOverview(data)
        setAnalysisLog(prev => [...prev, `  ✓ ${data.cpu_name} | ${data.ram_total_gb.toFixed(1)} GB RAM`])
      } catch (e) { setAnalysisLog(prev => [...prev, `  ⚠ System info: ${e}`]) }

      // 2: Junk files
      logStep(ANALYSIS_STEPS[1])
      try {
        const junk = await invoke<JunkScanResult>("scan_junk_files")
        setJunkResult(junk)
        const mb = junk.categories.reduce((s, c) => s + c.size_mb, 0)
        setAnalysisLog(prev => [...prev, `  ✓ ${mb.toFixed(0)} MB junk across ${junk.categories.length} categories`])
      } catch (e) { setAnalysisLog(prev => [...prev, `  ⚠ Junk scan: ${e}`]) }

      // 3: Startup
      logStep(ANALYSIS_STEPS[2])
      try {
        const items = await invoke<StartupItem[]>("get_startup_items")
        setStartupItems(items)
        setAnalysisLog(prev => [...prev, `  ✓ ${items.filter(s => s.enabled).length} enabled / ${items.length} total`])
      } catch (e) { setAnalysisLog(prev => [...prev, `  ⚠ Startup: ${e}`]) }

      // 4: Privacy
      logStep(ANALYSIS_STEPS[3])
      try {
        const p = await invoke<PrivacyScanResult>("scan_privacy_traces")
        setPrivacyResult(p)
        setAnalysisLog(prev => [...prev, `  ✓ ${p.categories.reduce((s, c) => s + c.items_count, 0)} traces`])
      } catch (e) { setAnalysisLog(prev => [...prev, `  ⚠ Privacy: ${e}`]) }

      // 5: Network
      logStep(ANALYSIS_STEPS[4])
      try {
        const net = await invoke<NetworkSpeed[]>("get_network_speed")
        setNetworkSpeeds(net)
        setAnalysisLog(prev => [...prev, `  ✓ ${net.length} adapter${net.length !== 1 ? "s" : ""}`])
      } catch (e) { setAnalysisLog(prev => [...prev, `  ⚠ Network: ${e}`]) }

      // 6: Disk health
      logStep(ANALYSIS_STEPS[5])
      try {
        const disks = await invoke<DiskHealthInfo[]>("get_smart_health")
        setFeatureSnap(prev => ({ ...prev, diskHealth: disks }))
        setAnalysisLog(prev => [...prev, `  ✓ ${disks.length} disk${disks.length !== 1 ? "s" : ""}`])
      } catch (e) { setAnalysisLog(prev => [...prev, `  ⚠ Disk health: ${e}`]) }

      // 7: Security
      logStep(ANALYSIS_STEPS[6])
      try {
        const [def, fw] = await Promise.allSettled([
          invoke<DefenderInfo>("get_defender_status"),
          invoke<FirewallRule[]>("get_firewall_rules"),
        ])
        const defender = def.status === "fulfilled" ? def.value : null
        const fwCount = fw.status === "fulfilled" ? fw.value.filter(r => r.enabled).length : 0
        setFeatureSnap(prev => ({ ...prev, defender, firewallCount: fwCount }))
        setAnalysisLog(prev => [...prev, `  ✓ Defender: ${defender?.real_time_protection ? "Active" : "Off"} | Firewall: ${fwCount} rules`])
      } catch (e) { setAnalysisLog(prev => [...prev, `  ⚠ Security: ${e}`]) }

      // 8: Software
      logStep(ANALYSIS_STEPS[7])
      try {
        const sw = await invoke<SoftwareItem[]>("check_software_updates")
        const updates = sw.filter(s => s.needs_update).length
        setFeatureSnap(prev => ({ ...prev, softwareUpdates: updates }))
        setAnalysisLog(prev => [...prev, `  ✓ ${sw.length} software, ${updates} need updates`])
      } catch (e) { setAnalysisLog(prev => [...prev, `  ⚠ Software: ${e}`]) }

      // 9: Registry
      logStep(ANALYSIS_STEPS[8])
      try {
        const reg = await invoke<{ id: string }[]>("scan_registry_issues")
        const list = Array.isArray(reg) ? reg : []
        setRegistryIssuesList(list)
        setAnalysisLog(prev => [...prev, `  ✓ Registry: ${list.length > 0 ? `${list.length} issues` : "Clean"}`])
      } catch (e) { setAnalysisLog(prev => [...prev, `  ⚠ Registry: ${e}`]) }

      // 10: Score
      logStep(ANALYSIS_STEPS[9])
      try {
        const [hRes, sRes] = await Promise.allSettled([
          invoke<HealthScore>("run_health_check"),
          invoke<OptimizationScore>("get_optimization_score"),
        ])
        if (hRes.status === "fulfilled") setHealth(hRes.value)
        if (sRes.status === "fulfilled") {
          setOptScore(sRes.value)
          setAnalysisLog(prev => [...prev, `  ✓ Score: ${sRes.value.overall_score}/100 — Grade ${sRes.value.grade}`])
        }
      } catch (e) { setAnalysisLog(prev => [...prev, `  ⚠ Score: ${e}`]) }

      // 11: Done
      logStep(ANALYSIS_STEPS[10])
      setAnalysisComplete(true)
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

    try {
      // 1. Clean Junk
      if (junkResult?.categories && junkResult.categories.length > 0) {
        setAnalysisLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Cleaning junk files...`])
        await invoke("clean_junk_files", { categoryIds: junkResult.categories.map(c => c.id) }).catch(() => {})
      }
      
      // 2. Clean Privacy
      if (privacyResult?.categories && privacyResult.categories.length > 0) {
        setAnalysisLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Erasing privacy traces...`])
        await invoke("clean_privacy_traces", { categoryIds: privacyResult.categories.map(c => c.id) }).catch(() => {})
      }

      // 3. Fix Registry
      if (registryIssuesList.length > 0) {
        setAnalysisLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Fixing registry issues...`])
        await invoke("backup_registry").catch(() => {})
        await invoke("clean_registry_issues", { issueIds: registryIssuesList.map(i => i.id) }).catch(() => {})
      }

      // 4. Memory (if RAM > 70%)
      if (overview && overview.ram_usage_percent > 70) {
        setAnalysisLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Optimizing memory...`])
        await invoke("optimize_memory").catch(() => {})
      }

      setAnalysisLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Optimization complete! Re-analyzing system...`])
      
      // Allow analyzeSystem to run contextually
      running.current = false
      await analyzeSystem()
    } catch (e) {
      setAnalysisLog(prev => [...prev, `❌ Optimization failed: ${e}`])
      setIsOptimizing(false)
      running.current = false
    }
  }, [junkResult, privacyResult, registryIssuesList, overview, analyzeSystem])

  return (
    <DashboardContext.Provider value={{
      isAnalyzing, isOptimizing, analysisComplete, analysisPercent, analysisLog, currentStep,
      overview, health, junkResult, privacyResult, startupItems, networkSpeeds,
      registryIssuesList, optScore, featureSnap,
      analyzeSystem, optimizeSystem
    }}>
      {children}
    </DashboardContext.Provider>
  )
}
