import { createContext, useContext, useState, type ReactNode } from "react"

type Locale = "en" | "id"

interface Translations { [key: string]: string }

const en: Translations = {
  // Navigation
  "nav.dashboard": "Dashboard",
  "nav.one_click": "One-Click Optimize",
  "nav.junk_cleaner": "Junk Cleaner",
  "nav.registry_cleaner": "Registry Cleaner",
  "nav.registry_defrag": "Registry Defrag",
  "nav.duplicate_finder": "Duplicate Finder",
  "nav.system_slimming": "System Slimming",
  "nav.startup_manager": "Startup Manager",
  "nav.performance": "Performance",
  "nav.live_monitor": "Live Monitor",
  "nav.turbo_boost": "Turbo Boost",
  "nav.benchmarks": "Benchmarks",
  "nav.privacy_eraser": "Privacy Eraser",
  "nav.privacy_hardening": "Privacy Hardening",
  "nav.popup_blocker": "Pop-up Blocker",
  "nav.firewall_manager": "Firewall Manager",
  "nav.file_hider": "File Hider",
  "nav.password_gen": "Password Gen",
  "nav.software_updater": "Software Updater",
  "nav.driver_updater": "Driver Updater",
  "nav.app_uninstaller": "App Uninstaller",
  "nav.debloater": "Windows Debloater",
  "nav.windows_tweaks": "Windows Tweaks",
  "nav.service_manager": "Service Manager",
  "nav.edge_manager": "Edge Manager",
  "nav.update_manager": "Update Manager",
  "nav.disk_analyzer": "Disk Analyzer",
  "nav.disk_defrag": "Disk Defrag",
  "nav.disk_health": "Disk Health",
  "nav.file_shredder": "File Shredder",
  "nav.file_splitter": "File Splitter",
  "nav.internet_booster": "Internet Booster",
  "nav.speed_monitor": "Speed Monitor",
  "nav.speed_test": "Speed Test",
  "nav.network_monitor": "Network Monitor",
  "nav.hosts_editor": "Hosts Editor",
  "nav.system_info": "System Info",
  "nav.scheduled_clean": "Scheduled Clean",
  "nav.restore_points": "Restore Points",
  "nav.settings": "Settings",
  // Categories
  "cat.overview": "Overview",
  "cat.cleaning": "Cleaning",
  "cat.performance": "Performance",
  "cat.privacy": "Privacy & Security",
  "cat.system_tools": "System Tools",
  "cat.disk_files": "Disk & Files",
  "cat.network": "Network",
  "cat.utilities": "Utilities",
  // Common actions
  "action.scan": "Start Scan",
  "action.clean": "Clean",
  "action.optimize": "Optimize",
  "action.close": "Close",
  "action.save": "Save",
  "action.cancel": "Cancel",
  "action.export": "Export",
  "action.refresh": "Refresh",
  // Settings
  "settings.title": "Settings",
  "settings.theme": "Theme",
  "settings.language": "Language",
  "settings.accent_color": "Accent Color",
  "settings.background": "Background Image",
  "settings.general": "General",
  "settings.run_startup": "Run at startup",
  "settings.minimize_tray": "Minimize to tray",
  "settings.check_updates": "Check for updates",
  "settings.auto_update": "Auto-Update",
  "settings.portable_mode": "Portable Mode",
}

const id: Translations = {
  // Navigation
  "nav.dashboard": "Dasbor",
  "nav.one_click": "Optimasi Sekali Klik",
  "nav.junk_cleaner": "Pembersih Sampah",
  "nav.registry_cleaner": "Pembersih Registry",
  "nav.registry_defrag": "Defrag Registry",
  "nav.duplicate_finder": "Pencari Duplikat",
  "nav.system_slimming": "Peramping Sistem",
  "nav.startup_manager": "Manajer Startup",
  "nav.performance": "Performa",
  "nav.live_monitor": "Monitor Langsung",
  "nav.turbo_boost": "Turbo Boost",
  "nav.benchmarks": "Benchmark",
  "nav.privacy_eraser": "Penghapus Privasi",
  "nav.privacy_hardening": "Penguatan Privasi",
  "nav.popup_blocker": "Pemblokir Pop-up",
  "nav.firewall_manager": "Manajer Firewall",
  "nav.file_hider": "Penyembunyi File",
  "nav.password_gen": "Pembuat Sandi",
  "nav.software_updater": "Pembaruan Software",
  "nav.driver_updater": "Pembaruan Driver",
  "nav.app_uninstaller": "Penghapus Aplikasi",
  "nav.debloater": "Debloater Windows",
  "nav.windows_tweaks": "Tweak Windows",
  "nav.service_manager": "Manajer Layanan",
  "nav.edge_manager": "Manajer Edge",
  "nav.update_manager": "Manajer Update",
  "nav.disk_analyzer": "Analisis Disk",
  "nav.disk_defrag": "Defrag Disk",
  "nav.disk_health": "Kesehatan Disk",
  "nav.file_shredder": "Penghancur File",
  "nav.file_splitter": "Pemecah File",
  "nav.internet_booster": "Penguat Internet",
  "nav.speed_monitor": "Monitor Kecepatan",
  "nav.speed_test": "Tes Kecepatan",
  "nav.network_monitor": "Monitor Jaringan",
  "nav.hosts_editor": "Editor Hosts",
  "nav.system_info": "Info Sistem",
  "nav.scheduled_clean": "Pembersihan Terjadwal",
  "nav.restore_points": "Titik Pemulihan",
  "nav.settings": "Pengaturan",
  // Categories
  "cat.overview": "Ikhtisar",
  "cat.cleaning": "Pembersihan",
  "cat.performance": "Performa",
  "cat.privacy": "Privasi & Keamanan",
  "cat.system_tools": "Alat Sistem",
  "cat.disk_files": "Disk & File",
  "cat.network": "Jaringan",
  "cat.utilities": "Utilitas",
  // Common actions
  "action.scan": "Mulai Scan",
  "action.clean": "Bersihkan",
  "action.optimize": "Optimalkan",
  "action.close": "Tutup",
  "action.save": "Simpan",
  "action.cancel": "Batal",
  "action.export": "Ekspor",
  "action.refresh": "Segarkan",
  // Settings
  "settings.title": "Pengaturan",
  "settings.theme": "Tema",
  "settings.language": "Bahasa",
  "settings.accent_color": "Warna Aksen",
  "settings.background": "Gambar Latar",
  "settings.general": "Umum",
  "settings.run_startup": "Jalankan saat startup",
  "settings.minimize_tray": "Minimize ke tray",
  "settings.check_updates": "Periksa pembaruan",
  "settings.auto_update": "Pembaruan Otomatis",
  "settings.portable_mode": "Mode Portabel",
}

const translations: Record<Locale, Translations> = { en, id }

interface I18nContextType {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: string) => string
  availableLocales: { code: Locale; name: string }[]
}

const I18nContext = createContext<I18nContextType>({
  locale: "en", setLocale: () => {},
  t: (key) => key,
  availableLocales: [],
})

export function useI18n() { return useContext(I18nContext) }

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() =>
    (localStorage.getItem("SABI-locale") as Locale) || "en"
  )

  function setLocale(l: Locale) {
    setLocaleState(l)
    localStorage.setItem("SABI-locale", l)
  }

  function t(key: string): string {
    return translations[locale]?.[key] || translations.en[key] || key
  }

  const availableLocales = [
    { code: "en" as Locale, name: "English" },
    { code: "id" as Locale, name: "Bahasa Indonesia" },
  ]

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, availableLocales }}>
      {children}
    </I18nContext.Provider>
  )
}
