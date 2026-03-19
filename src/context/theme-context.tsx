import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

type ThemeMode = "light" | "dark" | "system"

interface ThemeContextType {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  backgroundImage: string | null
  setBackgroundImage: (url: string | null) => void
  backgroundOpacity: number
  setBackgroundOpacity: (val: number) => void
  accentColor: string
  setAccentColor: (color: string) => void
}

const ThemeContext = createContext<ThemeContextType>({
  mode: "light", setMode: () => {},
  backgroundImage: null, setBackgroundImage: () => {},
  backgroundOpacity: 0.15, setBackgroundOpacity: () => {},
  accentColor: "blue", setAccentColor: () => {},
})

export const useTheme = () => useContext(ThemeContext)

const ACCENT_COLORS: Record<string, string> = {
  blue: "220 72% 50%",
  purple: "262 83% 58%",
  green: "142 71% 45%",
  red: "0 84% 60%",
  orange: "25 95% 53%",
  pink: "330 81% 60%",
  cyan: "189 94% 43%",
  indigo: "239 84% 67%",
}

export const ACCENT_OPTIONS = Object.keys(ACCENT_COLORS)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() =>
    (localStorage.getItem("sp-theme") as ThemeMode) || "dark"
  )
  const [backgroundImage, setBgState] = useState<string | null>(() =>
    localStorage.getItem("sp-bg-image")
  )
  const [backgroundOpacity, setOpState] = useState<number>(() =>
    parseFloat(localStorage.getItem("sp-bg-opacity") || "0.15")
  )
  const [accentColor, setAccState] = useState<string>(() =>
    localStorage.getItem("sp-accent") || "blue"
  )

  function setMode(m: ThemeMode) {
    setModeState(m)
    localStorage.setItem("sp-theme", m)
  }

  function setBackgroundImage(url: string | null) {
    setBgState(url)
    if (url) localStorage.setItem("sp-bg-image", url)
    else localStorage.removeItem("sp-bg-image")
  }

  function setBackgroundOpacity(val: number) {
    setOpState(val)
    localStorage.setItem("sp-bg-opacity", String(val))
  }

  function setAccentColor(color: string) {
    setAccState(color)
    localStorage.setItem("sp-accent", color)
  }

  // Apply theme class
  useEffect(() => {
    const root = document.documentElement
    if (mode === "system") {
      const dark = window.matchMedia("(prefers-color-scheme: dark)").matches
      root.classList.toggle("dark", dark)
    } else {
      root.classList.toggle("dark", mode === "dark")
    }
  }, [mode])

  // Apply accent color
  useEffect(() => {
    const val = ACCENT_COLORS[accentColor] || ACCENT_COLORS.blue
    document.documentElement.style.setProperty("--primary", val)
  }, [accentColor])

  return (
    <ThemeContext.Provider value={{
      mode, setMode,
      backgroundImage, setBackgroundImage,
      backgroundOpacity, setBackgroundOpacity,
      accentColor, setAccentColor,
    }}>
      {children}
    </ThemeContext.Provider>
  )
}
