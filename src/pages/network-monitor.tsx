import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Network, RefreshCw, Search } from "lucide-react"
import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"

interface Connection {
  local_address: string; local_port: number; remote_address: string; remote_port: number
  state: string; process_name: string; pid: number
}

export default function NetworkMonitorPage() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [search, setSearch] = useState("")

  async function load() {
    setIsLoading(true)
    try { setConnections(await invoke<Connection[]>("get_network_connections")) }
    catch (e) { console.error(e) }
    finally { setIsLoading(false) }
  }

  const filtered = connections.filter(c =>
    c.process_name.toLowerCase().includes(search.toLowerCase()) ||
    c.remote_address.includes(search) ||
    c.local_port.toString().includes(search)
  )
  const listening = connections.filter(c => c.state === "Listen").length
  const established = connections.filter(c => c.state === "Established").length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Network Monitor</h1>
          <p className="text-sm text-muted-foreground mt-1">View active network connections per process</p>
        </div>
        <Button onClick={load} disabled={isLoading} className="gap-2">
          {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Network className="h-4 w-4" />}
          Scan Connections
        </Button>
      </div>

      {connections.length > 0 && (
        <div className="flex gap-3 items-center">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Filter by process, address, port..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">Established: {established}</Badge>
          <Badge variant="secondary" className="bg-blue-50 text-blue-700">Listening: {listening}</Badge>
        </div>
      )}

      <div className="space-y-1">
        {filtered.map((c, i) => (
          <Card key={i}>
            <CardContent className="p-2.5 flex items-center gap-3 text-xs">
              <div className={`h-2 w-2 rounded-full ${c.state === "Established" ? "bg-emerald-500" : "bg-blue-500"}`} />
              <span className="font-semibold w-32 truncate">{c.process_name}</span>
              <span className="text-muted-foreground w-8 text-right">{c.pid}</span>
              <span className="flex-1 font-mono truncate">{c.local_address}:{c.local_port}</span>
              <span className="text-muted-foreground">→</span>
              <span className="flex-1 font-mono truncate">{c.remote_address}:{c.remote_port}</span>
              <Badge variant="outline" className="text-[10px]">{c.state}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
