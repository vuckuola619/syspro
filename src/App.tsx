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

function App() {
  return (
    <BrowserRouter>
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

