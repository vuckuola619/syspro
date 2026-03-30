import * as React from "react"
import { useNavigate } from "react-router-dom"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { 
  Trash2, Shield, Settings, Activity, HardDrive,
  Search, FileText, Zap, Monitor, Network, Key
} from "lucide-react"

export function CommandPalette() {
  const [open, setOpen] = React.useState(false)
  const navigate = useNavigate()

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K or Ctrl + / (standard shortcuts for palettes)
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const runCommand = React.useCallback((command: () => void) => {
    setOpen(false)
    command()
  }, [])

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search tools..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="System Cleaning">
          <CommandItem onSelect={() => runCommand(() => navigate("/junk-cleaner"))}>
            <Trash2 className="mr-2 h-4 w-4 text-amber-500" />
            <span>Junk Cleaner</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/registry"))}>
            <FileText className="mr-2 h-4 w-4 text-blue-500" />
            <span>Registry Cleaner</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/duplicate-finder"))}>
            <Search className="mr-2 h-4 w-4 text-purple-500" />
            <span>Duplicate Finder</span>
          </CommandItem>
        </CommandGroup>
        
        <CommandSeparator />
        
        <CommandGroup heading="Performance">
          <CommandItem onSelect={() => runCommand(() => navigate("/performance"))}>
            <Activity className="mr-2 h-4 w-4 text-emerald-500" />
            <span>Performance Monitor</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/turbo-boost"))}>
            <Zap className="mr-2 h-4 w-4 text-yellow-500" />
            <span>Turbo Boost</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/disk-analyzer"))}>
            <HardDrive className="mr-2 h-4 w-4 text-cyan-500" />
            <span>Disk Analyzer</span>
          </CommandItem>
        </CommandGroup>
        
        <CommandSeparator />
        
        <CommandGroup heading="Security & Network">
          <CommandItem onSelect={() => runCommand(() => navigate("/privacy"))}>
            <Shield className="mr-2 h-4 w-4 text-red-500" />
            <span>Privacy & Security</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/network-monitor"))}>
            <Network className="mr-2 h-4 w-4 text-indigo-500" />
            <span>Network Monitor</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/password-generator"))}>
            <Key className="mr-2 h-4 w-4 text-slate-500" />
            <span>Password Generator</span>
          </CommandItem>
        </CommandGroup>
        
        <CommandSeparator />
        
        <CommandGroup heading="System">
          <CommandItem onSelect={() => runCommand(() => navigate("/settings"))}>
            <Settings className="mr-2 h-4 w-4 text-gray-500" />
            <span>Settings</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/system-info"))}>
            <Monitor className="mr-2 h-4 w-4 text-sky-500" />
            <span>System Information</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
