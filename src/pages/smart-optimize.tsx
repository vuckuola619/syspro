import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sparkles, RefreshCw, AlertTriangle, CheckCircle, Zap } from "lucide-react"
import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"

interface ScoreCategory {
  name: string
  score: number
  max_score: number
  status: string
}

interface Recommendation {
  title: string
  description: string
  impact: string
  category: string
  auto_fixable: boolean
}

interface OptimizationScore {
  overall_score: number
  grade: string
  categories: ScoreCategory[]
  recommendations: Recommendation[]
}

const IMPACT_COLORS: Record<string, string> = {
  Critical: "#ef4444",
  High: "#f97316",
  Medium: "#eab308",
  Low: "#22c55e",
}

const GRADE_COLORS: Record<string, string> = {
  "A+": "#22c55e",
  A: "#22c55e",
  B: "#3b82f6",
  C: "#eab308",
  D: "#f97316",
  F: "#ef4444",
}

export default function SmartOptimizePage() {
  const [score, setScore] = useState<OptimizationScore | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function analyze() {
    setIsLoading(true)
    try {
      const raw = await invoke<OptimizationScore>("get_optimization_score")
      const data: OptimizationScore = {
        ...raw,
        overall_score: raw.overall_score ?? 0,
        grade: raw.grade ?? "F",
        categories: Array.isArray(raw.categories) ? raw.categories : [],
        recommendations: Array.isArray(raw.recommendations) ? raw.recommendations : [],
      }
      setScore(data)
      toast.success(`Score: ${data.overall_score}/100 — Grade ${data.grade}`)
    } catch (e) { toast.error(String(e)) }
    finally { setIsLoading(false) }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Smart Optimization</h1>
        <p className="text-sm text-muted-foreground mt-1">AI-powered system health scoring with actionable recommendations</p>
      </div>

      <Card className="cursor-pointer hover:border-primary/30 transition-colors" onClick={analyze}>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-50 dark:bg-purple-500/10">
            {isLoading ? <RefreshCw className="h-5 w-5 text-purple-600 animate-spin" /> : <Sparkles className="h-5 w-5 text-purple-600" />}
          </div>
          <div>
            <p className="text-sm font-medium">{isLoading ? "Analyzing system..." : "Analyze System"}</p>
            <p className="text-xs text-muted-foreground">{score ? `Score: ${score.overall_score}/100` : "Click to run full analysis"}</p>
          </div>
        </CardContent>
      </Card>

      {score && (
        <>
          {/* Score display */}
          <div className="flex items-center gap-6">
            <div className="relative">
              <svg width="120" height="120" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                <circle
                  cx="60" cy="60" r="52" fill="none"
                  stroke={GRADE_COLORS[score.grade] || "#3b82f6"}
                  strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${(score.overall_score / 100) * 327} 327`}
                  transform="rotate(-90 60 60)"
                />
                <text x="60" y="55" textAnchor="middle" className="text-2xl font-bold fill-foreground">{score.overall_score}</text>
                <text x="60" y="72" textAnchor="middle" className="text-xs fill-muted-foreground">/ 100</text>
              </svg>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-4xl font-bold" style={{ color: GRADE_COLORS[score.grade] }}>{score.grade}</span>
                <span className="text-sm text-muted-foreground">System Grade</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{(score.recommendations ?? []).length} recommendation(s)</p>
            </div>
          </div>

          {/* Category breakdown */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <p className="text-sm font-medium mb-3">Category Breakdown</p>
              {Array.isArray(score.categories) && score.categories.map(cat => (
                <div key={cat.name} className="flex items-center gap-3 p-2 rounded-lg bg-muted/20">
                  <span className="text-sm font-medium w-24">{cat.name}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${((cat.score ?? 0) / (cat.max_score || 1)) * 100}%`,
                        backgroundColor: (cat.score ?? 0) >= (cat.max_score ?? 0) * 0.75 ? "#22c55e" : (cat.score ?? 0) >= (cat.max_score ?? 0) * 0.5 ? "#eab308" : "#ef4444",
                      }}
                    />
                  </div>
                  <span className="text-xs font-mono w-12 text-right">{cat.score ?? 0}/{cat.max_score ?? 0}</span>
                  <span className="text-xs text-muted-foreground w-28 text-right">{cat.status}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recommendations */}
          {Array.isArray(score.recommendations) && score.recommendations.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <p className="text-sm font-medium mb-3">Recommendations</p>
                {score.recommendations.map((rec, i) => {
                  const color = IMPACT_COLORS[rec.impact] || "#64748b"
                  return (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg border">
                      {rec.impact === "Critical" || rec.impact === "High"
                        ? <AlertTriangle className="h-4 w-4 mt-0.5" style={{ color }} />
                        : <Zap className="h-4 w-4 mt-0.5" style={{ color }} />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{rec.title}</span>
                          <Badge style={{ backgroundColor: color + "20", color, border: `1px solid ${color}40` }} className="text-[10px]">{rec.impact}</Badge>
                          {rec.auto_fixable && <Badge variant="outline" className="text-[10px]">Auto-fixable</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{rec.description}</p>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}

          {(!Array.isArray(score.recommendations) || score.recommendations.length === 0) && (
            <Card className="border-green-200 dark:border-green-500/20">
              <CardContent className="p-4 flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-sm font-medium text-green-700 dark:text-green-400">Your system is well optimized. No recommendations at this time.</span>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!score && !isLoading && (
        <Card>
          <CardContent className="p-8 text-center">
            <Sparkles className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Click "Analyze System" to get a comprehensive health score.</p>
            <p className="text-xs text-muted-foreground mt-1">Checks memory, disk, startup items, security, and updates — scored out of 100.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
