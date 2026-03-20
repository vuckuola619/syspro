import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { KeyRound, RefreshCw, Copy, Check, ShieldCheck } from "lucide-react"
import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"

interface GeneratedPassword {
  password: string
  strength: string
  entropy_bits: number
}

export default function PasswordGeneratorPage() {
  const [result, setResult] = useState<GeneratedPassword | null>(null)
  const [length, setLength] = useState(16)
  const [uppercase, setUppercase] = useState(true)
  const [lowercase, setLowercase] = useState(true)
  const [numbers, setNumbers] = useState(true)
  const [symbols, setSymbols] = useState(true)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function generate() {
    setLoading(true)
    setCopied(false)
    try {
      const res = await invoke<GeneratedPassword>("generate_password", {
        length, useUppercase: uppercase, useLowercase: lowercase, useNumbers: numbers, useSymbols: symbols,
      })
      setResult(res)
    } catch (e) { toast.error(String(e)) }
    finally { setLoading(false) }
  }

  function copyPassword() {
    if (result) {
      navigator.clipboard.writeText(result.password)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const strengthColor = result?.strength === "Very Strong" ? "text-emerald-600 bg-emerald-100 dark:bg-emerald-500/15"
    : result?.strength === "Strong" ? "text-blue-600 bg-blue-100 dark:bg-blue-500/15"
    : result?.strength === "Medium" ? "text-amber-600 bg-amber-100 dark:bg-amber-500/15"
    : "text-red-600 bg-red-100 dark:bg-red-500/15"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Password Generator</h1>
        <p className="text-sm text-muted-foreground mt-1">Generate strong, random passwords with customizable options</p>
      </div>

      <Card>
        <CardContent className="p-5 space-y-5">
          <div>
            <label className="text-sm font-medium">Length: {length}</label>
            <input type="range" min={4} max={64} value={length} onChange={e => setLength(Number(e.target.value))}
              className="w-full mt-2 accent-primary" />
            <div className="flex justify-between text-[10px] text-muted-foreground"><span>4</span><span>64</span></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Uppercase (A-Z)", checked: uppercase, set: setUppercase },
              { label: "Lowercase (a-z)", checked: lowercase, set: setLowercase },
              { label: "Numbers (0-9)", checked: numbers, set: setNumbers },
              { label: "Symbols (!@#$)", checked: symbols, set: setSymbols },
            ].map(opt => (
              <label key={opt.label} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={opt.checked} onChange={e => opt.set(e.target.checked)}
                  className="rounded border-gray-300 text-primary focus:ring-primary" />
                {opt.label}
              </label>
            ))}
          </div>

          <Button onClick={generate} disabled={loading} className="w-full gap-2">
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Generate Password
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card className="border-primary/20">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${strengthColor}`}>{result.strength}</span>
              <span className="text-xs text-muted-foreground">{result.entropy_bits} bits entropy</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted rounded-md px-4 py-3 text-sm font-mono break-all select-all">{result.password}</code>
              <Button variant="outline" size="sm" onClick={copyPassword} className="gap-1.5 shrink-0">
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
