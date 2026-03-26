import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Shield, RefreshCw, Search, AlertTriangle, CheckCircle, Download } from "lucide-react"
import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"

interface DefenderStatus {
  antivirus_enabled: boolean
  real_time_protection: boolean
  definition_date: string
  definition_version: string
  last_scan_time: string
  engine_version: string
}

interface ScanResult {
  status: string
  threats_found: number
  details: string
}

export default function AntiSpywarePage() {
  const [status, setStatus] = useState<DefenderStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [scanType, setScanType] = useState("quick")

  async function loadStatus() {
    setIsLoading(true)
    try {
      const data = await invoke<DefenderStatus>("get_defender_status")
      setStatus(data)
      toast.success("Defender status loaded")
    } catch (e) {
      toast.error(String(e))
    } finally {
      setIsLoading(false)
    }
  }

  async function runScan() {
    setIsScanning(true)
    setScanResult(null)
    try {
      const result = await invoke<ScanResult>("run_defender_scan", { scanType })
      setScanResult(result)
      if (result.threats_found > 0) {
        toast.warning(`Threats found: ${result.threats_found}`)
      } else {
        toast.success("Scan complete — system is clean")
      }
    } catch (e) {
      toast.error(String(e))
    } finally {
      setIsScanning(false)
    }
  }

  async function updateDefs() {
    try {
      const msg = await invoke<string>("update_defender_definitions")
      toast.success(msg)
      loadStatus()
    } catch (e) {
      toast.error(String(e))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Anti-Spyware</h1>
        <p className="text-sm text-muted-foreground mt-1">Windows Defender integration — scan, update, and monitor protection status</p>
      </div>

      {/* Status + Actions */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:border-primary/30 transition-colors" onClick={loadStatus}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10">
              {isLoading ? <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" /> : <Shield className="h-5 w-5 text-blue-600" />}
            </div>
            <div>
              <p className="text-sm font-medium">Check Status</p>
              <p className="text-xs text-muted-foreground">{status ? (status.antivirus_enabled ? "Protected" : "Disabled!") : "Click to check"}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary/30 transition-colors" onClick={runScan}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 dark:bg-green-500/10">
              {isScanning ? <RefreshCw className="h-5 w-5 text-green-600 animate-spin" /> : <Search className="h-5 w-5 text-green-600" />}
            </div>
            <div>
              <p className="text-sm font-medium">{isScanning ? "Scanning..." : "Run Scan"}</p>
              <p className="text-xs text-muted-foreground capitalize">{scanType} scan</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary/30 transition-colors" onClick={updateDefs}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-50 dark:bg-purple-500/10">
              <Download className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Update Definitions</p>
              <p className="text-xs text-muted-foreground">Refresh virus signatures</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scan type selector */}
      <div className="flex gap-2">
        {["quick", "full"].map(t => (
          <button
            key={t}
            onClick={() => setScanType(t)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium border transition-colors ${scanType === t ? "bg-primary/10 border-primary text-primary" : "bg-muted/50 border-transparent hover:bg-muted"}`}
          >
            {t === "quick" ? "⚡ Quick Scan" : "🔍 Full Scan"}
          </button>
        ))}
      </div>

      {/* Defender Status */}
      {status && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Shield className="h-4 w-4" /> Defender Status
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <span className="text-muted-foreground">Antivirus</span>
                <Badge variant={status.antivirus_enabled ? "default" : "destructive"}>
                  {status.antivirus_enabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <span className="text-muted-foreground">Real-time Protection</span>
                <Badge variant={status.real_time_protection ? "default" : "destructive"}>
                  {status.real_time_protection ? "Active" : "Off"}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <span className="text-muted-foreground">Engine</span>
                <span className="font-mono text-xs">{status.engine_version}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <span className="text-muted-foreground">Definitions</span>
                <span className="font-mono text-xs">{status.definition_version}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scan Result */}
      {scanResult && (
        <Card className={scanResult.threats_found > 0 ? "border-red-200 dark:border-red-500/20" : "border-green-200 dark:border-green-500/20"}>
          <CardContent className="p-5 space-y-2">
            <div className="flex items-center gap-2">
              {scanResult.threats_found > 0 ? <AlertTriangle className="h-5 w-5 text-red-500" /> : <CheckCircle className="h-5 w-5 text-green-500" />}
              <span className="text-sm font-medium">{scanResult.status}</span>
              {scanResult.threats_found > 0 && <Badge variant="destructive">{scanResult.threats_found} threat(s)</Badge>}
            </div>
            {scanResult.details && (
              <pre className="text-xs text-muted-foreground bg-muted/30 p-3 rounded overflow-auto max-h-40 whitespace-pre-wrap">{scanResult.details}</pre>
            )}
          </CardContent>
        </Card>
      )}

      {!status && !isLoading && (
        <Card>
          <CardContent className="p-8 text-center">
            <Shield className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Click "Check Status" to view Windows Defender protection status.</p>
            <p className="text-xs text-muted-foreground mt-1">Uses Windows Defender CLI — no third-party software needed.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
