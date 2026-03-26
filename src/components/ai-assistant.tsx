import { useState } from "react"
import { useAI, askAI } from "@/context/ai-context"
import { Sparkles, RefreshCw, AlertTriangle, CheckCircle, Lightbulb, ShieldAlert, Zap } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface AIAnalysisProps {
  /** Context string describing current scan results / system state */
  context: string
  /** What kind of analysis — shown as title */
  title?: string
  /** Prompt instruction for the AI */
  prompt?: string
}

interface ParsedSuggestion {
  type: "critical" | "warning" | "info" | "success"
  title: string
  description: string
}

function parseSuggestions(text: string): ParsedSuggestion[] {
  const lines = text.split("\n").filter(l => l.trim())
  const suggestions: ParsedSuggestion[] = []

  let current: Partial<ParsedSuggestion> | null = null
  for (const line of lines) {
    const trimmed = line.trim()
    // Detect bullet points or numbered items as new suggestions
    if (/^[\-\*•]\s|^\d+[\.\)]\s/.test(trimmed)) {
      if (current?.title) suggestions.push(current as ParsedSuggestion)
      const content = trimmed.replace(/^[\-\*•]\s|^\d+[\.\)]\s/, "")
      const type: ParsedSuggestion["type"] =
        /critical|urgent|immediately|danger/i.test(content) ? "critical" :
        /warning|caution|recommend|should/i.test(content) ? "warning" :
        /good|clean|optimized|healthy|no issue/i.test(content) ? "success" : "info"
      current = { type, title: content, description: "" }
    } else if (current) {
      current.description = current.description ? current.description + " " + trimmed : trimmed
    }
  }
  if (current?.title) suggestions.push(current as ParsedSuggestion)

  // If no structured items found, return entire text as one info item
  if (suggestions.length === 0 && text.trim()) {
    suggestions.push({ type: "info", title: "AI Analysis", description: text.trim() })
  }

  return suggestions
}

const TYPE_CONFIG = {
  critical: { icon: ShieldAlert, color: "#ef4444", bg: "bg-red-50 dark:bg-red-500/10", label: "Critical" },
  warning: { icon: AlertTriangle, color: "#f59e0b", bg: "bg-amber-50 dark:bg-amber-500/10", label: "Warning" },
  info: { icon: Lightbulb, color: "#3b82f6", bg: "bg-blue-50 dark:bg-blue-500/10", label: "Suggestion" },
  success: { icon: CheckCircle, color: "#22c55e", bg: "bg-green-50 dark:bg-green-500/10", label: "Good" },
}

/**
 * Inline AI Analysis component — place after scan results.
 * Only renders a button when AI is configured; shows remediation suggestions after clicking.
 */
export function AIAnalysis({ context, title = "AI Analysis", prompt }: AIAnalysisProps) {
  const { settings, isConfigured } = useAI()
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<ParsedSuggestion[]>([])
  const [error, setError] = useState("")

  if (!isConfigured) return null

  async function analyze() {
    setLoading(true)
    setError("")
    try {
      const systemPrompt = `You are SABI — a Windows system optimization expert. Based on the scan results below, provide specific, actionable remediation steps and suggestions. Format each suggestion as a bullet point. Categorize by urgency. Be concise and practical.

Scan Results:
${context}`

      const userPrompt = prompt || "Analyze these results. What should I fix first? Give me prioritized actionable steps."

      const response = await askAI(settings, systemPrompt, userPrompt)
      setSuggestions(parseSuggestions(response))
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  if (suggestions.length > 0) {
    return (
      <Card className="border-primary/20">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">{title}</p>
              <Badge variant="outline" className="text-[10px]">{settings.model}</Badge>
            </div>
            <button
              onClick={analyze}
              disabled={loading}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Re-analyze
            </button>
          </div>

          <div className="space-y-2">
            {suggestions.map((s, i) => {
              const config = TYPE_CONFIG[s.type]
              const Icon = config.icon
              return (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-lg ${config.bg}`}>
                  <Icon className="h-4 w-4 mt-0.5 shrink-0" style={{ color: config.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{s.title}</span>
                      <Badge
                        className="text-[9px]"
                        style={{ backgroundColor: config.color + "20", color: config.color, border: `1px solid ${config.color}30` }}
                      >
                        {config.label}
                      </Badge>
                    </div>
                    {s.description && (
                      <p className="text-xs text-muted-foreground mt-1">{s.description}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      className="cursor-pointer hover:border-primary/30 transition-colors group"
      onClick={analyze}
    >
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/15 transition-colors">
          {loading
            ? <RefreshCw className="h-5 w-5 text-primary animate-spin" />
            : <Sparkles className="h-5 w-5 text-primary" />
          }
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">{loading ? "Analyzing with AI..." : `🔍 Analyze with AI`}</p>
          <p className="text-xs text-muted-foreground">
            {loading ? `Using ${settings.model}...` : "Get AI-powered remediation suggestions based on scan results"}
          </p>
        </div>
        {error && (
          <span className="text-xs text-red-500">{error}</span>
        )}
        <Zap className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
      </CardContent>
    </Card>
  )
}
