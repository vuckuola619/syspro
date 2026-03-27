import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AppLayout } from "@/components/layout/app-layout"
import { lazy, Suspense, useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { openUrl } from "@tauri-apps/plugin-opener"
import { AIProvider } from "@/context/ai-context"
import { DashboardProvider } from "@/context/dashboard-context"
import { FloatingAIChat } from "@/components/floating-ai-chat"

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
    <AIProvider>
    <DashboardProvider>
    <BrowserRouter>
      {updateInfo && !dismissed && (
        <UpdateBanner info={updateInfo} onDismiss={() => setDismissed(true)} />
      )}
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Suspense fallback={<PageSkeleton />}><DashboardPage /></Suspense>} />
          <Route path="/junk-cleaner" element={<Suspense fallback={<PageSkeleton />}><JunkCleanerPage /></Suspense>} />
          <Route path="/registry" element={<Suspense fallback={<PageSkeleton />}><RegistryCleanerPage /></Suspense>} />
          <Route path="/startup" element={<Suspense fallback={<PageSkeleton />}><StartupManagerPage /></Suspense>} />
          <Route path="/performance" element={<Suspense fallback={<PageSkeleton />}><PerformancePage /></Suspense>} />
          <Route path="/privacy" element={<Suspense fallback={<PageSkeleton />}><PrivacyPage /></Suspense>} />
          <Route path="/software-updater" element={<Suspense fallback={<PageSkeleton />}><SoftwareUpdaterPage /></Suspense>} />
          <Route path="/driver-updater" element={<Suspense fallback={<PageSkeleton />}><DriverUpdaterPage /></Suspense>} />
          <Route path="/file-shredder" element={<Suspense fallback={<PageSkeleton />}><FileShredderPage /></Suspense>} />
          <Route path="/duplicate-finder" element={<Suspense fallback={<PageSkeleton />}><DuplicateFinderPage /></Suspense>} />
          <Route path="/system-info" element={<Suspense fallback={<PageSkeleton />}><SystemInfoPage /></Suspense>} />
          <Route path="/live-monitor" element={<Suspense fallback={<PageSkeleton />}><LiveMonitorPage /></Suspense>} />
          <Route path="/disk-analyzer" element={<Suspense fallback={<PageSkeleton />}><DiskAnalyzerPage /></Suspense>} />
          <Route path="/app-uninstaller" element={<Suspense fallback={<PageSkeleton />}><AppUninstallerPage /></Suspense>} />
          <Route path="/scheduled-clean" element={<Suspense fallback={<PageSkeleton />}><ScheduledCleanPage /></Suspense>} />
          <Route path="/disk-defrag" element={<Suspense fallback={<PageSkeleton />}><DiskDefragPage /></Suspense>} />
          <Route path="/internet-booster" element={<Suspense fallback={<PageSkeleton />}><InternetBoosterPage /></Suspense>} />
          <Route path="/file-splitter" element={<Suspense fallback={<PageSkeleton />}><FileSplitterPage /></Suspense>} />
          <Route path="/debloater" element={<Suspense fallback={<PageSkeleton />}><WindowsDebloaterPage /></Suspense>} />
          <Route path="/privacy-hardening" element={<Suspense fallback={<PageSkeleton />}><PrivacyHardeningPage /></Suspense>} />
          <Route path="/restore-points" element={<Suspense fallback={<PageSkeleton />}><RestorePointsPage /></Suspense>} />
          <Route path="/windows-tweaks" element={<Suspense fallback={<PageSkeleton />}><WindowsTweaksPage /></Suspense>} />
          <Route path="/service-manager" element={<Suspense fallback={<PageSkeleton />}><ServiceManagerPage /></Suspense>} />
          <Route path="/edge-manager" element={<Suspense fallback={<PageSkeleton />}><EdgeManagerPage /></Suspense>} />
          <Route path="/network-monitor" element={<Suspense fallback={<PageSkeleton />}><NetworkMonitorPage /></Suspense>} />
          <Route path="/hosts-editor" element={<Suspense fallback={<PageSkeleton />}><HostsEditorPage /></Suspense>} />
          <Route path="/update-manager" element={<Suspense fallback={<PageSkeleton />}><UpdateManagerPage /></Suspense>} />
          <Route path="/firewall-manager" element={<Suspense fallback={<PageSkeleton />}><FirewallManagerPage /></Suspense>} />
          <Route path="/benchmarks" element={<Suspense fallback={<PageSkeleton />}><BenchmarksPage /></Suspense>} />
          <Route path="/turbo-boost" element={<Suspense fallback={<PageSkeleton />}><TurboBoostPage /></Suspense>} />
          <Route path="/speed-monitor" element={<Suspense fallback={<PageSkeleton />}><SpeedMonitorPage /></Suspense>} />
          <Route path="/popup-blocker" element={<Suspense fallback={<PageSkeleton />}><PopupBlockerPage /></Suspense>} />
          <Route path="/file-hider" element={<Suspense fallback={<PageSkeleton />}><FileHiderPage /></Suspense>} />
          <Route path="/password-generator" element={<Suspense fallback={<PageSkeleton />}><PasswordGeneratorPage /></Suspense>} />
          <Route path="/registry-defrag" element={<Suspense fallback={<PageSkeleton />}><RegistryDefragPage /></Suspense>} />
          <Route path="/system-slimming" element={<Suspense fallback={<PageSkeleton />}><SystemSlimmingPage /></Suspense>} />
          <Route path="/speed-test" element={<Suspense fallback={<PageSkeleton />}><SpeedTestPage /></Suspense>} />
          <Route path="/disk-health" element={<Suspense fallback={<PageSkeleton />}><DiskHealthPage /></Suspense>} />
          <Route path="/export-report" element={<Suspense fallback={<PageSkeleton />}><ExportReportPage /></Suspense>} />
          <Route path="/large-file-finder" element={<Suspense fallback={<PageSkeleton />}><LargeFileFinderPage /></Suspense>} />
          <Route path="/empty-folder-scanner" element={<Suspense fallback={<PageSkeleton />}><EmptyFolderScannerPage /></Suspense>} />
          <Route path="/cpu-saver" element={<Navigate to="/turbo-boost" replace />} />
          <Route path="/smart-clean" element={<Suspense fallback={<PageSkeleton />}><SmartCleanPage /></Suspense>} />
          <Route path="/app-junk" element={<Suspense fallback={<PageSkeleton />}><AppJunkPage /></Suspense>} />
          <Route path="/browser-extensions" element={<Suspense fallback={<PageSkeleton />}><BrowserExtensionsPage /></Suspense>} />
          <Route path="/anti-spyware" element={<Suspense fallback={<PageSkeleton />}><AntiSpywarePage /></Suspense>} />
          <Route path="/dns-protector" element={<Suspense fallback={<PageSkeleton />}><DnsProtectorPage /></Suspense>} />
          <Route path="/ad-blocker" element={<Suspense fallback={<PageSkeleton />}><AdBlockerPage /></Suspense>} />
          <Route path="/login-monitor" element={<Suspense fallback={<PageSkeleton />}><LoginMonitorPage /></Suspense>} />
          <Route path="/file-recovery" element={<Suspense fallback={<PageSkeleton />}><FileRecoveryPage /></Suspense>} />
          <Route path="/cloud-cleaner" element={<Suspense fallback={<PageSkeleton />}><CloudCleanerPage /></Suspense>} />
          <Route path="/multi-user" element={<Suspense fallback={<PageSkeleton />}><MultiUserPage /></Suspense>} />
          <Route path="/smart-optimize" element={<Navigate to="/" replace />} />
          <Route path="/settings" element={<Suspense fallback={<PageSkeleton />}><SettingsPage /></Suspense>} />
        </Route>
      </Routes>
    </BrowserRouter>
    <FloatingAIChat />
    </DashboardProvider>
    </AIProvider>
  )
}

export default App
