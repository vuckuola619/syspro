import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Scissors, RefreshCw, CheckCircle2, Merge, FileText } from "lucide-react"
import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"
import { open, save } from "@tauri-apps/plugin-dialog"

interface SplitResult {
  original_file: string
  chunk_count: number
  chunk_size_mb: number
  output_dir: string
}

interface JoinResult {
  output_file: string
  chunks_joined: number
  total_size_mb: number
}

export default function FileSplitterPage() {
  const [mode, setMode] = useState<"split" | "join">("split")
  const [isSplitting, setIsSplitting] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [chunkSize, setChunkSize] = useState(100)
  const [splitResult, setSplitResult] = useState<SplitResult | null>(null)
  const [joinResult, setJoinResult] = useState<JoinResult | null>(null)

  async function handleSplit() {
    try {
      const file = await open({ multiple: false, title: "Select file to split" })
      if (!file) return
      setIsSplitting(true)
      setSplitResult(null)
      const result = await invoke<SplitResult>("split_file", { filePath: file as string, chunkSizeMb: chunkSize })
      setSplitResult(result)
    } catch (e) { toast.error(String(e)) }
    finally { setIsSplitting(false) }
  }

  async function handleJoin() {
    try {
      const files = await open({ multiple: true, title: "Select chunk files to join (in order)" })
      if (!files || (files as string[]).length === 0) return

      const outputPath = await save({ title: "Save joined file as", defaultPath: "joined_output" })
      if (!outputPath) return

      setIsJoining(true)
      setJoinResult(null)
      const result = await invoke<JoinResult>("join_files", { chunkPaths: files, outputPath: outputPath as string })
      setJoinResult(result)
    } catch (e) { toast.error(String(e)) }
    finally { setIsJoining(false) }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">File Splitter & Joiner</h1>
        <p className="text-sm text-muted-foreground mt-1">Split large files into chunks or join chunks back together</p>
      </div>

      {/* Mode Tabs */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
        <button onClick={() => setMode("split")} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${mode === "split" ? "bg-white dark:bg-zinc-900 shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          <Scissors className="h-4 w-4" /> Split File
        </button>
        <button onClick={() => setMode("join")} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${mode === "join" ? "bg-white dark:bg-zinc-900 shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          <Merge className="h-4 w-4" /> Join Files
        </button>
      </div>

      {mode === "split" ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Chunk Size (MB)</p>
              <div className="flex gap-2">
                {[10, 50, 100, 250, 500, 700].map(size => (
                  <button
                    key={size}
                    onClick={() => setChunkSize(size)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${chunkSize === size ? "bg-primary text-white" : "bg-muted hover:bg-muted/80"}`}
                  >
                    {size} MB
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={handleSplit} disabled={isSplitting} className="gap-2">
              {isSplitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Scissors className="h-4 w-4" />}
              Select File & Split
            </Button>

            {splitResult && (
              <Card className="border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10/30">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">Split Complete!</p>
                  </div>
                  <div className="flex gap-3 text-xs text-emerald-700 dark:text-emerald-300">
                    <Badge variant="secondary" className="bg-emerald-100 dark:bg-emerald-500/15">{splitResult.chunk_count} chunks</Badge>
                    <Badge variant="secondary" className="bg-emerald-100 dark:bg-emerald-500/15">{splitResult.chunk_size_mb} MB each</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><FileText className="h-3 w-3" /> {splitResult.output_dir}</p>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 space-y-4">
            <p className="text-sm text-muted-foreground">Select chunk files in order (multi-select), then choose where to save the joined file.</p>
            <Button onClick={handleJoin} disabled={isJoining} className="gap-2">
              {isJoining ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Merge className="h-4 w-4" />}
              Select Chunks & Join
            </Button>

            {joinResult && (
              <Card className="border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10/30">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">Join Complete!</p>
                  </div>
                  <div className="flex gap-3 text-xs text-emerald-700 dark:text-emerald-300">
                    <Badge variant="secondary" className="bg-emerald-100 dark:bg-emerald-500/15">{joinResult.chunks_joined} chunks joined</Badge>
                    <Badge variant="secondary" className="bg-emerald-100 dark:bg-emerald-500/15">{joinResult.total_size_mb} MB</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><FileText className="h-3 w-3" /> {joinResult.output_file}</p>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
