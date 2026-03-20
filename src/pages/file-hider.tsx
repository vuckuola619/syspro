import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { EyeOff, Eye, Lock, FolderLock, RefreshCw, Upload, Copy, Check, FileArchive } from "lucide-react"
import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"
import { open } from "@tauri-apps/plugin-dialog"

export default function FileHiderPage() {
  const [path, setPath] = useState("")
  const [password, setPassword] = useState("")
  const [unlockPath, setUnlockPath] = useState("")
  const [unlockPassword, setUnlockPassword] = useState("")
  const [hideResult, setHideResult] = useState("")
  const [unhideResult, setUnhideResult] = useState("")
  const [loading, setLoading] = useState(false)
  const [lockedFiles, setLockedFiles] = useState<string[]>([])
  const [copiedPath, setCopiedPath] = useState("")

  async function selectFile() {
    try {
      const selected = await open({ title: "Select file or folder to hide" })
      if (selected) setPath(selected as string)
    } catch (e) { toast.error(String(e)) }
  }

  async function selectLockedFile() {
    try {
      const selected = await open({ title: "Select .locked file or hidden folder", filters: [{ name: "Locked files", extensions: ["locked"] }, { name: "All files", extensions: ["*"] }] })
      if (selected) setUnlockPath(selected as string)
    } catch (e) { toast.error(String(e)) }
  }

  async function hideFile() {
    if (!path || !password) return
    setLoading(true)
    setHideResult("")
    try {
      const result = await invoke<string>("hide_file_or_folder", { path, password })
      setHideResult(result)
      const lockedPath = `${path}.locked`
      setLockedFiles(prev => [lockedPath, ...prev.filter(p => p !== lockedPath)])
      setPath("")
      setPassword("")
    } catch (e: any) { setHideResult(`Error: ${e}`) }
    finally { setLoading(false) }
  }

  async function unhideFile() {
    if (!unlockPath || !unlockPassword) return
    setLoading(true)
    setUnhideResult("")
    try {
      const result = await invoke<string>("unhide_file_or_folder", { path: unlockPath, password: unlockPassword })
      setUnhideResult(result)
      setLockedFiles(prev => prev.filter(p => p !== unlockPath))
      setUnlockPath("")
      setUnlockPassword("")
    } catch (e: any) { setUnhideResult(`Error: ${e}`) }
    finally { setLoading(false) }
  }

  function copyPath(p: string) {
    navigator.clipboard.writeText(p)
    setCopiedPath(p)
    setTimeout(() => setCopiedPath(""), 2000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">File / Folder Hider</h1>
        <p className="text-sm text-muted-foreground mt-1">Encrypt files with a password, or decrypt them later</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-500/15"><EyeOff className="h-5 w-5 text-purple-600" /></div>
              <div>
                <p className="text-sm font-medium">Encrypt File / Hide Folder</p>
                <p className="text-xs text-muted-foreground">File → encrypted .locked | Folder → hidden attribute</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors" onClick={selectFile}>
                <Upload className="h-5 w-5 mx-auto text-muted-foreground" />
                <p className="text-xs text-muted-foreground mt-1">{path || "Click to select file or folder"}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Password</label>
                <input type="password" className="w-full rounded-md border bg-background px-3 py-2 text-sm mt-1" placeholder="Enter password" value={password} onChange={e => setPassword(e.target.value)} />
              </div>
              <Button onClick={hideFile} disabled={!path || !password || loading} className="w-full gap-2">
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                Encrypt & Lock
              </Button>
              {hideResult && (
                <div className={`text-xs p-2 rounded ${hideResult.startsWith("Error") ? "bg-red-50 dark:bg-red-500/10 text-red-600" : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"}`}>
                  <p className="font-medium">{hideResult}</p>
                  {!hideResult.startsWith("Error") && <p className="mt-0.5 text-emerald-600">The .locked file is in the same folder as the original.</p>}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-500/15"><Eye className="h-5 w-5 text-emerald-600" /></div>
              <div>
                <p className="text-sm font-medium">Decrypt / Unhide</p>
                <p className="text-xs text-muted-foreground">Restore .locked files or unhide folders</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors" onClick={selectLockedFile}>
                <FolderLock className="h-5 w-5 mx-auto text-muted-foreground" />
                <p className="text-xs text-muted-foreground mt-1">{unlockPath || "Click to select .locked file or folder"}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Password</label>
                <input type="password" className="w-full rounded-md border bg-background px-3 py-2 text-sm mt-1" placeholder="Enter password" value={unlockPassword} onChange={e => setUnlockPassword(e.target.value)} />
              </div>
              <Button onClick={unhideFile} disabled={!unlockPath || !unlockPassword || loading} variant="outline" className="w-full gap-2">
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                Decrypt & Unlock
              </Button>
              {unhideResult && <p className={`text-xs ${unhideResult.startsWith("Error") ? "text-red-600" : "text-emerald-600"}`}>{unhideResult}</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {lockedFiles.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b"><h3 className="text-sm font-medium">Recently Locked Files ({lockedFiles.length})</h3></div>
            <div className="divide-y">
              {lockedFiles.map((f, i) => (
                <div key={i} className="flex items-center px-4 py-2.5">
                  <FileArchive className="h-4 w-4 text-purple-500 mr-3 shrink-0" />
                  <span className="text-sm truncate flex-1 font-mono text-muted-foreground">{f}</span>
                  <button onClick={() => copyPath(f)} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 ml-2">
                    {copiedPath === f ? <><Check className="h-3 w-3 text-emerald-500" /> Copied</> : <><Copy className="h-3 w-3" /> Copy path</>}
                  </button>
                  <button onClick={() => { setUnlockPath(f); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="text-xs text-primary hover:underline ml-3">Unlock</button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10/50">
        <CardContent className="p-4">
          <p className="text-xs text-blue-800 dark:text-blue-200"><span className="font-medium">How it works:</span> Files are XOR-encrypted with a SHA-256 key derived from your password and saved with a <code className="bg-blue-100 dark:bg-blue-500/15 px-1 rounded">.locked</code> extension in the same folder. The encrypted file stays visible in Explorer so you can find it to decrypt later. Remember your password — it is not stored anywhere.</p>
        </CardContent>
      </Card>
    </div>
  )
}
