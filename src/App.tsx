import { BrowserRouter, Routes, Route } from "react-router-dom"
import { AppLayout } from "@/components/layout/app-layout"
import DashboardPage from "@/pages/dashboard"
import JunkCleanerPage from "@/pages/junk-cleaner"
import RegistryCleanerPage from "@/pages/registry-cleaner"
import StartupManagerPage from "@/pages/startup-manager"
import PerformancePage from "@/pages/performance"
import PrivacyPage from "@/pages/privacy"
import SoftwareUpdaterPage from "@/pages/software-updater"
import DriverUpdaterPage from "@/pages/driver-updater"
import FileShredderPage from "@/pages/file-shredder"
import DuplicateFinderPage from "@/pages/duplicate-finder"
import SystemInfoPage from "@/pages/system-info"
import SettingsPage from "@/pages/settings"
import LiveMonitorPage from "@/pages/live-monitor"
import DiskAnalyzerPage from "@/pages/disk-analyzer"
import AppUninstallerPage from "@/pages/app-uninstaller"
import ScheduledCleanPage from "@/pages/scheduled-clean"
import DiskDefragPage from "@/pages/disk-defrag"
import InternetBoosterPage from "@/pages/internet-booster"
import FileSplitterPage from "@/pages/file-splitter"
// New feature pages
import WindowsDebloaterPage from "@/pages/windows-debloater"
import PrivacyHardeningPage from "@/pages/privacy-hardening"
import RestorePointsPage from "@/pages/restore-points"
import WindowsTweaksPage from "@/pages/windows-tweaks"
import ServiceManagerPage from "@/pages/service-manager"
import EdgeManagerPage from "@/pages/edge-manager"
import NetworkMonitorPage from "@/pages/network-monitor"
import HostsEditorPage from "@/pages/hosts-editor"
import UpdateManagerPage from "@/pages/update-manager"
import OneClickPage from "@/pages/one-click"
// Gap feature pages
import FirewallManagerPage from "@/pages/firewall-manager"
import BenchmarksPage from "@/pages/benchmarks"
import TurboBoostPage from "@/pages/turbo-boost"
import SpeedMonitorPage from "@/pages/speed-monitor"
import PopupBlockerPage from "@/pages/popup-blocker"
import FileHiderPage from "@/pages/file-hider"
import PasswordGeneratorPage from "@/pages/password-generator"
import RegistryDefragPage from "@/pages/registry-defrag"
import SystemSlimmingPage from "@/pages/system-slimming"
import SpeedTestPage from "@/pages/speed-test"
import DiskHealthPage from "@/pages/disk-health"

import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { openUrl } from "@tauri-apps/plugin-opener"

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
            SystemPro <strong>v{info.latest_version}</strong> is available!
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
    <BrowserRouter>
      {updateInfo && !dismissed && (
        <UpdateBanner info={updateInfo} onDismiss={() => setDismissed(true)} />
      )}
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/junk-cleaner" element={<JunkCleanerPage />} />
          <Route path="/registry" element={<RegistryCleanerPage />} />
          <Route path="/startup" element={<StartupManagerPage />} />
          <Route path="/performance" element={<PerformancePage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/software-updater" element={<SoftwareUpdaterPage />} />
          <Route path="/driver-updater" element={<DriverUpdaterPage />} />
          <Route path="/file-shredder" element={<FileShredderPage />} />
          <Route path="/duplicate-finder" element={<DuplicateFinderPage />} />
          <Route path="/system-info" element={<SystemInfoPage />} />
          <Route path="/live-monitor" element={<LiveMonitorPage />} />
          <Route path="/disk-analyzer" element={<DiskAnalyzerPage />} />
          <Route path="/app-uninstaller" element={<AppUninstallerPage />} />
          <Route path="/scheduled-clean" element={<ScheduledCleanPage />} />
          <Route path="/disk-defrag" element={<DiskDefragPage />} />
          <Route path="/internet-booster" element={<InternetBoosterPage />} />
          <Route path="/file-splitter" element={<FileSplitterPage />} />
          {/* New features */}
          <Route path="/one-click" element={<OneClickPage />} />
          <Route path="/debloater" element={<WindowsDebloaterPage />} />
          <Route path="/privacy-hardening" element={<PrivacyHardeningPage />} />
          <Route path="/restore-points" element={<RestorePointsPage />} />
          <Route path="/windows-tweaks" element={<WindowsTweaksPage />} />
          <Route path="/service-manager" element={<ServiceManagerPage />} />
          <Route path="/edge-manager" element={<EdgeManagerPage />} />
          <Route path="/network-monitor" element={<NetworkMonitorPage />} />
          <Route path="/hosts-editor" element={<HostsEditorPage />} />
          <Route path="/update-manager" element={<UpdateManagerPage />} />
          {/* Gap features */}
          <Route path="/firewall-manager" element={<FirewallManagerPage />} />
          <Route path="/benchmarks" element={<BenchmarksPage />} />
          <Route path="/turbo-boost" element={<TurboBoostPage />} />
          <Route path="/speed-monitor" element={<SpeedMonitorPage />} />
          <Route path="/popup-blocker" element={<PopupBlockerPage />} />
          <Route path="/file-hider" element={<FileHiderPage />} />
          <Route path="/password-generator" element={<PasswordGeneratorPage />} />
          <Route path="/registry-defrag" element={<RegistryDefragPage />} />
          <Route path="/system-slimming" element={<SystemSlimmingPage />} />
          <Route path="/speed-test" element={<SpeedTestPage />} />
          <Route path="/disk-health" element={<DiskHealthPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App

