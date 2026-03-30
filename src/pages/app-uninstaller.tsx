import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Package, RefreshCw, Trash2, Search, AlertTriangle, CheckCircle2, FolderSearch } from "lucide-react"
import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"

interface InstalledApp {
  name: string
  publisher: string
  version: string
  install_date: string
  install_location: string
  uninstall_string: string
  size_mb: number
}

interface LeftoverResult {
  app_name: string
  leftover_files: string[]
  leftover_registry: string[]
  total_size_mb: number
}

export default function AppUninstallerPage() {
  const [apps, setApps] = useState<InstalledApp[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [uninstallingApp, setUninstallingApp] = useState<string | null>(null)
  const [scanningLeftovers, setScanningLeftovers] = useState<string | null>(null)
  const [leftovers, setLeftovers] = useState<LeftoverResult | null>(null)
  const [cleanedLeftovers, setCleanedLeftovers] = useState(false)

  async function loadApps() {
    setIsLoading(true)
    try {
      const data = await invoke<InstalledApp[]>("get_installed_apps")
      setApps(Array.isArray(data) ? data : [])
      setHasLoaded(true)
    } catch (e) {
      toast.error(String(e))
    } finally {
      setIsLoading(false)
    }
  }

  async function handleUninstall(app: InstalledApp) {
    if (!app.uninstall_string) return
    setUninstallingApp(app.name)
    try {
      await invoke("uninstall_app", { uninstallString: app.uninstall_string })
      // Give the uninstaller time to launch
      setTimeout(() => setUninstallingApp(null), 3000)
    } catch (e) {
      toast.error(String(e))
      setUninstallingApp(null)
    }
  }

  async function handleScanLeftovers(app: InstalledApp) {
    setScanningLeftovers(app.name)
    setLeftovers(null)
    setCleanedLeftovers(false)
    try {
      const result = await invoke<LeftoverResult>("scan_app_leftovers", {
        appName: app.name,
        installLocation: app.install_location,
      })
      setLeftovers(result)
    } catch (e) {
      toast.error(String(e))
    } finally {
      setScanningLeftovers(null)
    }
  }

  async function handleCleanLeftovers() {
    if (!leftovers) return
    try {
      await invoke("clean_app_leftovers", {
        files: leftovers.leftover_files,
        registryKeys: leftovers.leftover_registry,
      })
      setCleanedLeftovers(true)
    } catch (e) {
      toast.error(String(e))
    }
  }

  const filteredApps = apps.filter(app =>
    app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    app.publisher.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">App Uninstaller</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Uninstall programs and clean up leftover files and registry entries
        </p>
      </div>

      {!hasLoaded ? (
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10">
              {isLoading ? <RefreshCw className="h-6 w-6 text-blue-600 animate-spin" /> : <Package className="h-6 w-6 text-blue-600" />}
            </div>
            <div className="flex-1">
              <p className="font-medium">{isLoading ? "Scanning registry for installed apps..." : "Scan installed applications"}</p>
              <p className="text-sm text-muted-foreground">Read all installed programs from the Windows registry</p>
            </div>
            <Button onClick={loadApps} disabled={isLoading} className="gap-2">
              <Package className="h-4 w-4" /> Load Apps
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search applications..."
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Badge variant="secondary">{filteredApps.length} of {apps.length} apps</Badge>
            <Button variant="outline" onClick={loadApps} disabled={isLoading} size="sm" className="gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>

          {/* Leftover Scanner Result */}
          {leftovers && (
            <Card className={cleanedLeftovers ? "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10/30" : "border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10/30"}>
              <CardContent className="p-4">
                {cleanedLeftovers ? (
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">Leftovers cleaned for {leftovers.app_name}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                          Found {leftovers.leftover_files.length} leftover files
                          {leftovers.leftover_registry.length > 0 && ` + ${leftovers.leftover_registry.length} registry entries`}
                          {leftovers.total_size_mb > 0 && ` (${leftovers.total_size_mb} MB)`}
                        </p>
                      </div>
                      <Button size="sm" variant="destructive" onClick={handleCleanLeftovers} className="gap-1.5">
                        <Trash2 className="h-3 w-3" /> Clean Leftovers
                      </Button>
                    </div>
                    {leftovers.leftover_files.length > 0 && (
                      <div className="max-h-32 overflow-auto rounded bg-white/50 dark:bg-zinc-800/50 p-2 text-xs font-mono text-muted-foreground space-y-0.5">
                        {leftovers.leftover_files.slice(0, 15).map((f, i) => (
                          <p key={i} className="truncate">{f}</p>
                        ))}
                        {leftovers.leftover_files.length > 15 && (
                          <p className="text-amber-700 dark:text-amber-300">... and {leftovers.leftover_files.length - 15} more</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* App List */}
          <div className="space-y-1">
            {filteredApps.map((app) => (
              <Card key={app.name}>
                <CardContent className="flex items-center gap-4 p-3 px-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/50">
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{app.name}</p>
                      {app.version && <Badge variant="secondary" className="text-[10px] shrink-0">{app.version}</Badge>}
                      {(app.size_mb ?? 0) > 0 && <span className="text-[10px] text-muted-foreground shrink-0">{(app.size_mb ?? 0).toFixed(1)} MB</span>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{app.publisher || "Unknown publisher"}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleScanLeftovers(app)}
                      disabled={scanningLeftovers === app.name}
                      className="gap-1 text-xs h-7 px-2"
                    >
                      {scanningLeftovers === app.name ? <RefreshCw className="h-3 w-3 animate-spin" /> : <FolderSearch className="h-3 w-3" />}
                      Scan
                    </Button>
                    {app.uninstall_string && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUninstall(app)}
                        disabled={uninstallingApp === app.name}
                        className="gap-1 text-xs h-7 px-2 text-red-600 hover:text-red-700 dark:text-red-300 hover:bg-red-50 dark:bg-red-500/10"
                      >
                        {uninstallingApp === app.name ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                        Uninstall
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
