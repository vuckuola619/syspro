import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Shield, Search, RefreshCw, ToggleLeft, ToggleRight } from "lucide-react"
import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"

interface FirewallRule {
  name: string
  display_name: string
  direction: string
  action: string
  enabled: boolean
  program: string
  profile: string
}

export default function FirewallManagerPage() {
  const [rules, setRules] = useState<FirewallRule[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | "inbound" | "outbound">("all")
  const [toggling, setToggling] = useState<string | null>(null)

  async function loadRules() {
    setLoading(true)
    try {
      const result = await invoke<FirewallRule[]>("get_firewall_rules")
      setRules(result)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function toggleRule(name: string, enable: boolean) {
    setToggling(name)
    try {
      await invoke("toggle_firewall_rule", { ruleName: name, enable })
      setRules(prev => prev.map(r => r.name === name ? { ...r, enabled: enable } : r))
    } catch (e) { console.error(e) }
    finally { setToggling(null) }
  }

  const filtered = rules.filter(r => {
    const matchesSearch = r.display_name.toLowerCase().includes(search.toLowerCase()) || r.name.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filter === "all" || r.direction.toLowerCase() === filter
    return matchesSearch && matchesFilter
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Firewall Manager</h1>
        <p className="text-sm text-muted-foreground mt-1">View and manage Windows Firewall rules</p>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={loadRules} disabled={loading} className="gap-2">
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
          {rules.length === 0 ? "Load Firewall Rules" : "Refresh"}
        </Button>
        {rules.length > 0 && (
          <>
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                className="w-full rounded-md border bg-background px-9 py-2 text-sm"
                placeholder="Search rules..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-1 border rounded-md p-0.5">
              {(["all", "inbound", "outbound"] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 text-xs rounded ${filter === f ? "bg-primary text-white" : "text-muted-foreground hover:bg-accent"}`}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {filtered.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="text-sm font-medium">Firewall Rules ({filtered.length})</h3>
            </div>
            <div className="divide-y max-h-[500px] overflow-y-auto">
              {filtered.map(rule => (
                <div key={rule.name} className="flex items-center px-4 py-2.5 hover:bg-accent/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{rule.display_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${rule.direction === "Inbound" ? "bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300" : "bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300"}`}>
                        {rule.direction}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${rule.action === "Allow" ? "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-300"}`}>
                        {rule.action}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{rule.profile}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={toggling === rule.name}
                    onClick={() => toggleRule(rule.name, !rule.enabled)}
                    className={`gap-1.5 text-xs ${rule.enabled ? "text-emerald-600" : "text-muted-foreground"}`}
                  >
                    {toggling === rule.name ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : rule.enabled ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                    {rule.enabled ? "Enabled" : "Disabled"}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {rules.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <Shield className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground mt-3">Click "Load Firewall Rules" to view Windows Firewall rules</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
