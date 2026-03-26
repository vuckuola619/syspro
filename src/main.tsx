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

// Fade out splash screen once React has mounted
requestAnimationFrame(() => {
  const splash = document.getElementById("splash")
  if (splash) {
    splash.classList.add("fade-out")
    setTimeout(() => splash.remove(), 350)
  }
})
