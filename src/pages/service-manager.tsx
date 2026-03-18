import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Server, RefreshCw, Search, Play, Square, Ban } from "lucide-react"
import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"

interface ServiceItem {
  name: string; display_name: string; status: string; start_type: string; can_stop: boolean
}

export default function ServiceManagerPage() {
  const [services, setServices] = useState<ServiceItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [acting, setActing] = useState<string | null>(null)
  const [result, setResult] = useState("")

  async function load() {
    setIsLoading(true)
    try { setServices(await invoke<ServiceItem[]>("get_services")) }
    catch (e) { console.error(e) }
    finally { setIsLoading(false) }
  }

  async function act(name: string, action: string) {
    setActing(name)
    try {
      const msg = await invoke<string>("set_service_status", { serviceName: name, action })
      setResult(msg)
      await load()
    } catch (e: unknown) { setResult(String(e)) }
    finally { setActing(null) }
  }

  const filtered = services.filter(s =>
    s.display_name.toLowerCase().includes(search.toLowerCase()) ||
    s.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Service Manager</h1>
          <p className="text-sm text-muted-foreground mt-1">View and control Windows services for performance optimization</p>
        </div>
        <Button onClick={load} disabled={isLoading} className="gap-2">
          {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Server className="h-4 w-4" />}
          Scan Services
        </Button>
      </div>

      {services.length > 0 && (
        <div className="flex gap-2 items-center">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search services..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
          <Badge variant="outline">{filtered.length} / {services.length}</Badge>
        </div>
      )}

      {result && <Card><CardContent className="p-2 text-xs">{result}</CardContent></Card>}

      <div className="space-y-1">
        {filtered.slice(0, 100).map(s => (
          <Card key={s.name}>
            <CardContent className="p-2.5 flex items-center gap-3">
              <div className={`h-2 w-2 rounded-full ${s.status === "Running" ? "bg-emerald-500" : s.status === "Stopped" ? "bg-red-400" : "bg-amber-400"}`} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-xs truncate">{s.display_name}</p>
                <p className="text-[10px] text-muted-foreground">{s.name} · {s.start_type}</p>
              </div>
              <Badge variant="secondary" className={`text-[10px] ${s.status === "Running" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100"}`}>
                {s.status}
              </Badge>
              <div className="flex gap-1">
                {s.status !== "Running" && (
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => act(s.name, "start")} disabled={acting === s.name}>
                    <Play className="h-3 w-3" />
                  </Button>
                )}
                {s.can_stop && s.status === "Running" && (
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => act(s.name, "stop")} disabled={acting === s.name}>
                    <Square className="h-3 w-3" />
                  </Button>
                )}
                {s.start_type !== "Disabled" && (
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => act(s.name, "disable")} disabled={acting === s.name}>
                    <Ban className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
