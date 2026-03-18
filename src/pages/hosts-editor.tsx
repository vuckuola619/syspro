import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { FileText, RefreshCw, Plus, ShieldBan } from "lucide-react"
import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"

interface HostsEntry {
  ip: string; hostname: string; comment: string; enabled: boolean
}

export default function HostsEditorPage() {
  const [entries, setEntries] = useState<HostsEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [newIp, setNewIp] = useState("0.0.0.0")
  const [newHost, setNewHost] = useState("")
  const [result, setResult] = useState("")

  async function load() {
    setIsLoading(true)
    try { setEntries(await invoke<HostsEntry[]>("read_hosts_file")) }
    catch (e) { console.error(e) }
    finally { setIsLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function addEntry() {
    if (!newHost.trim()) return
    try {
      await invoke("add_hosts_entry", { ip: newIp, hostname: newHost.trim() })
      setNewHost("")
      setResult(`Added ${newIp} → ${newHost}`)
      await load()
    } catch (e: unknown) { setResult(String(e)) }
  }

  async function blockTelemetry() {
    try {
      const msg = await invoke<string>("block_telemetry_hosts")
      setResult(msg)
      await load()
    } catch (e: unknown) { setResult(String(e)) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Hosts File Editor</h1>
          <p className="text-sm text-muted-foreground mt-1">Edit the Windows hosts file and block telemetry domains</p>
        </div>
        <div className="flex gap-2">
          <Button variant="destructive" onClick={blockTelemetry} className="gap-2" size="sm">
            <ShieldBan className="h-4 w-4" /> Block Telemetry
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={isLoading}>
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-3 flex gap-2 items-center">
          <Input value={newIp} onChange={e => setNewIp(e.target.value)} className="w-40 font-mono text-xs" placeholder="0.0.0.0" />
          <Input value={newHost} onChange={e => setNewHost(e.target.value)} className="flex-1 font-mono text-xs" placeholder="hostname.example.com" />
          <Button size="sm" onClick={addEntry} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </CardContent>
      </Card>

      {result && <Card><CardContent className="p-2 text-xs font-medium">{result}</CardContent></Card>}

      <div className="space-y-1">
        {entries.map((e, i) => (
          <Card key={i} className={e.enabled ? "" : "opacity-50"}>
            <CardContent className="p-2.5 flex items-center gap-3 text-xs font-mono">
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="w-32 text-blue-600">{e.ip}</span>
              <span className="flex-1 truncate">{e.hostname}</span>
              {!e.enabled && <Badge variant="outline" className="text-[10px]">Disabled</Badge>}
              {e.comment && <span className="text-muted-foreground text-[10px]">{e.comment}</span>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
