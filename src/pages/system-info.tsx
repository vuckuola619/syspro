import { useEffect, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Cpu, MemoryStick, HardDrive, Monitor, Wifi } from "lucide-react"

interface SystemDetails {
  cpu: CpuInfo
  memory: MemoryInfo
  disks: DiskDetail[]
  os: OsInfo
  gpu: string
  motherboard: string
  network: NetworkInfo[]
}

interface CpuInfo {
  name: string
  cores: number
  threads: number
  frequency_mhz: number
  usage: number
  architecture: string
}

interface MemoryInfo {
  total_gb: number
  used_gb: number
  available_gb: number
  usage_percent: number
  swap_total_gb: number
  swap_used_gb: number
}

interface DiskDetail {
  name: string
  mount_point: string
  total_gb: number
  used_gb: number
  free_gb: number
  fs_type: string
  disk_type: string
  usage_percent: number
}

interface OsInfo {
  name: string
  version: string
  hostname: string
  architecture: string
  uptime_hours: number
  kernel_version: string
}

interface NetworkInfo {
  name: string
  mac: string
  ip: string
}

function InfoGrid({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-3">
      {items.map((item, i) => (
        <div key={i} className="flex justify-between py-1.5 border-b border-border/50 last:border-0">
          <span className="text-sm text-muted-foreground">{item.label}</span>
          <span className="text-sm font-medium text-right">{item.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function SystemInfoPage() {
  const [details, setDetails] = useState<SystemDetails | null>(null)

  useEffect(() => {
    loadDetails()
  }, [])

  async function loadDetails() {
    try {
      const data = await invoke<SystemDetails>("get_system_details")
      setDetails(data)
    } catch (e) {
      console.error("Failed to load system details:", e)
      // Fallback data
      setDetails({
        cpu: {
          name: "Loading...",
          cores: 0,
          threads: 0,
          frequency_mhz: 0,
          usage: 0,
          architecture: "",
        },
        memory: {
          total_gb: 0,
          used_gb: 0,
          available_gb: 0,
          usage_percent: 0,
          swap_total_gb: 0,
          swap_used_gb: 0,
        },
        disks: [],
        os: {
          name: "Loading...",
          version: "",
          hostname: "",
          architecture: "",
          uptime_hours: 0,
          kernel_version: "",
        },
        gpu: "Loading...",
        motherboard: "Loading...",
        network: [],
      })
    }
  }

  if (!details) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading system information...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">System Information</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Detailed hardware and software specifications
        </p>
      </div>

      <Tabs defaultValue="cpu">
        <TabsList>
          <TabsTrigger value="cpu" className="gap-1.5">
            <Cpu className="h-3.5 w-3.5" />
            CPU
          </TabsTrigger>
          <TabsTrigger value="memory" className="gap-1.5">
            <MemoryStick className="h-3.5 w-3.5" />
            Memory
          </TabsTrigger>
          <TabsTrigger value="storage" className="gap-1.5">
            <HardDrive className="h-3.5 w-3.5" />
            Storage
          </TabsTrigger>
          <TabsTrigger value="os" className="gap-1.5">
            <Monitor className="h-3.5 w-3.5" />
            OS
          </TabsTrigger>
          <TabsTrigger value="network" className="gap-1.5">
            <Wifi className="h-3.5 w-3.5" />
            Network
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cpu">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                  <Cpu className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-base">{details.cpu.name}</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <InfoGrid
                items={[
                  { label: "Cores", value: String(details.cpu.cores) },
                  { label: "Threads", value: String(details.cpu.threads) },
                  { label: "Base Frequency", value: `${details.cpu.frequency_mhz} MHz` },
                  { label: "Architecture", value: details.cpu.architecture },
                  { label: "Current Usage", value: `${details.cpu.usage.toFixed(1)}%` },
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="memory">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50">
                  <MemoryStick className="h-5 w-5 text-violet-600" />
                </div>
                <CardTitle className="text-base">Memory</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <InfoGrid
                items={[
                  { label: "Total RAM", value: `${details.memory.total_gb.toFixed(1)} GB` },
                  { label: "Used", value: `${details.memory.used_gb.toFixed(1)} GB` },
                  { label: "Available", value: `${details.memory.available_gb.toFixed(1)} GB` },
                  { label: "Usage", value: `${details.memory.usage_percent.toFixed(1)}%` },
                  { label: "Swap Total", value: `${details.memory.swap_total_gb.toFixed(1)} GB` },
                  { label: "Swap Used", value: `${details.memory.swap_used_gb.toFixed(1)} GB` },
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="storage">
          <div className="space-y-4">
            {details.disks.map((disk, i) => (
              <Card key={i}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
                      <HardDrive className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-base">
                        {disk.mount_point} {disk.name && `(${disk.name})`}
                      </CardTitle>
                    </div>
                    <Badge variant={disk.usage_percent > 90 ? "destructive" : "secondary"}>
                      {disk.usage_percent.toFixed(0)}% used
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <InfoGrid
                    items={[
                      { label: "Total", value: `${disk.total_gb.toFixed(1)} GB` },
                      { label: "Used", value: `${disk.used_gb.toFixed(1)} GB` },
                      { label: "Free", value: `${disk.free_gb.toFixed(1)} GB` },
                      { label: "File System", value: disk.fs_type },
                      { label: "Type", value: disk.disk_type },
                    ]}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="os">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50">
                  <Monitor className="h-5 w-5 text-orange-600" />
                </div>
                <CardTitle className="text-base">Operating System</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <InfoGrid
                items={[
                  { label: "OS", value: details.os.name },
                  { label: "Version", value: details.os.version },
                  { label: "Hostname", value: details.os.hostname },
                  { label: "Architecture", value: details.os.architecture },
                  { label: "Kernel", value: details.os.kernel_version },
                  {
                    label: "Uptime",
                    value: `${Math.floor(details.os.uptime_hours)}h ${Math.round(
                      (details.os.uptime_hours % 1) * 60
                    )}m`,
                  },
                  { label: "GPU", value: details.gpu },
                  { label: "Motherboard", value: details.motherboard },
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="network">
          <div className="space-y-4">
            {details.network.length > 0 ? (
              details.network.map((net, i) => (
                <Card key={i}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-50">
                        <Wifi className="h-5 w-5 text-cyan-600" />
                      </div>
                      <CardTitle className="text-base">{net.name}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <InfoGrid
                      items={[
                        { label: "MAC Address", value: net.mac },
                        { label: "IP Address", value: net.ip },
                      ]}
                    />
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  No network adapters detected
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
