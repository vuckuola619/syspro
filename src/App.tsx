import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AppLayout } from "@/components/layout/app-layout"
import { useState, useEffect, Suspense, lazy, Component, type ReactNode, type ErrorInfo } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { invoke } from "@tauri-apps/api/core"
import { openUrl } from "@tauri-apps/plugin-opener"
import { AIProvider } from "@/context/ai-context"
import { DashboardProvider } from "@/context/dashboard-context"
import { PolicyProvider } from "@/context/policy-context"
import { FloatingAIChat } from "@/components/floating-ai-chat"
import { CommandPalette } from "@/components/command-palette"

// ─── Lazy-loaded pages (code-split for faster startup) ───
const DashboardPage = lazy(() => import("@/pages/dashboard"))
const JunkCleanerPage = lazy(() => import("@/pages/junk-cleaner"))
const RegistryCleanerPage = lazy(() => import("@/pages/registry-cleaner"))
const StartupManagerPage = lazy(() => import("@/pages/startup-manager"))
const PerformancePage = lazy(() => import("@/pages/performance"))
const PrivacyPage = lazy(() => import("@/pages/privacy"))
const SoftwareUpdaterPage = lazy(() => import("@/pages/software-updater"))
const DriverUpdaterPage = lazy(() => import("@/pages/driver-updater"))
const FileShredderPage = lazy(() => import("@/pages/file-shredder"))
const DuplicateFinderPage = lazy(() => import("@/pages/duplicate-finder"))
const SystemInfoPage = lazy(() => import("@/pages/system-info"))
const SettingsPage = lazy(() => import("@/pages/settings"))
const LiveMonitorPage = lazy(() => import("@/pages/live-monitor"))
const DiskAnalyzerPage = lazy(() => import("@/pages/disk-analyzer"))
const AppUninstallerPage = lazy(() => import("@/pages/app-uninstaller"))
const ScheduledCleanPage = lazy(() => import("@/pages/scheduled-clean"))
const DiskDefragPage = lazy(() => import("@/pages/disk-defrag"))
const InternetBoosterPage = lazy(() => import("@/pages/internet-booster"))
const FileSplitterPage = lazy(() => import("@/pages/file-splitter"))
const WindowsDebloaterPage = lazy(() => import("@/pages/windows-debloater"))
const PrivacyHardeningPage = lazy(() => import("@/pages/privacy-hardening"))
const RestorePointsPage = lazy(() => import("@/pages/restore-points"))
const WindowsTweaksPage = lazy(() => import("@/pages/windows-tweaks"))
const ServiceManagerPage = lazy(() => import("@/pages/service-manager"))
const EdgeManagerPage = lazy(() => import("@/pages/edge-manager"))
const NetworkMonitorPage = lazy(() => import("@/pages/network-monitor"))
const HostsEditorPage = lazy(() => import("@/pages/hosts-editor"))
const UpdateManagerPage = lazy(() => import("@/pages/update-manager"))
const FirewallManagerPage = lazy(() => import("@/pages/firewall-manager"))
const BenchmarksPage = lazy(() => import("@/pages/benchmarks"))
const TurboBoostPage = lazy(() => import("@/pages/turbo-boost"))
const SpeedMonitorPage = lazy(() => import("@/pages/speed-monitor"))
const PopupBlockerPage = lazy(() => import("@/pages/popup-blocker"))
const FileHiderPage = lazy(() => import("@/pages/file-hider"))
const PasswordGeneratorPage = lazy(() => import("@/pages/password-generator"))
const RegistryDefragPage = lazy(() => import("@/pages/registry-defrag"))
const SystemSlimmingPage = lazy(() => import("@/pages/system-slimming"))
const SpeedTestPage = lazy(() => import("@/pages/speed-test"))
const DiskHealthPage = lazy(() => import("@/pages/disk-health"))
const ExportReportPage = lazy(() => import("@/pages/export-report"))
const LargeFileFinderPage = lazy(() => import("@/pages/large-file-finder"))
const EmptyFolderScannerPage = lazy(() => import("@/pages/empty-folder-scanner"))

const SmartCleanPage = lazy(() => import("@/pages/smart-clean"))
const AppJunkPage = lazy(() => import("@/pages/app-junk"))
const BrowserExtensionsPage = lazy(() => import("@/pages/browser-extensions"))
const AntiSpywarePage = lazy(() => import("@/pages/anti-spyware"))
const DnsProtectorPage = lazy(() => import("@/pages/dns-protector"))
const AdBlockerPage = lazy(() => import("@/pages/ad-blocker"))
const LoginMonitorPage = lazy(() => import("@/pages/login-monitor"))
const FileRecoveryPage = lazy(() => import("@/pages/file-recovery"))
const CloudCleanerPage = lazy(() => import("@/pages/cloud-cleaner"))
const MultiUserPage = lazy(() => import("@/pages/multi-user"))
const RollbackHistoryPage = lazy(() => import("@/pages/rollback-history"))


// ─── Loading Skeleton ───
function PageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-7 w-48 bg-muted rounded-md" />
        <div className="h-4 w-72 bg-muted/60 rounded-md mt-2" />
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-muted/40 rounded-xl border border-border/50" />
        ))}
      </div>
      <div className="h-48 bg-muted/30 rounded-xl border border-border/50" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-32 bg-muted/30 rounded-xl border border-border/50" />
        <div className="h-32 bg-muted/30 rounded-xl border border-border/50" />
      </div>
    </div>
  )
}

// ─── Error Boundary (prevents white blank screen on render crashes) ───
interface EBState { hasError: boolean; message: string }
class PageErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { hasError: false, message: "" }
  static getDerivedStateFromError(err: Error): EBState {
    return { hasError: true, message: err?.message || String(err) }
  }
  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error("[SABI] Page render error:", err, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 gap-4">
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 max-w-md w-full text-center space-y-3">
            <p className="text-lg font-semibold text-destructive">Something went wrong</p>
            <p className="text-sm text-muted-foreground font-mono">{this.state.message}</p>
            <button
              className="text-sm underline text-muted-foreground hover:text-foreground mt-2"
              onClick={() => this.setState({ hasError: false, message: "" })}
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ─── Update Banner ───
interface AppUpdateInfo {
  current_version: string
  latest_version: string
  update_available: boolean
  release_notes: string
  download_url: string
}

function UpdateBanner({ info, onDismiss }: { info: AppUpdateInfo; onDismiss: () => void }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-blue-600 text-white px-4 py-2.5 text-sm relative">
      <div className="flex items-center justify-between max-w-screen-xl mx-auto">
        <div className="flex items-center gap-3">
          <span className="bg-white/20 rounded-full px-2 py-0.5 text-xs font-bold">NEW</span>
          <span>
            SABI <strong>v{info.latest_version}</strong> is available!
            <span className="opacity-80 ml-1">(You have v{info.current_version})</span>
          </span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="underline underline-offset-2 opacity-80 hover:opacity-100 text-xs"
          >
            {expanded ? "Hide changelog" : "View changelog"}
          </button>
        </div>
        <div className="flex items-center gap-2">
          {info.download_url && (
            <button
              onClick={() => openUrl(info.download_url)}
              className="bg-white text-blue-600 px-3 py-1 rounded-md text-xs font-semibold hover:bg-blue-50 transition-colors"
            >
              Download
            </button>
          )}
          <button
            onClick={onDismiss}
            className="opacity-60 hover:opacity-100 text-lg leading-none ml-1"
          >
            ×
          </button>
        </div>
      </div>
      {expanded && info.release_notes && (
        <div className="max-w-screen-xl mx-auto mt-2 bg-white/10 rounded-md p-3 text-xs leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
          {info.release_notes}
        </div>
      )}
    </div>
  )
}

// ─── App ───
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes cache
    },
  },
})

function App() {
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    invoke<AppUpdateInfo>("check_for_app_update")
      .then((info) => {
        if (info.update_available) setUpdateInfo(info)
      })
      .catch(() => {})
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
    <PolicyProvider>
    <AIProvider>
    <DashboardProvider>
    <BrowserRouter>
      <CommandPalette />
      {updateInfo && !dismissed && (
        <UpdateBanner info={updateInfo} onDismiss={() => setDismissed(true)} />
      )}
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><DashboardPage /></Suspense></PageErrorBoundary>} />
          <Route path="/junk-cleaner" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><JunkCleanerPage /></Suspense></PageErrorBoundary>} />
          <Route path="/registry" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><RegistryCleanerPage /></Suspense></PageErrorBoundary>} />
          <Route path="/startup" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><StartupManagerPage /></Suspense></PageErrorBoundary>} />
          <Route path="/performance" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><PerformancePage /></Suspense></PageErrorBoundary>} />
          <Route path="/privacy" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><PrivacyPage /></Suspense></PageErrorBoundary>} />
          <Route path="/software-updater" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><SoftwareUpdaterPage /></Suspense></PageErrorBoundary>} />
          <Route path="/driver-updater" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><DriverUpdaterPage /></Suspense></PageErrorBoundary>} />
          <Route path="/file-shredder" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><FileShredderPage /></Suspense></PageErrorBoundary>} />
          <Route path="/duplicate-finder" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><DuplicateFinderPage /></Suspense></PageErrorBoundary>} />
          <Route path="/system-info" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><SystemInfoPage /></Suspense></PageErrorBoundary>} />
          <Route path="/live-monitor" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><LiveMonitorPage /></Suspense></PageErrorBoundary>} />
          <Route path="/disk-analyzer" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><DiskAnalyzerPage /></Suspense></PageErrorBoundary>} />
          <Route path="/app-uninstaller" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><AppUninstallerPage /></Suspense></PageErrorBoundary>} />
          <Route path="/scheduled-clean" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><ScheduledCleanPage /></Suspense></PageErrorBoundary>} />
          <Route path="/disk-defrag" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><DiskDefragPage /></Suspense></PageErrorBoundary>} />
          <Route path="/internet-booster" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><InternetBoosterPage /></Suspense></PageErrorBoundary>} />
          <Route path="/file-splitter" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><FileSplitterPage /></Suspense></PageErrorBoundary>} />
          <Route path="/debloater" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><WindowsDebloaterPage /></Suspense></PageErrorBoundary>} />
          <Route path="/privacy-hardening" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><PrivacyHardeningPage /></Suspense></PageErrorBoundary>} />
          <Route path="/restore-points" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><RestorePointsPage /></Suspense></PageErrorBoundary>} />
          <Route path="/windows-tweaks" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><WindowsTweaksPage /></Suspense></PageErrorBoundary>} />
          <Route path="/service-manager" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><ServiceManagerPage /></Suspense></PageErrorBoundary>} />
          <Route path="/edge-manager" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><EdgeManagerPage /></Suspense></PageErrorBoundary>} />
          <Route path="/network-monitor" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><NetworkMonitorPage /></Suspense></PageErrorBoundary>} />
          <Route path="/hosts-editor" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><HostsEditorPage /></Suspense></PageErrorBoundary>} />
          <Route path="/update-manager" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><UpdateManagerPage /></Suspense></PageErrorBoundary>} />
          <Route path="/firewall-manager" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><FirewallManagerPage /></Suspense></PageErrorBoundary>} />
          <Route path="/benchmarks" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><BenchmarksPage /></Suspense></PageErrorBoundary>} />
          <Route path="/turbo-boost" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><TurboBoostPage /></Suspense></PageErrorBoundary>} />
          <Route path="/speed-monitor" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><SpeedMonitorPage /></Suspense></PageErrorBoundary>} />
          <Route path="/popup-blocker" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><PopupBlockerPage /></Suspense></PageErrorBoundary>} />
          <Route path="/file-hider" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><FileHiderPage /></Suspense></PageErrorBoundary>} />
          <Route path="/password-generator" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><PasswordGeneratorPage /></Suspense></PageErrorBoundary>} />
          <Route path="/registry-defrag" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><RegistryDefragPage /></Suspense></PageErrorBoundary>} />
          <Route path="/system-slimming" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><SystemSlimmingPage /></Suspense></PageErrorBoundary>} />
          <Route path="/speed-test" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><SpeedTestPage /></Suspense></PageErrorBoundary>} />
          <Route path="/disk-health" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><DiskHealthPage /></Suspense></PageErrorBoundary>} />
          <Route path="/export-report" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><ExportReportPage /></Suspense></PageErrorBoundary>} />
          <Route path="/large-file-finder" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><LargeFileFinderPage /></Suspense></PageErrorBoundary>} />
          <Route path="/empty-folder-scanner" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><EmptyFolderScannerPage /></Suspense></PageErrorBoundary>} />
          <Route path="/cpu-saver" element={<Navigate to="/turbo-boost" replace />} />
          <Route path="/smart-clean" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><SmartCleanPage /></Suspense></PageErrorBoundary>} />
          <Route path="/app-junk" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><AppJunkPage /></Suspense></PageErrorBoundary>} />
          <Route path="/browser-extensions" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><BrowserExtensionsPage /></Suspense></PageErrorBoundary>} />
          <Route path="/anti-spyware" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><AntiSpywarePage /></Suspense></PageErrorBoundary>} />
          <Route path="/dns-protector" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><DnsProtectorPage /></Suspense></PageErrorBoundary>} />
          <Route path="/ad-blocker" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><AdBlockerPage /></Suspense></PageErrorBoundary>} />
          <Route path="/login-monitor" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><LoginMonitorPage /></Suspense></PageErrorBoundary>} />
          <Route path="/file-recovery" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><FileRecoveryPage /></Suspense></PageErrorBoundary>} />
          <Route path="/cloud-cleaner" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><CloudCleanerPage /></Suspense></PageErrorBoundary>} />
          <Route path="/multi-user" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><MultiUserPage /></Suspense></PageErrorBoundary>} />
          <Route path="/rollback-history" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><RollbackHistoryPage /></Suspense></PageErrorBoundary>} />
          <Route path="/smart-optimize" element={<Navigate to="/" replace />} />
          <Route path="/settings" element={<PageErrorBoundary><Suspense fallback={<PageSkeleton />}><SettingsPage /></Suspense></PageErrorBoundary>} />
        </Route>
      </Routes>
    </BrowserRouter>
    <FloatingAIChat />
    </DashboardProvider>
    </AIProvider>
    </PolicyProvider>
    </QueryClientProvider>
  )
}

export default App
