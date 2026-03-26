import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Globe, RefreshCw, Shield, CheckCircle, AlertTriangle, RotateCcw } from "lucide-react"
import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"

interface DnsConfig {
  interface_name: string
  current_dns: string[]
  is_secure: boolean
}

interface DnsProvider {
  name: string
  primary: string
  secondary: string
  category: string
  description: string
}

const CATEGORY_COLORS: Record<string, string> = {
  Privacy: "#8b5cf6",
  Security: "#ef4444",
  General: "#3b82f6",
  "Family Safe": "#22c55e",
  "Ad Blocking": "#f59e0b",
}

export default function DnsProtectorPage() {
  const [configs, setConfigs] = useState<DnsConfig[]>([])
  const [providers, setProviders] = useState<DnsProvider[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedInterface, setSelectedInterface] = useState("")

  async function load() {
    setIsLoading(true)
    try {
      const [c, p] = await Promise.all([
        invoke<DnsConfig[]>("get_dns_config"),
        invoke<DnsProvider[]>("get_dns_providers_list"),
      ])
      setConfigs(c)
      setProviders(p)
      if (c.length > 0 && !selectedInterface) setSelectedInterface(c[0].interface_name)
      toast.success(`Found ${c.length} active interface(s)`)
    } catch (e) {
      toast.error(String(e))
    } finally {
      setIsLoading(false)
    }
  }

  async function applyProvider(provider: DnsProvider) {
    if (!selectedInterface) { toast.error("Select an interface first"); return }
    try {
      const msg = await invoke<string>("set_dns_provider", {
        interfaceName: selectedInterface, primary: provider.primary, secondary: provider.secondary,
      })
      toast.success(msg)
      load()
    } catch (e) {
      toast.error(String(e))
    }
  }

  async function resetDns() {
    if (!selectedInterface) return
    try {
      const msg = await invoke<string>("reset_dns_to_auto", { interfaceName: selectedInterface })
      toast.success(msg)
      load()
    } catch (e) {
      toast.error(String(e))
    }
  }

  const currentConfig = configs.find(c => c.interface_name === selectedInterface)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">DNS Protector</h1>
        <p className="text-sm text-muted-foreground mt-1">Switch to secure DNS providers to block threats and protect privacy</p>
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:border-primary/30 transition-colors" onClick={load}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10">
              {isLoading ? <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" /> : <Globe className="h-5 w-5 text-blue-600" />}
            </div>
            <div>
              <p className="text-sm font-medium">Load DNS Config</p>
              <p className="text-xs text-muted-foreground">{configs.length > 0 ? `${configs.length} interface(s)` : "Click to scan"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: currentConfig?.is_secure ? "#22c55e20" : "#ef444420" }}>
              {currentConfig?.is_secure ? <CheckCircle className="h-5 w-5 text-green-600" /> : <AlertTriangle className="h-5 w-5 text-red-500" />}
            </div>
            <div>
              <p className="text-sm font-medium">{currentConfig?.is_secure ? "Secure DNS" : "Standard DNS"}</p>
              <p className="text-xs text-muted-foreground">{currentConfig?.current_dns.join(", ") || "Not loaded"}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary/30 transition-colors" onClick={resetDns}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50 dark:bg-orange-500/10">
              <RotateCcw className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Reset to Auto</p>
              <p className="text-xs text-muted-foreground">Use DHCP default DNS</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Interface selector */}
      {configs.length > 1 && (
        <div className="flex gap-2">
          {configs.map(c => (
            <button
              key={c.interface_name}
              onClick={() => setSelectedInterface(c.interface_name)}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${selectedInterface === c.interface_name ? "bg-primary/10 border-primary text-primary" : "bg-muted/50 border-transparent hover:bg-muted"}`}
            >
              {c.interface_name}
            </button>
          ))}
        </div>
      )}

      {/* DNS Providers */}
      {providers.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-2"><Shield className="h-4 w-4" /> Secure DNS Providers</p>
          <div className="grid grid-cols-2 gap-2">
            {providers.map(p => {
              const color = CATEGORY_COLORS[p.category] || "#64748b"
              const isActive = currentConfig?.current_dns.includes(p.primary)
              return (
                <Card
                  key={p.name}
                  className={`cursor-pointer hover:border-primary/30 transition-colors ${isActive ? "border-green-300 dark:border-green-500/30 bg-green-50/50 dark:bg-green-500/5" : ""}`}
                  onClick={() => applyProvider(p)}
                >
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{p.name}</span>
                        <Badge className="text-[10px]" style={{ backgroundColor: color + "20", color, border: `1px solid ${color}40` }}>{p.category}</Badge>
                        {isActive && <Badge variant="default" className="text-[10px]">Active</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                      <p className="text-[10px] text-muted-foreground font-mono mt-1">{p.primary} / {p.secondary}</p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {configs.length === 0 && !isLoading && (
        <Card>
          <CardContent className="p-8 text-center">
            <Globe className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Click "Load DNS Config" to view current DNS settings.</p>
            <p className="text-xs text-muted-foreground mt-1">Switch to a secure provider for encrypted DNS and malware protection.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
