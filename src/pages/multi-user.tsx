import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, RefreshCw } from "lucide-react"
import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"

interface UserProfile {
  username: string
  profile_path: string
  size_display: string
  size_bytes: number
  last_use_time: string
  is_active: boolean
  sid: string
}

export default function MultiUserPage() {
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [isLoading, setIsLoading] = useState(false)

  async function load() {
    setIsLoading(true)
    try {
      const data = await invoke<UserProfile[]>("get_user_profiles")
      const safeData = Array.isArray(data) ? data : []
      setProfiles(safeData)
      toast.success(`Found ${safeData.length} user profile(s)`)
    } catch (e) { toast.error(String(e)) }
    finally { setIsLoading(false) }
  }

  const activeCount = profiles.filter(p => p.is_active).length
  const totalSize = profiles.reduce((s, p) => s + (p.size_bytes ?? 0), 0)
  const totalDisplay = totalSize >= 1073741824 ? `${(totalSize / 1073741824).toFixed(1)} GB` :
    totalSize >= 1048576 ? `${(totalSize / 1048576).toFixed(1)} MB` : `${(totalSize / 1024).toFixed(1)} KB`

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Multi-User</h1>
        <p className="text-sm text-muted-foreground mt-1">View Windows user profiles, disk usage, and activity</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:border-primary/30 transition-colors" onClick={load}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10">
              {isLoading ? <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" /> : <Users className="h-5 w-5 text-blue-600" />}
            </div>
            <div>
              <p className="text-sm font-medium">Scan Profiles</p>
              <p className="text-xs text-muted-foreground">{profiles.length > 0 ? `${profiles.length} profiles` : "Click to scan"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 dark:bg-green-500/10">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-muted-foreground">{activeCount} session(s)</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-50 dark:bg-purple-500/10">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Total Size</p>
              <p className="text-xs text-muted-foreground">{totalDisplay}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {profiles.length > 0 && (
        <div className="grid grid-cols-1 gap-2">
          {profiles.map(p => (
            <Card key={p.sid} className={p.is_active ? "border-green-200 dark:border-green-500/20" : ""}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-white font-bold text-lg">
                  {(p.username ?? "?").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{p.username}</span>
                    {p.is_active && <Badge variant="default" className="text-[10px]">Active</Badge>}
                    <Badge variant="secondary" className="text-[10px]">{p.size_display}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">{p.profile_path}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Last used: {p.last_use_time}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {profiles.length === 0 && !isLoading && (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Click "Scan Profiles" to enumerate Windows user accounts.</p>
            <p className="text-xs text-muted-foreground mt-1">View disk usage, last login time, and active sessions per user.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
