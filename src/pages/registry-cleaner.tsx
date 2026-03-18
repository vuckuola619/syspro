import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Database, Search, RefreshCw, Trash2, CheckCircle2, AlertTriangle } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"

interface RegistryIssue {
  id: string
  category: string
  key: string
  description: string
  severity: "low" | "medium" | "high"
  checked?: boolean
}

export default function RegistryCleanerPage() {
  const [isScanning, setIsScanning] = useState(false)
  const [hasScanned, setHasScanned] = useState(false)
  const [hasCleaned, setHasCleaned] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [issues, setIssues] = useState<RegistryIssue[]>([])

  async function startScan() {
    setIsScanning(true)
    setHasCleaned(false)
    setScanProgress(0)
    const interval = setInterval(() => {
      setScanProgress((p) => {
        if (p >= 100) { clearInterval(interval); return 100 }
        return p + 8
      })
    }, 100)

    try {
      const result = await invoke<RegistryIssue[]>("scan_registry_issues")
      clearInterval(interval)
      setScanProgress(100)
      setIssues(result.map(i => ({ ...i, checked: true })))
      setHasScanned(true)
    } catch (e) {
      console.error(e)
      clearInterval(interval)
    } finally {
      setIsScanning(false)
    }
  }

  function toggleIssue(id: string) {
    setIssues((prev) => prev.map((i) => i.id === id ? { ...i, checked: !i.checked } : i))
  }

  async function cleanSelected() {
    const ids = issues.filter(i => i.checked).map(i => i.id)
    if (ids.length === 0) return
    try {
      await invoke("clean_registry_issues", { issueIds: ids })
      setHasCleaned(true)
    } catch (e) {
      console.error(e)
    }
  }

  const selectedCount = issues.filter((i) => i.checked).length
  const severityColors = {
    high: "bg-red-50 text-red-700 border-red-200",
    medium: "bg-amber-50 text-amber-700 border-amber-200",
    low: "bg-blue-50 text-blue-700 border-blue-200",
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Registry Cleaner</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Scan and fix invalid Windows registry entries to improve system stability
        </p>
      </div>

      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="flex items-start gap-3 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-900">Proceed with caution</p>
            <p className="text-xs text-amber-700 mt-0.5">
              A backup of registry entries will be created before any changes are made. Registry cleaning is generally safe, but review items before applying fixes.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          {isScanning ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm font-medium">Scanning registry...</span>
                </div>
                <span className="text-sm text-muted-foreground">{scanProgress}%</span>
              </div>
              <Progress value={scanProgress} />
            </div>
          ) : hasCleaned ? (
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Registry cleaned successfully</p>
                <p className="text-sm text-muted-foreground">Fixed {selectedCount} issues. Backup saved.</p>
              </div>
              <Button variant="outline" onClick={startScan} className="gap-2">
                <Search className="h-4 w-4" /> Scan Again
              </Button>
            </div>
          ) : hasScanned ? (
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
                <Database className="h-6 w-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Found {issues.length} registry issues</p>
                <p className="text-sm text-muted-foreground">Review and select items to fix</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={startScan} className="gap-2">
                  <Search className="h-4 w-4" /> Re-scan
                </Button>
                <Button onClick={cleanSelected} disabled={selectedCount === 0} className="gap-2">
                  <Trash2 className="h-4 w-4" /> Fix {selectedCount} Issues
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
                <Search className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Scan for registry issues</p>
                <p className="text-sm text-muted-foreground">
                  Find and fix invalid, orphaned, or obsolete registry entries
                </p>
              </div>
              <Button onClick={startScan} className="gap-2">
                <Search className="h-4 w-4" /> Start Scan
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {hasScanned && !hasCleaned && (
        <div className="space-y-2">
          {issues.map((issue) => (
            <Card
              key={issue.id}
              className={`cursor-pointer transition-colors ${issue.checked ? "border-primary/30 bg-primary/[0.02]" : ""}`}
              onClick={() => toggleIssue(issue.id)}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{issue.category}</p>
                    <Badge variant="outline" className={`text-[10px] ${severityColors[issue.severity]}`}>
                      {issue.severity}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{issue.description}</p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5 font-mono">{issue.key}</p>
                </div>
                <div className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-colors ${issue.checked ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
                  {issue.checked && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
