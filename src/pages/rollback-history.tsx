import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { History, RotateCcw, Trash2, Shield, FileText, Database, Clock } from "lucide-react"
import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"

interface RollbackItem {
  item_type: string
  path: string
  backup_path: string
  original_hash: string
  size_bytes: number
}

interface OperationManifest {
  id: string
  timestamp: string
  operation: string
  description: string
  items: RollbackItem[]
  total_bytes: number
  rolled_back: boolean
  expires_at: string
}

const OP_ICONS: Record<string, typeof Trash2> = {
  clean_junk: Trash2,
  clean_registry: Database,
  shred: Shield,
  debloat: FileText,
  privacy_clean: Shield,
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export default function RollbackHistoryPage() {
  const [snapshots, setSnapshots] = useState<OperationManifest[]>([])
  const [loading, setLoading] = useState(true)
  const [undoing, setUndoing] = useState<string | null>(null)

  async function loadSnapshots() {
    setLoading(true)
    try {
      setSnapshots(await invoke<OperationManifest[]>("list_snapshots"))
    } catch { }
    finally { setLoading(false) }
  }

  useEffect(() => { loadSnapshots() }, [])

  async function handleUndo(id: string) {
    setUndoing(id)
    try {
      const result = await invoke<string>("undo_snapshot", { id })
      toast.success(result)
      await loadSnapshots()
    } catch (e) {
      toast.error(`Rollback failed: ${e}`)
    } finally {
      setUndoing(null)
    }
  }

  async function handlePurge() {
    try {
      const count = await invoke<number>("purge_expired_snapshots")
      toast.success(`Purged ${count} expired items`)
      await loadSnapshots()
    } catch (e) {
      toast.error(`Purge failed: ${e}`)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <History className="h-6 w-6 text-primary" /> Operation History
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review and undo past destructive operations. Snapshots expire after 7 days.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handlePurge} className="gap-1.5">
          <Trash2 className="h-3.5 w-3.5" /> Purge Expired
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-muted/40 rounded-xl border border-border/50" />
          ))}
        </div>
      ) : snapshots.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <History className="h-12 w-12 mx-auto text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground mt-3">No operation snapshots found</p>
            <p className="text-xs text-muted-foreground mt-1">
              Snapshots are created automatically before destructive operations
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {snapshots.map(snap => {
            const Icon = OP_ICONS[snap.operation] || FileText
            return (
              <Card key={snap.id} className={snap.rolled_back ? "opacity-60" : ""}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                        snap.rolled_back
                          ? "bg-muted text-muted-foreground"
                          : "bg-primary/10 text-primary"
                      }`}>
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{snap.description || snap.operation}</p>
                          {snap.rolled_back && (
                            <span className="text-[10px] bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded font-medium">
                              UNDONE
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {formatTime(snap.timestamp)}
                          </span>
                          <span>{snap.items.length} item{snap.items.length !== 1 ? "s" : ""}</span>
                          <span>{formatBytes(snap.total_bytes)}</span>
                        </div>
                      </div>
                    </div>

                    {!snap.rolled_back && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={undoing === snap.id}
                        onClick={() => handleUndo(snap.id)}
                        className="gap-1.5 shrink-0"
                      >
                        <RotateCcw className={`h-3.5 w-3.5 ${undoing === snap.id ? "animate-spin" : ""}`} />
                        Undo
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
