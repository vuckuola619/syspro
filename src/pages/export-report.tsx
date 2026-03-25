import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileDown, RefreshCw, Clipboard, CheckCircle2, FileText } from "lucide-react"
import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"
export default function ExportReportPage() {
  const [report, setReport] = useState("")
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState("")

  async function generate() {
    setLoading(true)
    setSaved("")
    try {
      const data = await invoke<string>("generate_iso27001_report")
      setReport(data)
      toast.success("Report generated successfully")
    } catch (e) { toast.error("Failed to generate report: " + String(e)) }
    finally { setLoading(false) }
  }

  async function saveToFile() {
    try {
      const blob = new Blob([report], { type: "text/plain" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `SABI_ISO27001_Report_${new Date().toISOString().slice(0, 10)}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setSaved("Downloads folder")
      toast.success("Saved ISO 27001 Report to Downloads")
    } catch (e) { toast.error("Failed to save: " + String(e)) }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(report)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Export ISO 27001 Report</h1>
          <p className="text-sm text-muted-foreground mt-1">Generate a comprehensive ISO 27001-compliant system audit report</p>
        </div>
        <Button onClick={generate} disabled={loading} className="gap-2">
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
          {loading ? "Generating..." : "Generate Report"}
        </Button>
      </div>

      {!report && !loading && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Click "Generate Report" to create a full system audit report</p>
            <p className="text-xs mt-2">Includes: OS details, BitLocker encryption status, Local Administrators, Firewall Rules, Antivirus Status, and Network Adapters</p>
          </CardContent>
        </Card>
      )}

      {report && (
        <>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={saveToFile} className="gap-1.5">
              <FileDown className="h-3.5 w-3.5" /> Save as .txt
            </Button>
            <Button variant="outline" size="sm" onClick={copyToClipboard} className="gap-1.5">
              {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Clipboard className="h-3.5 w-3.5" />}
              {copied ? "Copied!" : "Copy to Clipboard"}
            </Button>
          </div>

          {saved && (
            <Card className="border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10/30">
              <CardContent className="flex items-center gap-2 p-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <p className="text-sm text-emerald-800 dark:text-emerald-200">Saved to: {saved}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4">
              <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-[60vh] overflow-y-auto">
                {report}
              </pre>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
