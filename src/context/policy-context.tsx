import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Lock } from "lucide-react"

// ── Policy types (match Rust SabiPolicy struct) ──

export interface SabiPolicy {
  auto_clean_schedule: string
  excluded_paths: string[]
  features_disabled: string[]
  max_registry_keys_per_run: number
  require_admin_for_destructive: boolean
  audit_log_export_path: string
  webhook_url: string
  max_snapshots: number
}

const DEFAULT_POLICY: SabiPolicy = {
  auto_clean_schedule: "disabled",
  excluded_paths: [],
  features_disabled: [],
  max_registry_keys_per_run: 500,
  require_admin_for_destructive: true,
  audit_log_export_path: "",
  webhook_url: "",
  max_snapshots: 30,
}

// ── Context ──

interface PolicyContextType {
  policy: SabiPolicy
  isFeatureDisabled: (featureId: string) => boolean
  loading: boolean
}

const PolicyContext = createContext<PolicyContextType>({
  policy: DEFAULT_POLICY,
  isFeatureDisabled: () => false,
  loading: true,
})

export function usePolicy() {
  return useContext(PolicyContext)
}

export function PolicyProvider({ children }: { children: ReactNode }) {
  const [policy, setPolicy] = useState<SabiPolicy>(DEFAULT_POLICY)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    invoke<SabiPolicy>("get_policy")
      .then(p => setPolicy(p))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const isFeatureDisabled = (featureId: string) =>
    policy.features_disabled.includes(featureId)

  return (
    <PolicyContext.Provider value={{ policy, isFeatureDisabled, loading }}>
      {children}
    </PolicyContext.Provider>
  )
}

// ── Policy Lock Badge ──

export function PolicyLockBadge({ featureId }: { featureId: string }) {
  const { isFeatureDisabled } = usePolicy()

  if (!isFeatureDisabled(featureId)) return null

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 text-xs font-medium">
      <Lock className="h-3 w-3" />
      <span>Disabled by policy</span>
    </div>
  )
}

// ── Policy Lock Overlay (wraps a card/section) ──

export function PolicyGate({ featureId, children }: { featureId: string; children: ReactNode }) {
  const { isFeatureDisabled } = usePolicy()

  if (!isFeatureDisabled(featureId)) return <>{children}</>

  return (
    <div className="relative">
      <div className="pointer-events-none opacity-40 select-none">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-xl">
        <div className="flex flex-col items-center gap-2 text-center px-6">
          <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
            <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-sm font-medium">Feature Disabled</p>
          <p className="text-xs text-muted-foreground max-w-[240px]">
            This feature has been disabled by your organization's security policy.
            Contact your IT administrator for access.
          </p>
        </div>
      </div>
    </div>
  )
}
