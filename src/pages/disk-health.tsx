import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { HardDrive, Thermometer, RefreshCw, CheckCircle2, AlertTriangle, Activity } from "lucide-react"
import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"

interface SmartAttribute { name: string; value: string; status: string }
interface DiskHealth {
  model: string; serial: string; status: string; temperature: string
  size_gb: number; media_type: string; health_percent: number; attributes: SmartAttribute[]
}

export default function DiskHealthPage() {
  const [disks, setDisks] = useState<DiskHealth[]>([])
  const [loading, setLoading] = useState(false)

  async function scan() {
    setLoading(true)
    try { setDisks(await invoke<DiskHealth[]>("get_smart_health")) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Disk Health Monitor</h1>
          <p className="text-sm text-muted-foreground mt-1">S.M.A.R.T. diagnostics for all connected drives</p>
        </div>
        <Button onClick={scan} disabled={loading} className="gap-2">
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
          {loading ? "Scanning..." : "Scan Drives"}
        </Button>
      </div>

      {disks.length === 0 && !loading && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          <HardDrive className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Click "Scan Drives" to read S.M.A.R.T. data from your disks</p>
        </CardContent></Card>
      )}

      {disks.map((d, i) => (
        <Card key={i}>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${d.health_percent > 70 ? "bg-emerald-50" : d.health_percent > 40 ? "bg-amber-50" : "bg-red-50"}`}>
                  <HardDrive className={`h-6 w-6 ${d.health_percent > 70 ? "text-emerald-600" : d.health_percent > 40 ? "text-amber-600" : "text-red-600"}`} />
                </div>
                <div>
                  <p className="font-semibold">{d.model || "Unknown Disk"}</p>
                  <p className="text-xs text-muted-foreground">{d.size_gb} GB • {d.media_type} • SN: {d.serial || "N/A"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {d.temperature !== "N/A" && (
                  <div className="flex items-center gap-1 text-sm">
                    <Thermometer className="h-4 w-4 text-orange-500" />
                    <span className="font-medium">{d.temperature}</span>
                  </div>
                )}
                <Badge variant={d.status === "Healthy" ? "default" : "destructive"}>
                  {d.status === "Healthy" ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
                  {d.status}
                </Badge>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium">Health Score</span>
                <span className={`text-sm font-bold ${d.health_percent > 70 ? "text-emerald-600" : d.health_percent > 40 ? "text-amber-600" : "text-red-600"}`}>{d.health_percent}%</span>
              </div>
              <Progress value={d.health_percent} className="h-2.5" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {d.attributes.map((a, j) => (
                <div key={j} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                  <span className="text-xs text-muted-foreground">{a.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{a.value}</span>
                    <div className={`h-2 w-2 rounded-full ${a.status === "OK" ? "bg-emerald-500" : "bg-amber-500"}`} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
