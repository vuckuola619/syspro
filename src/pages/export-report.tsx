import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileDown, RefreshCw, Clipboard, CheckCircle2, FileText, FileSpreadsheet, Shield } from "lucide-react"
import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"

interface Iso27001Report {
  txt: string
  csv: string
}

export default function ExportReportPage() {
  const [report, setReport] = useState<Iso27001Report | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function generate() {
    setLoading(true)
    try {
      const data = await invoke<Iso27001Report>("generate_iso27001_report")
      setReport(data)
      toast.success("ISO 27001 audit report generated (15 sections)")
    } catch (e) { toast.error("Failed to generate report: " + String(e)) }
    finally { setLoading(false) }
  }

  function downloadFile(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function saveTxt() {
    if (!report) return
    const date = new Date().toISOString().slice(0, 10)
    downloadFile(report.txt, `SABI_ISO27001_Audit_${date}.txt`, "text/plain")
    toast.success("Saved TXT report to Downloads")
  }

  function saveCsv() {
    if (!report) return
    const date = new Date().toISOString().slice(0, 10)
    downloadFile(report.csv, `SABI_ISO27001_Audit_${date}.csv`, "text/csv")
    toast.success("Saved CSV report to Downloads")
  }

  function copyToClipboard() {
    if (!report) return
    navigator.clipboard.writeText(report.txt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success("Report copied to clipboard")
  }

  const sectionCount = report?.txt ? (report.txt.match(/^\d+\.\s/gm) || []).length : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-600" />
            ISO 27001 Audit Report
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Comprehensive information security audit — 15 sections covering Annex A controls
          </p>
        </div>
        <Button onClick={generate} disabled={loading} className="gap-2">
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
          {loading ? "Scanning System..." : "Generate Report"}
        </Button>
      </div>

      {!report && !loading && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Shield className="h-14 w-14 mx-auto mb-4 opacity-20" />
            <p className="font-medium text-base">Click "Generate Report" to create a full ISO 27001 system audit</p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-xs max-w-xl mx-auto">
              {[
                "System & Hardware ID", "BIOS / TPM / Secure Boot", "BitLocker Encryption",
                "Users & Access Control", "Password & Lockout Policy", "Audit Policy (Logging)",
                "Firewall Rules & Config", "Antivirus & Defender", "Installed Software",
                "Windows Update Patches", "Running Services", "Network Configuration",
                "Shared Folders", "USB & Removable Devices", "Scheduled Tasks"
              ].map((s, i) => (
                <div key={i} className="bg-muted/50 rounded-md px-2 py-1.5 font-mono">
                  {i + 1}. {s}
                </div>
              ))}
            </div>
            <p className="text-xs mt-4 opacity-60">Export as TXT (human-readable) or CSV (spreadsheet / audit tool import)</p>
          </CardContent>
        </Card>
      )}

      {loading && (
        <Card>
          <CardContent className="p-8 text-center">
            <RefreshCw className="h-10 w-10 mx-auto mb-3 animate-spin text-blue-600" />
            <p className="font-medium">Scanning system across 15 security categories...</p>
            <p className="text-xs text-muted-foreground mt-1">This may take 15-30 seconds depending on system configuration</p>
          </CardContent>
        </Card>
      )}

      {report && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="default" size="sm" onClick={saveTxt} className="gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Download .txt
            </Button>
            <Button variant="default" size="sm" onClick={saveCsv} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
              <FileSpreadsheet className="h-3.5 w-3.5" /> Download .csv
            </Button>
            <Button variant="outline" size="sm" onClick={copyToClipboard} className="gap-1.5">
              {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Clipboard className="h-3.5 w-3.5" />}
              {copied ? "Copied!" : "Copy to Clipboard"}
            </Button>
            <span className="text-xs text-muted-foreground ml-auto">
              {sectionCount} sections · {report.txt.split('\n').length} lines · {(report.csv.split('\n').length - 1)} CSV rows
            </span>
          </div>

          <Card>
            <CardContent className="p-4">
              <pre className="text-[11px] font-mono whitespace-pre-wrap leading-relaxed max-h-[65vh] overflow-y-auto">
                {report.txt}
              </pre>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
