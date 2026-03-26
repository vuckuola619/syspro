import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

export interface AISettings {
  enabled: boolean
  apiKey: string
  model: string
  provider: "gemini" | "openai"
}

interface AIContextType {
  settings: AISettings
  updateSettings: (patch: Partial<AISettings>) => void
  isConfigured: boolean
}

const DEFAULT_SETTINGS: AISettings = {
  enabled: false,
  apiKey: "",
  model: "gemini-2.0-flash",
  provider: "gemini",
}

const AIContext = createContext<AIContextType>({
  settings: DEFAULT_SETTINGS,
  updateSettings: () => {},
  isConfigured: false,
})

export function useAI() {
  return useContext(AIContext)
}

export function AIProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AISettings>(() => {
    try {
      const saved = localStorage.getItem("sabi_ai_settings")
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS
    } catch {
      return DEFAULT_SETTINGS
    }
  })

  useEffect(() => {
    localStorage.setItem("sabi_ai_settings", JSON.stringify(settings))
  }, [settings])

  function updateSettings(patch: Partial<AISettings>) {
    setSettings(prev => ({ ...prev, ...patch }))
  }

  const isConfigured = settings.enabled && settings.apiKey.length > 10

  return (
    <AIContext.Provider value={{ settings, updateSettings, isConfigured }}>
      {children}
    </AIContext.Provider>
  )
}

/* ── AI Chat helper ── */
export async function askAI(
  settings: AISettings,
  systemContext: string,
  userMessage: string,
): Promise<string> {
  if (!settings.apiKey) throw new Error("API key not configured")

  if (settings.provider === "gemini") {
    const model = settings.model || "gemini-2.0-flash"
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${settings.apiKey}`
    const body = {
      contents: [
        { role: "user", parts: [{ text: `${systemContext}\n\nUser question: ${userMessage}` }] },
      ],
      generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Gemini API error: ${res.status} — ${err}`)
    }
    const data = await res.json()
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated."
  }

  // OpenAI
  const url = "https://api.openai.com/v1/chat/completions"
  const body = {
    model: settings.model || "gpt-4o-mini",
    messages: [
      { role: "system", content: systemContext },
      { role: "user", content: userMessage },
    ],
    max_tokens: 1024,
    temperature: 0.7,
  }
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI API error: ${res.status} — ${err}`)
  }
  const data = await res.json()
  return data?.choices?.[0]?.message?.content || "No response generated."
}
