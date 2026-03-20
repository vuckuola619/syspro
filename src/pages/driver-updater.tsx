import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MonitorCog, RefreshCw, Download, CheckCircle2, AlertTriangle } from "lucide-react"
import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"

interface DriverItem {
  name: string
  device: string
  current_version: string
  latest_version: string
  needs_update: boolean
  category: string
}

export default function DriverUpdaterPage() {
  const [isScanning, setIsScanning] = useState(false)
  const [hasScanned, setHasScanned] = useState(false)
  const [drivers, setDrivers] = useState<DriverItem[]>([])
  const [updatingDriver, setUpdatingDriver] = useState<string | null>(null)

  async function startScan() {
    setIsScanning(true)
    
    try {
      const result = await invoke<DriverItem[]>("scan_drivers")
      setDrivers(result)
      setHasScanned(true)
    } catch (e) {
      console.error(e)
    } finally {
      setIsScanning(false)
    }
  }

  async function updateDriver(driverName: string) {
    setUpdatingDriver(driverName)
    try {
      await invoke("update_driver", { driverName })
      setDrivers(prev => prev.map(d => 
        d.name === driverName 
          ? { ...d, needs_update: false, current_version: d.latest_version } 
          : d
      ))
    } catch (e) {
      console.error(e)
    } finally {
      setUpdatingDriver(null)
    }
  }

  const outdated = drivers.filter((d) => d.needs_update)
  const current = drivers.filter((d) => !d.needs_update)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Driver Updater</h1>
        <p className="text-sm text-muted-foreground mt-1">Keep your hardware drivers up to date for optimal performance</p>
      </div>

      {!hasScanned ? (
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10">
              <MonitorCog className="h-6 w-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium">Scan for driver updates</p>
              <p className="text-sm text-muted-foreground">Check all hardware drivers for available updates</p>
            </div>
            <Button onClick={startScan} disabled={isScanning} className="gap-2">
              {isScanning ? <><RefreshCw className="h-4 w-4 animate-spin" /> Scanning...</> : <><MonitorCog className="h-4 w-4" /> Scan Drivers</>}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {outdated.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> Driver Updates Available ({outdated.length})
              </h2>
              {outdated.map((drv) => (
                <Card key={drv.name}>
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{drv.name}</p>
                        <Badge variant="secondary">{drv.category}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{drv.device}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <span className="text-red-600">{drv.current_version}</span> → <span className="text-emerald-600">{drv.latest_version}</span>
                      </p>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => updateDriver(drv.name)}
                      disabled={updatingDriver === drv.name}
                      className="gap-1.5"
                    >
                      {updatingDriver === drv.name ? <RefreshCw className="h-3 w-3 animate-spin"/> : <Download className="h-3 w-3" />}
                      Update
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {current.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Up to Date ({current.length})
              </h2>
              {current.map((drv) => (
                <Card key={drv.name}>
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{drv.name}</p>
                        <Badge variant="secondary">{drv.category}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{drv.device} · {drv.current_version}</p>
                    </div>
                    <Badge variant="secondary" className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">Current</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
