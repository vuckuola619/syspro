import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "./index.css"
import { ThemeProvider } from "@/context/theme-context"
import { I18nProvider } from "@/context/i18n-context"

// Disable browser right-click context menu
document.addEventListener("contextmenu", (e) => e.preventDefault())

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <I18nProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </I18nProvider>
  </React.StrictMode>
)

// Show window + fade out splash screen once React has mounted
requestAnimationFrame(async () => {
  // Show the Tauri window (it starts hidden to avoid blank white screen)
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window")
    await getCurrentWindow().show()
  } catch { /* dev mode / non-tauri fallback */ }

  const splash = document.getElementById("splash")
  if (splash) {
    splash.classList.add("fade-out")
    setTimeout(() => splash.remove(), 350)
  }
})
