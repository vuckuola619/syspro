import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileX2, Upload, Trash2, AlertTriangle, RefreshCw } from "lucide-react"
import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"
import { open } from "@tauri-apps/plugin-dialog"

export default function FileShredderPage() {
  const [files, setFiles] = useState<string[]>([])
  const [isShredding, setIsShredding] = useState(false)
  const [done, setDone] = useState(false)

  async function selectFiles() {
    try {
      const selected = await open({
        multiple: true,
        title: "Select files to shred",
      })
      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected]
        setFiles(prev => [...new Set([...prev, ...paths as string[]])])
        setDone(false)
      }
    } catch (e) {
      toast.error(String(e))
    }
  }

  async function shredFiles() {
    if (files.length === 0) return
    setIsShredding(true)
    try {
      await invoke("shred_files", { filePaths: files })
      setDone(true)
      setFiles([])
    } catch (e) {
      toast.error(String(e))
    } finally {
      setIsShredding(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">File Shredder</h1>
        <p className="text-sm text-muted-foreground mt-1">Securely delete files so they cannot be recovered</p>
      </div>

      <Card className="border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10/50">
        <CardContent className="flex items-start gap-3 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">Files shredded cannot be recovered</p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">This operation overwrites file data multiple times using DoD 5220.22-M standard, making recovery impossible.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer" onClick={selectFiles}>
            <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm font-medium mt-3">Click to select files to shred</p>
            <p className="text-xs text-muted-foreground mt-1">Files will be permanently destroyed (DoD 3-pass)</p>
          </div>
        </CardContent>
      </Card>

      {files.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b"><h3 className="text-sm font-medium">Files to shred ({files.length})</h3></div>
            <div className="divide-y">
              {files.map((f, i) => (
                <div key={i} className="flex items-center px-4 py-2.5">
                  <FileX2 className="h-4 w-4 text-red-500 mr-3 shrink-0" />
                  <span className="text-sm truncate flex-1">{f}</span>
                  <button className="text-xs text-muted-foreground hover:text-red-500" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}>Remove</button>
                </div>
              ))}
            </div>
            <div className="p-4 border-t">
              <Button onClick={shredFiles} disabled={isShredding} variant="destructive" className="gap-2">
                {isShredding ? <><RefreshCw className="h-4 w-4 animate-spin" /> Shredding...</> : <><Trash2 className="h-4 w-4" /> Shred {files.length} File(s)</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {done && (
        <Card className="border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10/50">
          <CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">All files have been securely shredded</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
