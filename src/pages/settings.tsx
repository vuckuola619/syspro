import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Info, Sun, Moon, Monitor, Upload, X, Image, Globe, RefreshCw, CheckCircle2, Package, Download, Eye, EyeOff, AlertTriangle, Sparkles } from "lucide-react"
import { useTheme, ACCENT_OPTIONS } from "@/context/theme-context"
import { useI18n } from "@/context/i18n-context"
import { useAI } from "@/context/ai-context"
import { useRef, useState, useEffect } from "react"
import { toast } from "sonner"
import { invoke } from "@tauri-apps/api/core"
import { getVersion } from "@tauri-apps/api/app"

interface AppUpdateInfo {
  current_version: string; latest_version: string; update_available: boolean
  release_notes: string; download_url: string
}

export default function SettingsPage() {
  const { mode, setMode, backgroundImage, setBackgroundImage, backgroundOpacity, setBackgroundOpacity, accentColor, setAccentColor } = useTheme()
  const { locale, setLocale, t, availableLocales } = useI18n()
  const { settings: aiSettings, updateSettings: updateAI } = useAI()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null)
  const [checking, setChecking] = useState(false)
  const [appVersion, setAppVersion] = useState("…")
  const [showApiKey, setShowApiKey] = useState(false)
  const [testingApi, setTestingApi] = useState(false)

  useEffect(() => {
    getVersion().then(v => setAppVersion(v)).catch(() => setAppVersion("1.1.1"))
  }, [])

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) return
    const reader = new FileReader()
    reader.onload = () => { setBackgroundImage(reader.result as string) }
    reader.readAsDataURL(file)
  }

  async function checkUpdate() {
    setChecking(true)
    try { setUpdateInfo(await invoke<AppUpdateInfo>("check_for_app_update")) }
    catch { }
    finally { setChecking(false) }
  }

  const accentColorMap: Record<string, string> = {
    blue: "bg-blue-50 dark:bg-blue-500/100", purple: "bg-purple-50 dark:bg-purple-500/100", green: "bg-emerald-50 dark:bg-emerald-500/100", red: "bg-red-50 dark:bg-red-500/100",
    orange: "bg-orange-50 dark:bg-orange-500/100", pink: "bg-pink-50 dark:bg-pink-500/100", cyan: "bg-cyan-50 dark:bg-cyan-500/100", indigo: "bg-indigo-50 dark:bg-indigo-500/100",
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("settings.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure SABI preferences</p>
      </div>

      {/* Appearance */}
      <Card>
        <CardHeader><CardTitle className="text-base">Appearance</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {/* Theme Mode */}
          <div>
            <p className="text-sm font-medium mb-3">{t("settings.theme")}</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: "light" as const, label: "Light", icon: Sun, preview: "bg-white dark:bg-zinc-900 border-2" },
                { value: "dark" as const, label: "Dark", icon: Moon, preview: "bg-slate-900 border-2" },
                { value: "system" as const, label: "System", icon: Monitor, preview: "bg-gradient-to-r from-white to-slate-900 border-2" },
              ].map(t => (
                <button
                  key={t.value}
                  onClick={() => setMode(t.value)}
                  className={`rounded-lg p-3 text-center transition-all ${mode === t.value ? "ring-2 ring-primary ring-offset-2" : "hover:bg-accent"} border`}
                >
                  <div className={`h-12 w-full rounded-md mb-2 ${t.preview} ${mode === t.value ? "border-primary" : "border-border"}`} />
                  <div className="flex items-center justify-center gap-1.5">
                    <t.icon className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">{t.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Accent Color */}
          <div>
            <p className="text-sm font-medium mb-3">{t("settings.accent_color")}</p>
            <div className="flex gap-2.5">
              {ACCENT_OPTIONS.map(color => (
                <button
                  key={color}
                  onClick={() => setAccentColor(color)}
                  className={`h-8 w-8 rounded-full transition-all ${accentColorMap[color] || "bg-blue-50 dark:bg-blue-500/100"} ${accentColor === color ? "ring-2 ring-offset-2 ring-current scale-110" : "hover:scale-105"}`}
                  title={color.charAt(0).toUpperCase() + color.slice(1)}
                />
              ))}
            </div>
          </div>

          <Separator />

          {/* Background Image */}
          <div>
            <p className="text-sm font-medium mb-3">{t("settings.background")}</p>
            {backgroundImage ? (
              <div className="space-y-3">
                <div className="relative rounded-lg overflow-hidden border h-32">
                  <img src={backgroundImage} alt="Background" className="w-full h-full object-cover" />
                  <button
                    onClick={() => setBackgroundImage(null)}
                    className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs text-muted-foreground">Opacity</label>
                    <span className="text-xs font-medium">{Math.round(backgroundOpacity * 100)}%</span>
                  </div>
                  <input
                    type="range" min={0.05} max={0.5} step={0.05}
                    value={backgroundOpacity}
                    onChange={e => setBackgroundOpacity(parseFloat(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1.5">
                  <Upload className="h-3.5 w-3.5" /> Change Image
                </Button>
              </div>
            ) : (
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Image className="h-8 w-8 mx-auto text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground mt-2">Click to upload a PNG or JPG</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Recommended: 1920×1080 or larger</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        </CardContent>
      </Card>

      {/* Language */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" /> {t("settings.language")}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {availableLocales.map(l => (
              <button
                key={l.code}
                onClick={() => setLocale(l.code)}
                className={`rounded-lg border p-3 text-center transition-all ${locale === l.code ? "ring-2 ring-primary border-primary" : "hover:bg-accent"}`}
              >
                <p className="text-sm font-medium">{l.name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{l.code.toUpperCase()}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* General */}
      <Card>
        <CardHeader><CardTitle className="text-base">{t("settings.general")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <SettingRow title={t("settings.run_startup")} description="Automatically start SABI when Windows boots" defaultChecked={false} />
          <Separator />
          <SettingRow title={t("settings.minimize_tray")} description="Keep SABI running in the system tray when closed" defaultChecked={true} />
          <Separator />
          <SettingRow title={t("settings.check_updates")} description="Automatically check for SABI updates" defaultChecked={true} />
          <Separator />
          <SettingRow title={t("settings.portable_mode")} description="Store all settings in the app folder instead of user profile (requires restart)" defaultChecked={false} />
        </CardContent>
      </Card>

      {/* Auto-Update */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4" /> {t("settings.auto_update")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Current Version</p>
              <p className="text-xs text-muted-foreground">v{appVersion}</p>
            </div>
            <Button variant="outline" size="sm" onClick={checkUpdate} disabled={checking} className="gap-1.5">
              {checking ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Check for Updates
            </Button>
          </div>
          {updateInfo && (
            <div className="space-y-2">
              <div className={`rounded-lg p-3 text-sm flex items-center gap-2 ${updateInfo.update_available ? "bg-blue-50 dark:bg-blue-500/100/10 text-blue-600 dark:text-blue-400 border border-blue-500/20" : "bg-emerald-50 dark:bg-emerald-500/100/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"}`}>
                {updateInfo.update_available ? <Package className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
                {updateInfo.update_available
                  ? <span>SABI <strong>v{updateInfo.latest_version}</strong> is available!</span>
                  : <span>{updateInfo.release_notes}</span>
                }
              </div>
              {updateInfo.update_available && updateInfo.release_notes && (
                <div className="rounded-lg border bg-muted/50 p-3 text-xs leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Changelog</p>
                  {updateInfo.release_notes}
                </div>
              )}
              {updateInfo.update_available && updateInfo.download_url && (
                <Button size="sm" className="gap-1.5 w-full" onClick={() => { import("@tauri-apps/plugin-opener").then(m => m.openUrl(updateInfo.download_url)) }}>
                  <Download className="h-3.5 w-3.5" /> Download v{updateInfo.latest_version}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cleaning */}
      <Card>
        <CardHeader><CardTitle className="text-base">Cleaning</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <SettingRow title="Move to Recycle Bin" description="Move files to the Recycle Bin instead of permanently deleting them" defaultChecked={true} />
          <Separator />
          <SettingRow title="Create registry backup" description="Automatically backup registry before making changes" defaultChecked={true} />
          <Separator />
          <SettingRow title="Show confirmation dialogs" description="Ask for confirmation before cleaning operations" defaultChecked={true} />
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader><CardTitle className="text-base">Notifications</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <SettingRow title="System notifications" description="Show notifications for completed operations" defaultChecked={true} />
          <Separator />
          <SettingRow title="Health check reminders" description="Remind you to run periodic health checks" defaultChecked={false} />
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">About</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Application</span><span className="font-medium">SABI</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Version</span><span className="font-medium">{appVersion}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Framework</span><span className="font-medium">Tauri 2.0</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Frontend</span><span className="font-medium">React + ShadCN UI</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Backend</span><span className="font-medium">Rust</span></div>
          </div>
        </CardContent>
      </Card>

      {/* ── AI Analysis Settings ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> AI Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Enable AI Analysis</p>
              <p className="text-xs text-muted-foreground">Show floating AI analysis button for remediation & suggestions</p>
            </div>
            <button
              onClick={() => updateAI({ enabled: !aiSettings.enabled })}
              className={`relative h-6 w-11 rounded-full transition-colors ${aiSettings.enabled ? "bg-primary" : "bg-muted"}`}
            >
              <span className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${aiSettings.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>

          {aiSettings.enabled && (
            <>
              <Separator />

              {/* Provider */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Provider</p>
                  <p className="text-xs text-muted-foreground">Select your AI provider</p>
                </div>
                <select
                  className="rounded-md border bg-muted/50 px-3 py-1.5 text-sm"
                  value={aiSettings.provider}
                  onChange={e => {
                    const prov = e.target.value as "gemini" | "openai"
                    updateAI({
                      provider: prov,
                      model: prov === "gemini" ? "gemini-2.5-flash" : "gpt-4o-mini"
                    })
                  }}
                >
                  <option value="gemini">Google Gemini</option>
                  <option value="openai">OpenAI</option>
                </select>
              </div>

              {/* Model */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Model</p>
                  <p className="text-xs text-muted-foreground">
                    {aiSettings.provider === "gemini" ? "Gemini model" : "OpenAI model"}
                  </p>
                </div>
                <select
                  className="rounded-md border bg-muted/50 px-3 py-1.5 text-sm"
                  value={aiSettings.model}
                  onChange={e => updateAI({ model: e.target.value })}
                >
                  {aiSettings.provider === "gemini" ? (
                    <>
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                      <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                    </>
                  ) : (
                    <>
                      <option value="gpt-4o-mini">GPT-4o Mini</option>
                      <option value="gpt-4o">GPT-4o</option>
                    </>
                  )}
                </select>
              </div>

              {/* API Key */}
              <div className="space-y-2">
                <div>
                  <p className="text-sm font-medium">API Key</p>
                  <p className="text-xs text-muted-foreground">
                    {aiSettings.provider === "gemini"
                      ? "Get from aistudio.google.com"
                      : "Get from platform.openai.com"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showApiKey ? "text" : "password"}
                      className="w-full rounded-md border bg-muted/50 px-3 py-2 text-sm pr-10 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder={aiSettings.provider === "gemini" ? "AIzaSy..." : "sk-..."}
                      value={aiSettings.apiKey}
                      onChange={e => updateAI({ apiKey: e.target.value })}
                    />
                    <button
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!aiSettings.apiKey || testingApi}
                    onClick={async () => {
                      setTestingApi(true)
                      try {
                        const { askAI } = await import("@/context/ai-context")
                        await askAI(aiSettings, "You are a test.", "Say OK")
                        toast.success("API connection successful!")
                      } catch (e) {
                        toast.error(`Connection failed: ${String(e)}`)
                      } finally {
                        setTestingApi(false)
                      }
                    }}
                    className="gap-1 shrink-0"
                  >
                    {testingApi ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    Test
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Privacy disclaimer */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-xs">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-amber-800 dark:text-amber-300 space-y-1">
                  <p className="font-medium">Privacy Notice</p>
                  <p>When enabled, AI features send system info and questions to an external API ({aiSettings.provider === "gemini" ? "Google" : "OpenAI"}). Your API key is stored locally only and is never shared.</p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SettingRow({ title, description, defaultChecked }: { title: string; description: string; defaultChecked: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Switch defaultChecked={defaultChecked} />
    </div>
  )
}
