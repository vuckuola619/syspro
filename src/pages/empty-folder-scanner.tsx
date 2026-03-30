import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FolderSearch, RefreshCw, Trash2, FolderOpen, Folder, CheckSquare } from "lucide-react"
import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"
import { open } from "@tauri-apps/plugin-dialog"

interface EmptyFolderItem {
  path: string
  name: string
  parent: string
}

export default function EmptyFolderScannerPage() {
  const [isScanning, setIsScanning] = useState(false)
  const [folders, setFolders] = useState<EmptyFolderItem[]>([])
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)

  async function selectAndScan() {
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: "Select folder to scan for empty folders",
      })
      if (!selectedPath) return

      setIsScanning(true)
      setSelectedFolders(new Set())

      const data = await invoke<EmptyFolderItem[]>("scan_empty_folders", {
        targetDir: selectedPath as string,
      })
      const safeData = Array.isArray(data) ? data : []
      setFolders(safeData)
      toast.success(`Found ${safeData.length} empty folders`)
    } catch (e) {
      toast.error(String(e))
    } finally {
      setIsScanning(false)
    }
  }

  async function openInExplorer(path: string) {
    try {
      await invoke("open_in_explorer", { path })
    } catch (e) { toast.error(String(e)) }
  }

  async function deleteSelected() {
    if (selectedFolders.size === 0) return
    if (!confirm(`Delete ${selectedFolders.size} empty folder(s)?\n\nThis will permanently remove these empty directories.`)) return

    setIsDeleting(true)
    try {
      const paths = Array.from(selectedFolders)
      const deleted = await invoke<number>("clean_empty_folders", { paths })
      setFolders(prev => prev.filter(f => !selectedFolders.has(f.path)))
      setSelectedFolders(new Set())
      toast.success(`Deleted ${deleted} empty folders`)
    } catch (e) {
      toast.error(String(e))
    } finally {
      setIsDeleting(false)
    }
  }

  async function deleteAll() {
    if (folders.length === 0) return
    if (!confirm(`Delete ALL ${folders.length} empty folders?\n\nThis cannot be undone.`)) return

    setIsDeleting(true)
    try {
      const paths = folders.map(f => f.path)
      const deleted = await invoke<number>("clean_empty_folders", { paths })
      setFolders([])
      setSelectedFolders(new Set())
      toast.success(`Deleted ${deleted} empty folders`)
    } catch (e) {
      toast.error(String(e))
    } finally {
      setIsDeleting(false)
    }
  }

  function toggleSelect(path: string) {
    const next = new Set(selectedFolders)
    if (next.has(path)) next.delete(path)
    else next.add(path)
    setSelectedFolders(next)
  }

  function toggleSelectAll() {
    if (selectedFolders.size === folders.length) setSelectedFolders(new Set())
    else setSelectedFolders(new Set(folders.map(f => f.path)))
  }

  // Group by parent folder
  const grouped = folders.reduce((acc, folder) => {
    const parent = folder.parent
    if (!acc[parent]) acc[parent] = []
    acc[parent].push(folder)
    return acc
  }, {} as Record<string, EmptyFolderItem[]>)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Empty Folder Scanner</h1>
        <p className="text-sm text-muted-foreground mt-1">Find and remove empty folders left behind by uninstalled apps</p>
      </div>

      {/* Scan control */}
      <Card>
        <CardContent className="flex items-center gap-4 p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 dark:bg-green-500/10">
            {isScanning ? <RefreshCw className="h-6 w-6 text-green-600 animate-spin" /> : <FolderSearch className="h-6 w-6 text-green-600" />}
          </div>
          <div className="flex-1">
            <p className="font-medium">
              {isScanning ? "Scanning for empty folders..." : folders.length > 0 ? `Found ${folders.length} empty folders` : "Select a folder to scan"}
            </p>
            <p className="text-sm text-muted-foreground">Skips protected system directories and hidden folders</p>
          </div>
          <Button onClick={selectAndScan} disabled={isScanning} className="gap-2">
            <FolderSearch className="h-4 w-4" /> {folders.length > 0 ? "Scan Again" : "Select Folder"}
          </Button>
        </CardContent>
      </Card>

      {/* Bulk actions */}
      {folders.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={toggleSelectAll} className="gap-2 text-xs">
              <CheckSquare className="h-3.5 w-3.5" />
              {selectedFolders.size === folders.length ? "Deselect All" : "Select All"}
            </Button>
            {selectedFolders.size > 0 && (
              <Badge variant="secondary">{selectedFolders.size} selected</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectedFolders.size > 0 && (
              <Button variant="destructive" size="sm" onClick={deleteSelected} disabled={isDeleting} className="gap-2">
                <Trash2 className="h-3.5 w-3.5" />
                {isDeleting ? "Deleting..." : `Delete Selected (${selectedFolders.size})`}
              </Button>
            )}
            <Button variant="destructive" size="sm" onClick={deleteAll} disabled={isDeleting || folders.length === 0} className="gap-2">
              <Trash2 className="h-3.5 w-3.5" /> Delete All ({folders.length})
            </Button>
          </div>
        </div>
      )}

      {/* Folder list grouped by parent */}
      {Object.entries(grouped).map(([parent, items]) => (
        <div key={parent} className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium px-1 truncate" title={parent}>
            📂 {parent}
          </p>
          {items.map(folder => (
            <Card key={folder.path} className={selectedFolders.has(folder.path) ? "border-primary/30" : ""}>
              <CardContent className="flex items-center gap-3 px-4 py-2.5 p-0">
                <input
                  type="checkbox"
                  checked={selectedFolders.has(folder.path)}
                  onChange={() => toggleSelect(folder.path)}
                  className="h-3.5 w-3.5 rounded shrink-0"
                />
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-50 dark:bg-yellow-500/10 shrink-0">
                  <Folder className="h-4 w-4 text-yellow-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{folder.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{folder.path}</p>
                </div>
                <Badge variant="secondary" className="text-[10px]">Empty</Badge>
                <Button
                  variant="ghost" size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-blue-600"
                  onClick={() => openInExplorer(folder.parent)}
                  title="Open parent in Explorer"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ))}

      {folders.length === 0 && !isScanning && (
        <Card>
          <CardContent className="p-8 text-center">
            <Folder className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No empty folders found. Select a folder to scan.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
