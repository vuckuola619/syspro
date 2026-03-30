import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { CopyMinus, Search, RefreshCw, Trash2, FolderSearch } from "lucide-react"
import { useState, useRef } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"
import { open } from "@tauri-apps/plugin-dialog"

interface DuplicateGroup {
  hash: string
  size_mb: number
  files: string[]
  keep_index: number
}

export default function DuplicateFinderPage() {
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [groups, setGroups] = useState<DuplicateGroup[]>([])
  const [hasScanned, setHasScanned] = useState(false)

  const parentRef = useRef<HTMLDivElement>(null)
  const rowVirtualizer = useVirtualizer({
    count: groups.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => 58 + (groups[index]?.files?.length ?? 0) * 41 + 16,
    overscan: 2,
  })

  async function startScan() {
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: "Select folder to scan for duplicates",
      })

      if (!selectedPath) return
      
      setIsScanning(true)
      setHasScanned(false)
      setScanProgress(0)
      
      // Fake progress while backend works
      const interval = setInterval(() => setScanProgress((p) => Math.min(p + 5, 90)), 500)
      
      const result = await invoke<DuplicateGroup[]>("scan_duplicate_files", { targetDir: selectedPath as string })
      
      clearInterval(interval)
      setScanProgress(100)
      
      const safeResult = Array.isArray(result) ? result : []
      setGroups(safeResult.map(g => ({ ...g, files: Array.isArray(g?.files) ? g.files : [], keep_index: 0 })))
      setHasScanned(true)
      
    } catch (e) {
      toast.error(String(e))
    } finally {
      setIsScanning(false)
    }
  }

  async function removeGroupDuplicates(groupIndex: number) {
    const group = groups[groupIndex]
    const filesToDelete = group.files.filter((_, i) => i !== group.keep_index)
    
    try {
      await invoke("clean_duplicate_files", { filesToDelete })
      // Remove group from UI since duplicates are gone
      setGroups(groups.filter((_, i) => i !== groupIndex))
    } catch (e) {
      toast.error(String(e))
    }
  }

  const totalSavings = groups.reduce((s, g) => s + (g.size_mb ?? 0) * ((g.files?.length ?? 1) - 1), 0)
  const totalDuplicates = groups.reduce((s, g) => s + (g.files?.length ?? 1) - 1, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Duplicate Finder</h1>
        <p className="text-sm text-muted-foreground mt-1">Find and remove duplicate files to free up disk space</p>
      </div>

      <Card>
        <CardContent className="p-6">
          {isScanning ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm font-medium">Scanning for duplicates...</span>
                </div>
                <span className="text-sm text-muted-foreground">{scanProgress}%</span>
              </div>
              <Progress value={scanProgress} />
            </div>
          ) : hasScanned ? (
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-500/10">
                <CopyMinus className="h-6 w-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Found {totalDuplicates} duplicates in {groups.length} groups</p>
                <p className="text-sm text-muted-foreground">Potential savings: {totalSavings.toFixed(1)} MB</p>
              </div>
              <Button variant="outline" onClick={startScan} className="gap-2"><Search className="h-4 w-4" /> Re-scan</Button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10">
                <CopyMinus className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Find duplicate files</p>
                <p className="text-sm text-muted-foreground">Scan your drives using SHA-256 hash comparison</p>
              </div>
              <Button onClick={startScan} className="gap-2"><FolderSearch className="h-4 w-4" /> Select Folder</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {hasScanned && (
        <div ref={parentRef} className="h-[600px] overflow-auto rounded-md border p-2 bg-background space-y-0">
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const gi = virtualRow.index
              const group = groups[gi]
              return (
                <div
                  key={virtualRow.key}
                  ref={rowVirtualizer.measureElement}
                  data-index={virtualRow.index}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                    paddingBottom: "16px",
                  }}
                >
                  <Card>
                    <CardContent className="p-0">
                      <div className="px-4 py-3 border-b flex items-center justify-between bg-muted/30">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-medium">Group {gi + 1}</h3>
                          <Badge variant="secondary">{group.files.length} files · {group.size_mb} MB each</Badge>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => removeGroupDuplicates(gi)} className="gap-1.5 text-red-600 hover:text-red-700 dark:text-red-300 hover:bg-red-50 dark:bg-red-500/10">
                          <Trash2 className="h-3 w-3" /> Remove Duplicates
                        </Button>
                      </div>
                      <div className="divide-y">
                        {group.files.map((file, fi) => (
                          <div key={fi} className="flex items-center px-4 py-2.5">
                            <span className="text-sm truncate flex-1" title={file}>{file}</span>
                            {fi === group.keep_index ? (
                              <Badge className="bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] ml-2 shrink-0">Keep</Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 text-[10px] ml-2 shrink-0">Duplicate</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
