import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Zap, RefreshCw, Power, Server, MemoryStick, Gauge } from "lucide-react"
import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"

interface BoostResult {
  services_stopped: number
  memory_freed_mb: number
  processes_optimized: number
  boost_active: boolean
}

export default function TurboBoostPage() {
  const [result, setResult] = useState<BoostResult | null>(null)
  const [active, setActive] = useState(false)
  const [loading, setLoading] = useState(false)

  async function activate() {
    setLoading(true)
    try {
      const res = await invoke<BoostResult>("activate_turbo_boost")
      setResult(res)
      setActive(true)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function deactivate() {
    setLoading(true)
    try {
      await invoke("deactivate_turbo_boost")
      setActive(false)
      setResult(null)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Turbo / Game Boost</h1>
        <p className="text-sm text-muted-foreground mt-1">Temporarily stop non-essential services and optimize for performance</p>
      </div>

      <Card className={active ? "border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50" : ""}>
        <CardContent className="p-8 text-center">
          <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center ${active ? "bg-amber-100 ring-4 ring-amber-200" : "bg-muted"}`}>
            <Zap className={`h-10 w-10 ${active ? "text-amber-600" : "text-muted-foreground"}`} />
          </div>
          <h2 className="text-xl font-bold mt-4">{active ? "Turbo Mode Active" : "Turbo Mode Off"}</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            {active
              ? "Non-essential services are stopped, visual effects reduced, and process priority elevated."
              : "Activate to temporarily stop background services and optimize system resources for gaming or intensive tasks."}
          </p>
          <div className="mt-6">
            {active ? (
              <Button onClick={deactivate} disabled={loading} variant="outline" className="gap-2">
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                Deactivate Turbo Mode
              </Button>
            ) : (
              <Button onClick={activate} disabled={loading} className="gap-2 bg-amber-600 hover:bg-amber-700">
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                Activate Turbo Mode
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {result && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-2 rounded-lg bg-blue-100"><Server className="h-5 w-5 text-blue-600" /></div>
              <div>
                <p className="text-2xl font-bold">{result.services_stopped}</p>
                <p className="text-xs text-muted-foreground">Services Stopped</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-2 rounded-lg bg-emerald-100"><MemoryStick className="h-5 w-5 text-emerald-600" /></div>
              <div>
                <p className="text-2xl font-bold">{result.memory_freed_mb} MB</p>
                <p className="text-xs text-muted-foreground">Memory Freed</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-2 rounded-lg bg-purple-100"><Gauge className="h-5 w-5 text-purple-600" /></div>
              <div>
                <p className="text-2xl font-bold">{result.processes_optimized}</p>
                <p className="text-xs text-muted-foreground">Processes Optimized</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="p-4">
          <p className="text-xs text-amber-800"><span className="font-medium">Note:</span> Turbo Mode stops services like SysMain, Windows Search, DiagTrack, etc. These will be restored when you deactivate or restart your PC.</p>
        </CardContent>
      </Card>
    </div>
  )
}
