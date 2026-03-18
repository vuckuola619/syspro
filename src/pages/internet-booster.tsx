import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Wifi, RefreshCw, Zap, CheckCircle2, Globe } from "lucide-react"
import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"

interface DnsResult {
  name: string
  primary: string
  secondary: string
  latency_ms: number
  is_current: boolean
}

export default function InternetBoosterPage() {
  const [isTesting, setIsTesting] = useState(false)
  const [isFlushing, setIsFlushing] = useState(false)
  const [isSetting, setIsSetting] = useState<string | null>(null)
  const [results, setResults] = useState<DnsResult[]>([])
  const [flushResult, setFlushResult] = useState("")
  const [setDnsResult, setSetDnsResult] = useState("")

  async function testDns() {
    setIsTesting(true)
    try {
      const data = await invoke<DnsResult[]>("test_dns_servers")
      setResults(data)
    } catch (e) { console.error(e) }
    finally { setIsTesting(false) }
  }

  async function flushDns() {
    setIsFlushing(true)
    try {
      const msg = await invoke<string>("flush_dns")
      setFlushResult(msg)
    } catch (e) { console.error(e) }
    finally { setIsFlushing(false) }
  }

  async function applyDns(dns: DnsResult) {
    setIsSetting(dns.name)
    try {
      const msg = await invoke<string>("set_dns_server", { primary: dns.primary, secondary: dns.secondary })
      setSetDnsResult(msg)
    } catch (e) { console.error(e) }
    finally { setIsSetting(null) }
  }


  function latencyBg(ms: number) {
    if (ms < 30) return "bg-emerald-50 text-emerald-700"
    if (ms < 80) return "bg-amber-50 text-amber-700"
    return "bg-red-50 text-red-700"
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Internet Booster</h1>
        <p className="text-sm text-muted-foreground mt-1">Optimize DNS, flush cache, and speed up your connection</p>
      </div>

      <div className="flex gap-3">
        <Button onClick={testDns} disabled={isTesting} className="gap-2">
          {isTesting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
          Test DNS Servers
        </Button>
        <Button variant="outline" onClick={flushDns} disabled={isFlushing} className="gap-2">
          {isFlushing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          Flush DNS Cache
        </Button>
      </div>

      {flushResult && (
        <Card className="border-emerald-200 bg-emerald-50/30">
          <CardContent className="flex items-center gap-2 p-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <p className="text-sm text-emerald-800">{flushResult.trim()}</p>
          </CardContent>
        </Card>
      )}

      {setDnsResult && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardContent className="flex items-center gap-2 p-3">
            <Wifi className="h-4 w-4 text-blue-600" />
            <p className="text-sm text-blue-800">{setDnsResult}</p>
          </CardContent>
        </Card>
      )}

      {results.length > 0 && (
        <div className="space-y-1">
          {results.map((dns, i) => (
            <Card key={dns.name} className={i === 0 ? "border-emerald-200" : ""}>
              <CardContent className="flex items-center gap-4 p-3 px-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
                  <Globe className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{dns.name}</p>
                    {i === 0 && <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Fastest</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{dns.primary} / {dns.secondary}</p>
                </div>
                <Badge variant="secondary" className={latencyBg(dns.latency_ms)}>
                  {dns.latency_ms < 9999 ? `${dns.latency_ms}ms` : "Timeout"}
                </Badge>
                <Button
                  size="sm" variant="outline"
                  onClick={() => applyDns(dns)}
                  disabled={isSetting === dns.name}
                  className="gap-1.5 text-xs h-7 px-2"
                >
                  {isSetting === dns.name ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                  Apply
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
