import { Outlet } from "react-router-dom"
import { Sidebar } from "@/components/layout/sidebar"
import { TitleBar } from "@/components/layout/title-bar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useTheme } from "@/context/theme-context"
import { Toaster } from "sonner"

export function AppLayout() {
  const { backgroundImage, backgroundOpacity, mode } = useTheme()

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden relative">
          {backgroundImage && (
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none z-0"
              style={{
                backgroundImage: `url(${backgroundImage})`,
                opacity: backgroundOpacity,
              }}
            />
          )}
          <ScrollArea className="h-full relative z-10">
            <div className="p-6">
              <Outlet />
            </div>
          </ScrollArea>
        </main>
      </div>
      <Toaster theme={mode === "dark" ? "dark" : mode === "light" ? "light" : "system"} richColors position="bottom-right" />
    </div>
  )
}
