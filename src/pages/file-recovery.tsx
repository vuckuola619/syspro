import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trash2, RefreshCw, RotateCcw, Eraser, File as FileIcon, Folder as FolderIcon } from "lucide-react"
import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"

interface RecycleBinItem {
  name: string
  original_path: string
  size_bytes: number
  size_display: string
  deleted_date: string
  item_type: string
}

export default function FileRecoveryPage() {
  const [items, setItems] = useState<RecycleBinItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  async function loadItems() {
    setIsLoading(true)
    try {
      const data = await invoke<RecycleBinItem[]>("get_recycle_bin_items")
      const safeData = Array.isArray(data) ? data : []
      setItems(safeData)
      setSelected(new Set())
      const total = safeData.reduce((s, i) => s + (i.size_bytes ?? 0), 0)
      const display = total >= 1073741824 ? `${(total / 1073741824).toFixed(1)} GB` :
        total >= 1048576 ? `${(total / 1048576).toFixed(1)} MB` : `${(total / 1024).toFixed(1)} KB`
      toast.success(`${data.length} items (${display})`)
    } catch (e) { toast.error(String(e)) }
    finally { setIsLoading(false) }
  }

  async function restoreItem(name: string) {
    try {
      const msg = await invoke<string>("restore_recycle_bin_item", { itemName: name })
      toast.success(msg)
      setItems(prev => prev.filter(i => i.name !== name))
    } catch (e) { toast.error(String(e)) }
  }

  async function emptyBin() {
    try {
      const msg = await invoke<string>("empty_recycle_bin")
      toast.success(msg)
      setItems([])
    } catch (e) { toast.error(String(e)) }
  }

  const toggleSelect = (name: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">File Recovery</h1>
        <p className="text-sm text-muted-foreground mt-1">Browse and restore deleted files from the Recycle Bin</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:border-primary/30 transition-colors" onClick={loadItems}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10">
              {isLoading ? <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" /> : <Trash2 className="h-5 w-5 text-blue-600" />}
            </div>
            <div>
              <p className="text-sm font-medium">Scan Recycle Bin</p>
              <p className="text-xs text-muted-foreground">{items.length > 0 ? `${items.length} items` : "Click to scan"}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-green-300 transition-colors" onClick={() => selected.forEach(n => restoreItem(n))}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 dark:bg-green-500/10">
              <RotateCcw className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Restore Selected</p>
              <p className="text-xs text-muted-foreground">{selected.size} selected</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-red-300 transition-colors" onClick={emptyBin}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 dark:bg-red-500/10">
              <Eraser className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Empty Bin</p>
              <p className="text-xs text-muted-foreground">Permanently delete all</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {items.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-auto max-h-[500px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background border-b">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2 w-8"></th>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2">Size</th>
                    <th className="px-4 py-2">Deleted</th>
                    <th className="px-4 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.name + item.deleted_date} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2">
                        <input type="checkbox" checked={selected.has(item.name)} onChange={() => toggleSelect(item.name)} className="rounded" />
                      </td>
                      <td className="px-4 py-2 font-medium flex items-center gap-2">
                        {item.item_type.includes("Folder") ? <FolderIcon className="h-3.5 w-3.5 text-yellow-500" /> : <FileIcon className="h-3.5 w-3.5 text-blue-500" />}
                        <span className="truncate max-w-[200px]">{item.name}</span>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">{item.item_type}</td>
                      <td className="px-4 py-2"><Badge variant="secondary" className="text-[10px]">{item.size_display}</Badge></td>
                      <td className="px-4 py-2 font-mono text-xs">{item.deleted_date}</td>
                      <td className="px-4 py-2">
                        <button onClick={() => restoreItem(item.name)} className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-500/10 dark:text-green-400 transition-colors">
                          Restore
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {items.length === 0 && !isLoading && (
        <Card>
          <CardContent className="p-8 text-center">
            <Trash2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Click "Scan Recycle Bin" to view deleted files.</p>
            <p className="text-xs text-muted-foreground mt-1">Restore accidentally deleted files or permanently empty the bin.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
