import { useState, useRef, useEffect } from "react"
import { useAI, askAI } from "@/context/ai-context"
import { X, Send, Sparkles, RefreshCw, Minimize2 } from "lucide-react"
import { invoke } from "@tauri-apps/api/core"

interface Message {
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

/**
 * Floating AI Chat Button — appears bottom-right when enabled in Settings.
 * Provides a conversational AI assistant for system questions.
 */
export function FloatingAIChat() {
  const { settings, isConfigured } = useAI()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Only show if AI is enabled in settings
  if (!settings.enabled) return null

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => { scrollToBottom() }, [messages])

  async function sendMessage() {
    if (!input.trim() || loading) return
    if (!isConfigured) {
      setMessages(prev => [...prev, {
        role: "user", content: input, timestamp: new Date()
      }, {
        role: "assistant",
        content: "⚠️ Please configure your API key in Settings → AI Assistant first.",
        timestamp: new Date()
      }])
      setInput("")
      return
    }

    const userMsg: Message = { role: "user", content: input, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInput("")
    setLoading(true)

    try {
      // Gather system context
      let systemInfo = "Windows PC"
      try {
        const overview = await invoke<{ cpu_name: string; ram_total_gb: number; os_version: string }>("get_system_overview")
        systemInfo = `OS: ${overview.os_version}, CPU: ${overview.cpu_name}, RAM: ${overview.ram_total_gb.toFixed(1)} GB`
      } catch { /* fallback */ }

      const systemPrompt = `You are SABI AI — a helpful Windows system optimization assistant built into the SABI app (System Analytics & Boost Infrastructure). The user's system: ${systemInfo}. Answer concisely and helpfully. If asked about SABI features, explain how to use them.`

      const response = await askAI(settings, systemPrompt, input)
      setMessages(prev => [...prev, {
        role: "assistant",
        content: response,
        timestamp: new Date()
      }])
    } catch (e) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `❌ Error: ${String(e)}`,
        timestamp: new Date()
      }])
    } finally {
      setLoading(false)
    }
  }

  // Floating button
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
        title="AI Assistant"
      >
        <Sparkles className="h-5 w-5" />
      </button>
    )
  }

  // Chat panel
  return (
    <div className="fixed bottom-6 right-6 z-50 flex w-[380px] flex-col rounded-2xl border bg-background shadow-2xl" style={{ height: "480px" }}>
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">SABI AI</p>
          <p className="text-xs text-muted-foreground">{settings.model}</p>
        </div>
        <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
          <Minimize2 className="h-4 w-4" />
        </button>
        <button
          onClick={() => { setMessages([]); setIsOpen(false) }}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Sparkles className="h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">How can I help?</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Ask me anything about your system</p>
            <div className="grid grid-cols-1 gap-1.5 mt-4 w-full">
              {[
                "Why is my PC running slow?",
                "How to free up disk space?",
                "Explain my health score",
              ].map((q, i) => (
                <button
                  key={i}
                  className="text-xs text-left px-3 py-2 rounded-lg border hover:bg-muted transition-colors"
                  onClick={() => { setInput(q); }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
              msg.role === "user"
                ? "bg-primary text-primary-foreground rounded-br-md"
                : "bg-muted rounded-bl-md"
            }`}>
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{msg.content}</p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-md px-3 py-2 flex items-center gap-2">
              <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t px-3 py-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()}
            placeholder={isConfigured ? "Ask anything..." : "Configure API key in Settings"}
            className="flex-1 rounded-xl border bg-muted/50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
