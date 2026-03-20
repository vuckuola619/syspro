import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Shield, Globe, FileText, Search, RefreshCw, Trash2, CheckCircle2 } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"

interface PrivacyCategory {
  id: string
  name: string
  items_count: number
  icon?: React.ReactNode
  checked?: boolean
}

export default function PrivacyPage() {
  const [hasScanned, setHasScanned] = useState(false)
  const [hasCleaned, setHasCleaned] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [categories, setCategories] = useState<PrivacyCategory[]>([])

  async function startScan() {
    setIsScanning(true)
    setHasCleaned(false)
    setScanProgress(0)

    const interval = setInterval(() => setScanProgress((p) => Math.min(p + 15, 90)), 200)
    
    try {
      const result = await invoke<{ categories: PrivacyCategory[] }>("scan_privacy_traces")
      clearInterval(interval)
      setScanProgress(100)
      
      const getIcon = (id: string) => {
        if (id.includes("browser") || id === "cache") return <Globe className="h-5 w-5" />
        if (id === "cookies") return <Shield className="h-5 w-5" />
        if (id === "recent_docs") return <FileText className="h-5 w-5" />
        return <Search className="h-5 w-5" />
      }

      const mappedCategories = result.categories.map((c: PrivacyCategory) => ({
        ...c,
        icon: getIcon(c.id),
        checked: true
      }))
      
      setCategories(mappedCategories)
      setHasScanned(true)
    } catch (e) {
     toast.error("Operation failed: " + String(e))

      toast.error(String(e))
      clearInterval(interval)
    } finally {
      setIsScanning(false)
    }
  }

  async function startClean() {
    const categoriesToClean = categories.filter((c) => c.checked).map((c) => c.id)
    if (categoriesToClean.length === 0) return

    setIsScanning(true)
    setScanProgress(0)
    const interval = setInterval(() => setScanProgress((p) => Math.min(p + 20, 95)), 150)

    try {
      await invoke("clean_privacy_traces", { categoryIds: categoriesToClean })
      clearInterval(interval)
      setScanProgress(100)
      
      setCategories(categories.map(c => 
        categoriesToClean.includes(c.id) ? { ...c, items_count: 0 } : c
      ))
      
      setTimeout(() => {
        setHasCleaned(true)
        setIsScanning(false)
      }, 500)
    } catch (e) {
     toast.error("Operation failed: " + String(e))

      toast.error(String(e))
      clearInterval(interval)
      setIsScanning(false)
    }
  }

  function toggleCategory(id: string) {
    setCategories((prev) => prev.map((c) => c.id === id ? { ...c, checked: !c.checked } : c))
  }

  const totalItems = categories.filter((c) => c.checked).reduce((s, c) => s + c.items_count, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Privacy</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Remove browsing history, cookies, and tracking data to protect your privacy
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          {isScanning ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm font-medium">Scanning for privacy traces...</span>
                </div>
                <span className="text-sm text-muted-foreground">{scanProgress}%</span>
              </div>
              <Progress value={scanProgress} />
            </div>
          ) : hasCleaned ? (
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-500/10">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Privacy traces removed</p>
                <p className="text-sm text-muted-foreground">Cleaned {totalItems.toLocaleString()} items</p>
              </div>
              <Button variant="outline" onClick={startScan} className="gap-2"><Search className="h-4 w-4" /> Scan Again</Button>
            </div>
          ) : hasScanned ? (
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-500/10">
                <Shield className="h-6 w-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Found {totalItems.toLocaleString()} privacy traces</p>
                <p className="text-sm text-muted-foreground">Select categories below and clean</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={startScan} className="gap-2"><Search className="h-4 w-4" /> Re-scan</Button>
                <Button onClick={startClean} className="gap-2" disabled={isScanning}>
                  {isScanning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Clean All
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10">
                <Shield className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Scan for privacy traces</p>
                <p className="text-sm text-muted-foreground">Find browser history, cookies, and tracking data</p>
              </div>
              <Button onClick={startScan} className="gap-2"><Search className="h-4 w-4" /> Start Scan</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {hasScanned && !hasCleaned && (
        <div className="space-y-2">
          {categories.map((cat) => (
            <Card key={cat.id} className={`cursor-pointer transition-colors ${cat.checked ? "border-primary/30 bg-primary/[0.02]" : ""}`} onClick={() => toggleCategory(cat.id)}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${cat.checked ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {cat.icon}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{cat.name}</p>
                  <p className="text-xs text-muted-foreground">{cat.items_count.toLocaleString()} items found</p>
                </div>
                <div className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-colors ${cat.checked ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
                  {cat.checked && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
