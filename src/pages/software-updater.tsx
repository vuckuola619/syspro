import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Download, RefreshCw, CheckCircle2, Package, Zap, AlertTriangle, Search } from "lucide-react"
import { useState, useMemo } from "react"
import { invoke } from "@tauri-apps/api/core"

interface SoftwareItem {
  name: string
  current_version: string
  latest_version: string
  publisher: string
  needs_update: boolean
}

type FilterType = "all" | "outdated" | "uptodate"

export default function SoftwareUpdaterPage() {
  const [isScanning, setIsScanning] = useState(false)
  const [hasScanned, setHasScanned] = useState(false)
  const [apps, setApps] = useState<SoftwareItem[]>([])
  const [updating, setUpdating] = useState<string | null>(null)
  const [updatingAll, setUpdatingAll] = useState(false)
  const [updateResults, setUpdateResults] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState<FilterType>("all")
  const [search, setSearch] = useState("")

  async function startScan() {
    setIsScanning(true)
    try {
      const data = await invoke<SoftwareItem[]>("check_software_updates")
      setApps(data)
      setHasScanned(true)
    } catch (e) { console.error(e) }
    finally { setIsScanning(false) }
  }

  async function updateApp(name: string) {
    setUpdating(name)
    try {
      const msg = await invoke<string>("update_software_winget", { appName: name })
      setUpdateResults(prev => ({ ...prev, [name]: msg }))
    } catch (e) {
      setUpdateResults(prev => ({ ...prev, [name]: String(e) }))
    }
    finally { setUpdating(null) }
  }

  async function updateAll() {
    setUpdatingAll(true)
    try {
      const msg = await invoke<string>("update_all_software")
      setUpdateResults(prev => ({ ...prev, _all: msg }))
    } catch (e) {
      setUpdateResults(prev => ({ ...prev, _all: String(e) }))
    }
    finally { setUpdatingAll(false) }
  }

  const outdatedCount = apps.filter(a => a.needs_update).length
  const uptodateCount = apps.filter(a => !a.needs_update).length

  const filtered = useMemo(() => {
    let list = apps
    if (filter === "outdated") list = list.filter(a => a.needs_update)
    if (filter === "uptodate") list = list.filter(a => !a.needs_update)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(a => a.name.toLowerCase().includes(q) || a.publisher.toLowerCase().includes(q))
    }
    return list
  }, [apps, filter, search])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Software Updater</h1>
        <p className="text-sm text-muted-foreground mt-1">Scan installed software and update via winget (silent)</p>
      </div>

      {!hasScanned ? (
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10">
              {isScanning ? <RefreshCw className="h-6 w-6 text-blue-600 dark:text-blue-400 animate-spin" /> : <Download className="h-6 w-6 text-blue-600 dark:text-blue-400" />}
            </div>
            <div className="flex-1">
              <p className="font-medium">{isScanning ? "Scanning installed software & checking winget..." : "Check installed software"}</p>
              <p className="text-sm text-muted-foreground">Reads real version info and checks for updates via winget</p>
            </div>
            <Button onClick={startScan} disabled={isScanning} className="gap-2">
              <Download className="h-4 w-4" /> {isScanning ? "Scanning..." : "Scan Software"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full ${outdatedCount > 0 ? "bg-amber-50 dark:bg-amber-500/10" : "bg-emerald-50 dark:bg-emerald-500/10"}`}>
                {outdatedCount > 0 
                  ? <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  : <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                }
              </div>
              <div className="flex-1">
                <p className="font-medium">
                  {outdatedCount > 0 
                    ? `${outdatedCount} updates available` 
                    : "All software is up to date!"
                  }
                </p>
                <p className="text-sm text-muted-foreground">
                  {apps.length} apps scanned • {uptodateCount} up to date • {outdatedCount} outdated
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={startScan} disabled={isScanning} className="gap-2" size="sm">
                  <RefreshCw className={`h-3.5 w-3.5 ${isScanning ? "animate-spin" : ""}`} /> Refresh
                </Button>
                {outdatedCount > 0 && (
                  <Button onClick={updateAll} disabled={updatingAll} className="gap-2" size="sm">
                    {updatingAll ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                    Update All
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {updateResults._all && (
            <Card className="border-blue-200 bg-blue-50/30 dark:border-blue-500/30 dark:bg-blue-500/5">
              <CardContent className="p-3">
                <p className="text-xs font-mono whitespace-pre-wrap max-h-32 overflow-auto">{updateResults._all}</p>
              </CardContent>
            </Card>
          )}

          {/* Filter Tabs + Search */}
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border bg-muted/30 p-0.5 gap-0.5">
              {([
                { key: "all" as FilterType, label: "All", count: apps.length },
                { key: "outdated" as FilterType, label: "Outdated", count: outdatedCount },
                { key: "uptodate" as FilterType, label: "Up to date", count: uptodateCount },
              ]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    filter === tab.key
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label} <span className="text-muted-foreground/60">({tab.count})</span>
                </button>
              ))}
            </div>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search apps..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-8 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            {filtered.map((app) => (
              <Card key={app.name} className={app.needs_update ? "border-amber-200/50 dark:border-amber-500/20" : ""}>
                <CardContent className="flex items-center gap-4 p-3 px-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/50">
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{app.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{app.publisher || "Unknown"}</p>
                  </div>
                  {app.needs_update ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <span className="text-xs text-muted-foreground line-through">{app.current_version}</span>
                        <span className="text-xs font-medium text-amber-600 dark:text-amber-400 ml-1">→ {app.latest_version}</span>
                      </div>
                      <Button
                        size="sm" variant="default"
                        onClick={() => updateApp(app.name)}
                        disabled={updating === app.name}
                        className="gap-1.5 text-xs h-7 px-2"
                      >
                        {updating === app.name ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                        Update
                      </Button>
                    </div>
                  ) : (
                    <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 shrink-0">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> {app.current_version}
                    </Badge>
                  )}
                  {updateResults[app.name] && (
                    <span className="text-[10px] text-muted-foreground max-w-[150px] truncate">{updateResults[app.name]}</span>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
