import { NavLink } from "react-router-dom"
import {
  LayoutDashboard,
  Trash2,
  Database,
  Rocket,
  Activity,
  Shield,
  Download,
  MonitorCog,
  FileX2,
  CopyMinus,
  Cpu,
  AreaChart,
  HardDrive,
  Package,
  Calendar,
  Disc,
  Wifi,
  Scissors,
  Zap,
  ShieldBan,
  Lock,
  History,
  Wrench,
  Server,
  Globe,
  Network,
  FileText,
  RefreshCw,
  Flame,
  Gauge,
  BellOff,
  EyeOff,
  KeyRound,
  Layers,
  Eraser,
  Search,
  HeartPulse,
  ChevronDown,
  FileDown,
  FileSearch,
  FolderMinus,
  Gauge as CpuGauge,
  Sparkles,
  Puzzle,
  UserCheck,
  Cloud,
  Trash,
  Users,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useState, useMemo, useRef, useEffect } from "react"

type NavItem = { name: string; href: string; icon: any; category: string }

const navigation: NavItem[] = [
  // Overview
  { name: "Dashboard", href: "/", icon: LayoutDashboard, category: "Overview" },
  { name: "One-Click Optimize", href: "/one-click", icon: Zap, category: "Overview" },

  // Cleaning
  { name: "Junk Cleaner", href: "/junk-cleaner", icon: Trash2, category: "Cleaning" },
  { name: "Registry Cleaner", href: "/registry", icon: Database, category: "Cleaning" },
  { name: "Registry Defrag", href: "/registry-defrag", icon: Layers, category: "Cleaning" },
  { name: "Duplicate Finder", href: "/duplicate-finder", icon: CopyMinus, category: "Cleaning" },
  { name: "System Slimming", href: "/system-slimming", icon: Eraser, category: "Cleaning" },
  // Performance
  { name: "Startup Manager", href: "/startup", icon: Rocket, category: "Performance" },
  { name: "Performance", href: "/performance", icon: Activity, category: "Performance" },
  { name: "Live Monitor", href: "/live-monitor", icon: AreaChart, category: "Performance" },
  { name: "Turbo Boost", href: "/turbo-boost", icon: Zap, category: "Performance" },
  { name: "Benchmarks", href: "/benchmarks", icon: Gauge, category: "Performance" },
  { name: "Auto Clean", href: "/smart-clean", icon: Sparkles, category: "Performance" },
  // Privacy & Security
  { name: "Privacy Eraser", href: "/privacy", icon: Shield, category: "Privacy & Security" },
  { name: "Privacy Hardening", href: "/privacy-hardening", icon: Lock, category: "Privacy & Security" },
  { name: "Browser Extensions", href: "/browser-extensions", icon: Puzzle, category: "Privacy & Security" },
  { name: "Anti-Spyware", href: "/anti-spyware", icon: ShieldBan, category: "Privacy & Security" },
  { name: "DNS Protector", href: "/dns-protector", icon: Globe, category: "Privacy & Security" },
  { name: "Ad Blocker", href: "/ad-blocker", icon: Shield, category: "Privacy & Security" },
  { name: "Login Monitor", href: "/login-monitor", icon: UserCheck, category: "Privacy & Security" },
  { name: "Pop-up Blocker", href: "/popup-blocker", icon: BellOff, category: "Privacy & Security" },
  { name: "Firewall Manager", href: "/firewall-manager", icon: Flame, category: "Privacy & Security" },
  { name: "File Hider", href: "/file-hider", icon: EyeOff, category: "Privacy & Security" },
  { name: "Password Gen", href: "/password-generator", icon: KeyRound, category: "Privacy & Security" },
  // System Tools
  { name: "Software Updater", href: "/software-updater", icon: Download, category: "System Tools" },
  { name: "Driver Updater", href: "/driver-updater", icon: MonitorCog, category: "System Tools" },
  { name: "App Uninstaller", href: "/app-uninstaller", icon: Package, category: "System Tools" },
  { name: "Windows Debloater", href: "/debloater", icon: ShieldBan, category: "System Tools" },
  { name: "Windows Tweaks", href: "/windows-tweaks", icon: Wrench, category: "System Tools" },
  { name: "Service Manager", href: "/service-manager", icon: Server, category: "System Tools" },
  { name: "Edge Manager", href: "/edge-manager", icon: Globe, category: "System Tools" },
  { name: "Update Manager", href: "/update-manager", icon: RefreshCw, category: "System Tools" },
  { name: "Multi-User", href: "/multi-user", icon: Users, category: "System Tools" },
  // Disk & Files
  { name: "Disk Analyzer", href: "/disk-analyzer", icon: HardDrive, category: "Disk & Files" },
  { name: "Disk Defrag", href: "/disk-defrag", icon: Disc, category: "Disk & Files" },
  { name: "File Shredder", href: "/file-shredder", icon: FileX2, category: "Disk & Files" },
  { name: "File Splitter", href: "/file-splitter", icon: Scissors, category: "Disk & Files" },
  { name: "Disk Health", href: "/disk-health", icon: HeartPulse, category: "Disk & Files" },
  { name: "Large File Finder", href: "/large-file-finder", icon: FileSearch, category: "Disk & Files" },
  { name: "Empty Folders", href: "/empty-folder-scanner", icon: FolderMinus, category: "Disk & Files" },
  { name: "App Junk", href: "/app-junk", icon: Package, category: "Disk & Files" },
  { name: "File Recovery", href: "/file-recovery", icon: Trash, category: "Disk & Files" },
  { name: "Cloud Cleaner", href: "/cloud-cleaner", icon: Cloud, category: "Disk & Files" },
  // Network
  { name: "Internet Booster", href: "/internet-booster", icon: Wifi, category: "Network" },
  { name: "Speed Monitor", href: "/speed-monitor", icon: Wifi, category: "Network" },
  { name: "Network Monitor", href: "/network-monitor", icon: Network, category: "Network" },
  { name: "Hosts Editor", href: "/hosts-editor", icon: FileText, category: "Network" },
  { name: "Speed Test", href: "/speed-test", icon: Gauge, category: "Network" },
  // Utilities
  { name: "System Info", href: "/system-info", icon: Cpu, category: "Utilities" },
  { name: "Scheduled Clean", href: "/scheduled-clean", icon: Calendar, category: "Utilities" },
  { name: "Restore Points", href: "/restore-points", icon: History, category: "Utilities" },
  { name: "Export Report", href: "/export-report", icon: FileDown, category: "Utilities" },
]

const categories = ["All", "Overview", "Cleaning", "Performance", "Privacy & Security", "System Tools", "Disk & Files", "Network", "Utilities"]

export function Sidebar() {
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState("All")
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const filtered = useMemo(() => {
    let items = navigation
    if (search) {
      const q = search.toLowerCase()
      items = items.filter(item =>
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      )
    }
    if (activeCategory !== "All") {
      items = items.filter(item => item.category === activeCategory)
    }
    return items
  }, [search, activeCategory])

  const grouped = useMemo(() => {
    const map = new Map<string, NavItem[]>()
    for (const item of filtered) {
      const list = map.get(item.category) || []
      list.push(item)
      map.set(item.category, list)
    }
    return map
  }, [filtered])

  const displayCategories = categories.filter(c => c !== "All")

  return (
    <div className="flex h-full w-[210px] flex-col border-r bg-card shrink-0">
      {/* Search Box */}
      <div className="px-3 pt-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            className="w-full rounded-md border bg-muted/50 pl-8 pr-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Search features..."
            value={search}
            onChange={e => { setSearch(e.target.value); if (e.target.value) setActiveCategory("All") }}
          />
        </div>
      </div>

      {/* Category Dropdown */}
      {!search && (
        <div className="px-3 pt-2 pb-1" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-full flex items-center justify-between rounded-md border bg-muted/50 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
          >
            <span>{activeCategory === "All" ? "All Categories" : activeCategory}</span>
            <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", dropdownOpen && "rotate-180")} />
          </button>
          {dropdownOpen && (
            <div className="absolute z-50 mt-1 w-[216px] rounded-md border bg-card shadow-lg py-1">
              <button
                onClick={() => { setActiveCategory("All"); setDropdownOpen(false) }}
                className={cn("w-full text-left px-3 py-1.5 text-xs font-medium transition-colors", activeCategory === "All" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent")}
              >All Categories</button>
              {displayCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => { setActiveCategory(cat); setDropdownOpen(false) }}
                  className={cn("w-full text-left px-3 py-1.5 text-xs font-medium transition-colors", activeCategory === cat ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent")}
                >{cat}</button>
              ))}
            </div>
          )}
        </div>
      )}

      <ScrollArea className="flex-1 px-3 py-2">
        <nav className="flex flex-col gap-0.5">
          {search || activeCategory !== "All" ? (
            // Flat filtered list
            filtered.length > 0 ? filtered.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
                    isActive ? "bg-primary/8 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )
                }
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.name}</span>
                <span className="text-[9px] text-muted-foreground/60">{item.category}</span>
              </NavLink>
            )) : (
              <p className="text-xs text-muted-foreground text-center py-4">No features found</p>
            )
          ) : (
            // Grouped by category
            displayCategories.map(cat => {
              const items = grouped.get(cat)
              if (!items || items.length === 0) return null
              return (
                <div key={cat}>
                  <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-3 pt-3 pb-1">{cat}</p>
                  {items.map((item) => (
                    <NavLink
                      key={item.href}
                      to={item.href}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
                          isActive ? "bg-primary/8 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        )
                      }
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {item.name}
                    </NavLink>
                  ))}
                </div>
              )
            })
          )}
        </nav>
      </ScrollArea>
    </div>
  )
}
