import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileDown, RefreshCw, Clipboard, CheckCircle2, FileText } from "lucide-react"
import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { save } from "@tauri-apps/plugin-dialog"

export default function ExportReportPage() {
  const [report, setReport] = useState("")
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState("")

  async function generate() {
    setLoading(true)
    setSaved("")
    try {
      const data = await invoke<string>("export_system_report")
      setReport(data)
    } catch (e) { alert(String(e)) }
    finally { setLoading(false) }
  }

  async function saveToFile() {
    try {
      const path = await save({
        defaultPath: `SystemPro_Report_${new Date().toISOString().slice(0, 10)}.txt`,
        filters: [{ name: "Text", extensions: ["txt"] }],
      })
      if (path) {
        // Use a simple Rust command to write the file
        await invoke("save_text_file", { path, content: report })
        setSaved(path)
      }
    } catch (e) { alert(String(e)) }
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
          <h1 className="text-2xl font-semibold tracking-tight">Export System Report</h1>
          <p className="text-sm text-muted-foreground mt-1">Generate a comprehensive report of your device hardware and software</p>
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
            <p>Click "Generate Report" to create a full system report</p>
            <p className="text-xs mt-2">Includes: OS, CPU, RAM, storage, GPU, network, BIOS, startup programs, installed software</p>
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
            <Card className="border-emerald-200 bg-emerald-50/30">
              <CardContent className="flex items-center gap-2 p-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <p className="text-sm text-emerald-800">Saved to: {saved}</p>
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
