import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { UserCheck, RefreshCw, AlertTriangle, CheckCircle } from "lucide-react"
import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"

interface LoginEvent {
  event_type: string
  timestamp: string
  username: string
  source_ip: string
  logon_type: string
  status: string
}

export default function LoginMonitorPage() {
  const [events, setEvents] = useState<LoginEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [filterType, setFilterType] = useState("All")

  async function load() {
    setIsLoading(true)
    try {
      const data = await invoke<LoginEvent[]>("get_login_events", { maxEvents: 100 })
      setEvents(data)
      const failed = data.filter(e => e.status === "Failed").length
      toast.success(`Loaded ${data.length} login events${failed > 0 ? ` (${failed} failed!)` : ""}`)
    } catch (e) {
      toast.error(String(e))
    } finally {
      setIsLoading(false)
    }
  }

  const failedCount = events.filter(e => e.status === "Failed").length
  const successCount = events.filter(e => e.status === "Success").length
  const uniqueUsers = new Set(events.map(e => e.username)).size

  const filtered = events.filter(e => {
    if (filterType === "All") return true
    if (filterType === "Success") return e.status === "Success"
    if (filterType === "Failed") return e.status === "Failed"
    return true
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Login Monitor</h1>
        <p className="text-sm text-muted-foreground mt-1">Monitor Windows login events — detect unauthorized access attempts</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:border-primary/30 transition-colors" onClick={load}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10">
              {isLoading ? <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" /> : <UserCheck className="h-5 w-5 text-blue-600" />}
            </div>
            <div>
              <p className="text-sm font-medium">Load Events</p>
              <p className="text-xs text-muted-foreground">{events.length > 0 ? `${events.length} events` : "Click to load"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 dark:bg-green-500/10">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Successful</p>
              <p className="text-xs text-muted-foreground">{successCount} logins</p>
            </div>
          </CardContent>
        </Card>

        <Card className={failedCount > 0 ? "border-red-200 dark:border-red-500/20" : ""}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 dark:bg-red-500/10">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Failed</p>
              <p className="text-xs text-muted-foreground">{failedCount} attempts</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-50 dark:bg-purple-500/10">
              <UserCheck className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Users</p>
              <p className="text-xs text-muted-foreground">{uniqueUsers} unique</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      {events.length > 0 && (
        <div className="flex gap-2">
          {["All", "Success", "Failed"].map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${filterType === t ? "bg-primary/10 border-primary text-primary" : "bg-muted/50 border-transparent hover:bg-muted"}`}
            >
              {t === "All" && `📋 All (${events.length})`}
              {t === "Success" && `✅ Success (${successCount})`}
              {t === "Failed" && `❌ Failed (${failedCount})`}
            </button>
          ))}
        </div>
      )}

      {/* Event list */}
      {filtered.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-auto max-h-[500px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background border-b">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Time</th>
                    <th className="px-4 py-2">User</th>
                    <th className="px-4 py-2">Source</th>
                    <th className="px-4 py-2">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e, i) => (
                    <tr key={i} className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${e.status === "Failed" ? "bg-red-50/50 dark:bg-red-500/5" : ""}`}>
                      <td className="px-4 py-2">
                        <Badge
                          variant={e.status === "Success" ? "default" : "destructive"}
                          className="text-[10px]"
                        >
                          {e.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">{e.timestamp}</td>
                      <td className="px-4 py-2 font-medium">{e.username}</td>
                      <td className="px-4 py-2 text-muted-foreground">{e.source_ip}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{e.logon_type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {events.length === 0 && !isLoading && (
        <Card>
          <CardContent className="p-8 text-center">
            <UserCheck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Click "Load Events" to view recent login activity.</p>
            <p className="text-xs text-muted-foreground mt-1">Reads Windows Security Event Log (Event IDs 4624/4625). Requires admin privileges.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
