import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { FileText, RefreshCw, Plus, ShieldBan, Trash2, PenLine } from "lucide-react"
import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"

interface HostsEntry {
  ip: string; hostname: string; comment: string; enabled: boolean
}

export default function HostsEditorPage() {
  const [entries, setEntries] = useState<HostsEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [newIp, setNewIp] = useState("0.0.0.0")
  const [newHost, setNewHost] = useState("")
  const [result, setResult] = useState("")
  const [removing, setRemoving] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ ip: string; hostname: string } | null>(null)

  async function load() {
    setIsLoading(true)
    try { setEntries(await invoke<HostsEntry[]>("read_hosts_file")) }
    catch (e) { toast.error(String(e)) }
    finally { setIsLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function addEntry() {
    if (!newHost.trim()) return
    try {
      if (editing) {
        await invoke("remove_hosts_entry", { ip: editing.ip, hostname: editing.hostname })
        setEditing(null)
      }
      await invoke("add_hosts_entry", { ip: newIp, hostname: newHost.trim() })
      setNewHost("")
      setNewIp("0.0.0.0")
      setResult(editing ? `Updated → ${newHost}` : `Added ${newIp} → ${newHost}`)
      await load()
    } catch (e: unknown) { setResult(String(e)) }
  }

  function startEdit(ip: string, hostname: string) {
    setEditing({ ip, hostname })
    setNewIp(ip)
    setNewHost(hostname)
  }

  async function removeEntry(ip: string, hostname: string) {
    const key = `${ip}_${hostname}`
    setRemoving(key)
    try {
      await invoke("remove_hosts_entry", { ip, hostname })
      setResult(`Removed ${ip} → ${hostname}`)
      await load()
    } catch (e: unknown) { setResult(String(e)) }
    finally { setRemoving(null) }
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
          <Button size="sm" onClick={addEntry} className="gap-1.5" variant={editing ? "default" : "secondary"}>
            {editing ? <><RefreshCw className="h-3.5 w-3.5" /> Save</> : <><Plus className="h-3.5 w-3.5" /> Add</>}
          </Button>
          {editing && (
            <Button size="sm" variant="ghost" onClick={() => { setEditing(null); setNewIp("0.0.0.0"); setNewHost("") }}>Cancel</Button>
          )}
        </CardContent>
      </Card>

      {result && <Card><CardContent className="p-2 text-xs font-medium">{result}</CardContent></Card>}

      <div className="space-y-1">
        {entries.map((e, i) => {
          const key = `${e.ip}_${e.hostname}`
          const isComment = e.hostname.startsWith("#") || e.comment.startsWith("#")
          return (
            <Card key={i} className={e.enabled ? "" : "opacity-50"}>
              <CardContent className="p-2.5 flex items-center gap-3 text-xs font-mono">
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="w-32 text-blue-600">{e.ip}</span>
                <span className="flex-1 truncate">{e.hostname}</span>
                {!e.enabled && <Badge variant="outline" className="text-[10px]">Disabled</Badge>}
                {e.comment && <span className="text-muted-foreground text-[10px]">{e.comment}</span>}
                {!isComment && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-blue-600"
                      onClick={(ev) => { ev.stopPropagation(); startEdit(e.ip, e.hostname) }}
                      title="Edit entry"
                    >
                      <PenLine className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600"
                      onClick={(ev) => { ev.stopPropagation(); removeEntry(e.ip, e.hostname) }}
                      disabled={removing === key}
                      title="Delete entry"
                    >
                      {removing === key
                        ? <RefreshCw className="h-3 w-3 animate-spin" />
                        : <Trash2 className="h-3 w-3" />
                      }
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
