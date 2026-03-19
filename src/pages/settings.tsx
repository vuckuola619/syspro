import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Info, Sun, Moon, Monitor, Upload, X, Image, Globe, RefreshCw, CheckCircle2, Package, Download } from "lucide-react"
import { useTheme, ACCENT_OPTIONS } from "@/context/theme-context"
import { useI18n } from "@/context/i18n-context"
import { useRef, useState } from "react"
import { invoke } from "@tauri-apps/api/core"

interface AppUpdateInfo {
  current_version: string; latest_version: string; update_available: boolean
  release_notes: string; download_url: string
}

export default function SettingsPage() {
  const { mode, setMode, backgroundImage, setBackgroundImage, backgroundOpacity, setBackgroundOpacity, accentColor, setAccentColor } = useTheme()
  const { locale, setLocale, t, availableLocales } = useI18n()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null)
  const [checking, setChecking] = useState(false)

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
    blue: "bg-blue-500", purple: "bg-purple-500", green: "bg-emerald-500", red: "bg-red-500",
    orange: "bg-orange-500", pink: "bg-pink-500", cyan: "bg-cyan-500", indigo: "bg-indigo-500",
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("settings.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure SystemPro preferences</p>
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
                { value: "light" as const, label: "Light", icon: Sun, preview: "bg-white border-2" },
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
                  className={`h-8 w-8 rounded-full transition-all ${accentColorMap[color] || "bg-blue-500"} ${accentColor === color ? "ring-2 ring-offset-2 ring-current scale-110" : "hover:scale-105"}`}
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
          <SettingRow title={t("settings.run_startup")} description="Automatically start SystemPro when Windows boots" defaultChecked={false} />
          <Separator />
          <SettingRow title={t("settings.minimize_tray")} description="Keep SystemPro running in the system tray when closed" defaultChecked={true} />
          <Separator />
          <SettingRow title={t("settings.check_updates")} description="Automatically check for SystemPro updates" defaultChecked={true} />
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
              <p className="text-xs text-muted-foreground">v1.0.0</p>
            </div>
            <Button variant="outline" size="sm" onClick={checkUpdate} disabled={checking} className="gap-1.5">
              {checking ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Check for Updates
            </Button>
          </div>
          {updateInfo && (
            <div className="space-y-2">
              <div className={`rounded-lg p-3 text-sm flex items-center gap-2 ${updateInfo.update_available ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"}`}>
                {updateInfo.update_available ? <Package className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
                {updateInfo.update_available
                  ? <span>SystemPro <strong>v{updateInfo.latest_version}</strong> is available!</span>
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
            <div className="flex justify-between"><span className="text-muted-foreground">Application</span><span className="font-medium">SystemPro</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Version</span><span className="font-medium">1.0.0</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Framework</span><span className="font-medium">Tauri 2.0</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Frontend</span><span className="font-medium">React + ShadCN UI</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Backend</span><span className="font-medium">Rust</span></div>
          </div>
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
