import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { CopyMinus, Search, RefreshCw, Trash2, FolderSearch } from "lucide-react"
import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { open } from "@tauri-apps/plugin-dialog"

interface DuplicateGroup {
  hash: string
  size_mb: number
  files: string[]
  keep_index: number
}

export default function DuplicateFinderPage() {
  const [isScanning, setIsScanning] = useState(false)
  const [hasScanned, setHasScanned] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [groups, setGroups] = useState<DuplicateGroup[]>([])

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
      
      setGroups(result.map(g => ({ ...g, keep_index: 0 })))
      setHasScanned(true)
      
    } catch (e) {
      console.error(e)
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
      console.error(e)
    }
  }

  const totalSavings = groups.reduce((s, g) => s + g.size_mb * (g.files.length - 1), 0)
  const totalDuplicates = groups.reduce((s, g) => s + g.files.length - 1, 0)

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
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
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
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
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

      {hasScanned && groups.map((group, gi) => (
        <Card key={group.hash}>
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium">Group {gi + 1}</h3>
                <Badge variant="secondary">{group.files.length} files · {group.size_mb} MB each</Badge>
              </div>
              <Button size="sm" variant="outline" onClick={() => removeGroupDuplicates(gi)} className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50">
                <Trash2 className="h-3 w-3" /> Remove Duplicates
              </Button>
            </div>
            <div className="divide-y">
              {group.files.map((file, fi) => (
                <div key={fi} className="flex items-center px-4 py-2.5">
                  <span className="text-sm truncate flex-1">{file}</span>
                  {fi === group.keep_index ? (
                    <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 text-[10px]">Keep</Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-red-50 text-red-700 text-[10px]">Duplicate</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
