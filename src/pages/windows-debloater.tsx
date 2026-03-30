import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Trash2, RefreshCw, Search, AlertTriangle, ShieldCheck, ShieldAlert } from "lucide-react"
import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"

interface BloatwareApp {
  name: string
  package_name: string
  publisher: string
  category: string
}

export default function WindowsDebloaterPage() {
  const [apps, setApps] = useState<BloatwareApp[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isScanning, setIsScanning] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [result, setResult] = useState("")
  const [filter, setFilter] = useState<string>("all")

  async function scan() {
    setIsScanning(true)
    try {
      const data = await invoke<BloatwareApp[]>("scan_bloatware")
      const safeData = Array.isArray(data) ? data : []
      setApps(safeData)
      setSelected(new Set(safeData.filter(a => a.category === "safe").map(a => a.name)))
    } catch (e) { toast.error(String(e)) }
    finally { setIsScanning(false) }
  }

  async function removeSelected() {
    setIsRemoving(true)
    try {
      const packages = apps.filter(a => selected.has(a.name)).map(a => a.name)
      const msg = await invoke<string>("remove_bloatware", { packages })
      setResult(msg)
      await scan()
    } catch (e) { toast.error(String(e)) }
    finally { setIsRemoving(false) }
  }

  function toggle(name: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const filtered = filter === "all" ? apps : apps.filter(a => a.category === filter)
  const counts = { safe: apps.filter(a => a.category === "safe").length, caution: apps.filter(a => a.category === "caution").length, keep: apps.filter(a => a.category === "keep").length }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Windows Debloater</h1>
        <p className="text-sm text-muted-foreground mt-1">Remove pre-installed bloatware and unnecessary AppX packages</p>
      </div>

      <div className="flex gap-3">
        <Button onClick={scan} disabled={isScanning} className="gap-2">
          {isScanning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Scan Installed Apps
        </Button>
        {selected.size > 0 && (
          <Button variant="destructive" onClick={removeSelected} disabled={isRemoving} className="gap-2">
            {isRemoving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Remove {selected.size} Selected
          </Button>
        )}
      </div>

      {apps.length > 0 && (
        <>
          <div className="flex gap-2">
            {["all", "safe", "caution", "keep"].map(f => (
              <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="text-xs capitalize">
                {f} {f !== "all" && `(${counts[f as keyof typeof counts]})`}
              </Button>
            ))}
          </div>

          <div className="space-y-1.5">
            {filtered.map(app => (
              <Card key={app.name} className={`${selected.has(app.name) ? "ring-1 ring-primary" : ""}`}>
                <CardContent className="p-3 flex items-center gap-3">
                  <Checkbox checked={selected.has(app.name)} onCheckedChange={() => toggle(app.name)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{app.name}</span>
                      <Badge variant="secondary" className={`text-[10px] ${app.category === "safe" ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : app.category === "caution" ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-slate-100 dark:bg-slate-500/15 text-slate-600"}`}>
                        {app.category === "safe" && <ShieldCheck className="h-3 w-3 mr-0.5" />}
                        {app.category === "caution" && <AlertTriangle className="h-3 w-3 mr-0.5" />}
                        {app.category === "keep" && <ShieldAlert className="h-3 w-3 mr-0.5" />}
                        {app.category}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {result && (
        <Card><CardContent className="p-3"><p className="text-sm text-emerald-600 font-medium">{result}</p></CardContent></Card>
      )}
    </div>
  )
}
