$ErrorActionPreference = 'SilentlyContinue'
$sep = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
$out = ""
$csv = "Section,Key,Value`r`n"
$ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'

$out += "$sep`r`n"
$out += "  SABI — ISO 27001 INFORMATION SECURITY AUDIT REPORT`r`n"
$out += "  Generated: $ts`r`n"
$out += "  Auditor Tool: SABI (System Analytics & Boost Infrastructure)`r`n"
$out += "$sep`r`n`r`n"

# 1. SYSTEM & HARDWARE
$out += "1. SYSTEM & HARDWARE IDENTIFICATION [A.8 Asset Management]`r`n"
$out += "─────────────────────────────────────────────────────`r`n"
$os = Get-CimInstance Win32_OperatingSystem
$cs = Get-CimInstance Win32_ComputerSystem
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$ram = [math]::Round($cs.TotalPhysicalMemory / 1GB, 2)
$gpu = Get-CimInstance Win32_VideoController | Select-Object -First 1
$disk = Get-CimInstance Win32_DiskDrive
$out += "  Hostname:        $($os.CSName)`r`n"
$out += "  Domain/Workgrp:  $($cs.Domain)`r`n"
$out += "  OS:              $($os.Caption) $($os.Version)`r`n"
$out += "  Build:           $($os.BuildNumber)`r`n"
$out += "  Architecture:    $($os.OSArchitecture)`r`n"
$out += "  Install Date:    $($os.InstallDate)`r`n"
$out += "  Last Boot:       $($os.LastBootUpTime)`r`n"
$out += "  Manufacturer:    $($cs.Manufacturer)`r`n"
$out += "  Model:           $($cs.Model)`r`n"
$out += "  Serial:          $((Get-CimInstance Win32_BIOS).SerialNumber)`r`n"
$out += "  CPU:             $($cpu.Name) ($($cpu.NumberOfCores) cores / $($cpu.NumberOfLogicalProcessors) threads)`r`n"
$out += "  RAM Total:       $ram GB`r`n"
$out += "  GPU:             $($gpu.Name) ($([math]::Round($gpu.AdapterRAM/1GB,1)) GB)`r`n"
foreach ($d in $disk) { $sz = [math]::Round($d.Size/1GB,1); $out += "  Disk:            $($d.Model) ($sz GB) [$($d.MediaType)]`r`n" }
$csv += "System,Hostname,$($os.CSName)`r`n"
$csv += "System,OS,$($os.Caption) $($os.Version)`r`n"
$csv += "System,Build,$($os.BuildNumber)`r`n"
$csv += "System,Architecture,$($os.OSArchitecture)`r`n"
$csv += "System,InstallDate,$($os.InstallDate)`r`n"
$csv += "System,LastBoot,$($os.LastBootUpTime)`r`n"
$csv += "System,Manufacturer,$($cs.Manufacturer)`r`n"
$csv += "System,Model,$($cs.Model)`r`n"
$csv += "System,Serial,$((Get-CimInstance Win32_BIOS).SerialNumber)`r`n"
$csv += "System,CPU,$($cpu.Name)`r`n"
$csv += "System,RAM_GB,$ram`r`n"
$csv += "System,Domain,$($cs.Domain)`r`n"
$out += "`r`n"

# 2. BIOS & FIRMWARE
$out += "2. BIOS & FIRMWARE [A.8.9 Configuration Management]`r`n"
$out += "─────────────────────────────────────────────────────`r`n"
$bios = Get-CimInstance Win32_BIOS
$out += "  BIOS Vendor:     $($bios.Manufacturer)`r`n"
$out += "  BIOS Version:    $($bios.SMBIOSBIOSVersion)`r`n"
$out += "  Release Date:    $($bios.ReleaseDate)`r`n"
$tpm = Get-CimInstance -Namespace root\cimv2\Security\MicrosoftTpm -ClassName Win32_Tpm
if ($tpm) {
    $out += "  TPM Present:     Yes`r`n"
    $out += "  TPM Version:     $($tpm.SpecVersion)`r`n"
    $out += "  TPM Enabled:     $($tpm.IsEnabled_InitialValue)`r`n"
    $out += "  TPM Activated:   $($tpm.IsActivated_InitialValue)`r`n"
    $csv += "BIOS,TPM_Present,Yes`r`n"
    $csv += "BIOS,TPM_Version,$($tpm.SpecVersion)`r`n"
} else {
    $out += "  TPM Present:     No / Not accessible`r`n"
    $csv += "BIOS,TPM_Present,No`r`n"
}
$sb = Confirm-SecureBootUEFI 2>$null
$out += "  Secure Boot:     $(if ($sb) {'Enabled'} else {'Disabled / Not supported'})`r`n"
$csv += "BIOS,SecureBoot,$(if ($sb) {'Enabled'} else {'Disabled'})`r`n"
$csv += "BIOS,Vendor,$($bios.Manufacturer)`r`n"
$csv += "BIOS,Version,$($bios.SMBIOSBIOSVersion)`r`n"
$out += "`r`n"

# 3. ENCRYPTION STATUS
$out += "3. ENCRYPTION STATUS [A.8.24 Cryptography]`r`n"
$out += "─────────────────────────────────────────────────────`r`n"
try {
    $bl = Get-BitLockerVolume
    if ($bl) {
        foreach ($b in $bl) {
            $out += "  Volume $($b.MountPoint):`r`n"
            $out += "    Status:          $($b.VolumeStatus)`r`n"
            $out += "    Protection:      $($b.ProtectionStatus)`r`n"
            $out += "    Method:          $($b.EncryptionMethod)`r`n"
            $out += "    Encrypted %%:    $($b.EncryptionPercentage)%%`r`n"
            $out += "    Key Protector:   $(($b.KeyProtector | ForEach-Object { $_.KeyProtectorType }) -join ', ')`r`n"
            $csv += "Encryption,Volume,$($b.MountPoint)`r`n"
            $csv += "Encryption,Status_$($b.MountPoint),$($b.VolumeStatus)`r`n"
            $csv += "Encryption,Method_$($b.MountPoint),$($b.EncryptionMethod)`r`n"
            $csv += "Encryption,Percentage_$($b.MountPoint),$($b.EncryptionPercentage)`r`n"
        }
    } else { $out += "  No BitLocker volumes detected.`r`n"; $csv += "Encryption,Status,Not Configured`r`n" }
} catch { $out += "  BitLocker status unavailable (requires Admin).`r`n"; $csv += "Encryption,Status,Access Denied`r`n" }
$out += "`r`n"

# 4. LOCAL USERS & GROUPS
$out += "4. LOCAL USERS & GROUPS [A.5.15-18 Access Control]`r`n"
$out += "─────────────────────────────────────────────────────`r`n"
$users = Get-LocalUser
if ($users) {
    $out += "  {0,-25} {1,-10} {2,-25} {3}`r`n" -f "Username","Enabled","LastLogon","PasswordExpires"
    $out += "  {0,-25} {1,-10} {2,-25} {3}`r`n" -f "─────────────────────────","──────────","─────────────────────────","──────────────"
    foreach ($u in $users) {
        $lastLogon = if ($u.LastLogon) { $u.LastLogon.ToString('yyyy-MM-dd HH:mm') } else { 'Never' }
        $pwExpires = if ($u.PasswordExpires) { $u.PasswordExpires.ToString('yyyy-MM-dd') } else { 'Never' }
        $out += "  {0,-25} {1,-10} {2,-25} {3}`r`n" -f $u.Name, $u.Enabled, $lastLogon, $pwExpires
        $csv += "Users,$($u.Name),Enabled=$($u.Enabled)|LastLogon=$lastLogon|PwExpires=$pwExpires`r`n"
    }
}
$out += "`r`n  Administrators Group Members:`r`n"
try {
    $admins = Get-LocalGroupMember -Group Administrators | Select-Object Name, ObjectClass, PrincipalSource
    foreach ($a in $admins) {
        $out += "    - $($a.Name) [$($a.ObjectClass)] ($($a.PrincipalSource))`r`n"
        $csv += "Administrators,$($a.Name),$($a.ObjectClass)|$($a.PrincipalSource)`r`n"
    }
} catch { $out += "    Unable to enumerate.`r`n" }
$out += "`r`n"

# 5. PASSWORD POLICY
$out += "5. PASSWORD & LOCKOUT POLICY [A.5.17 Authentication]`r`n"
$out += "─────────────────────────────────────────────────────`r`n"
$policy = net accounts 2>&1
foreach ($line in $policy) { if ($line -match ':') { $out += "  $line`r`n"; $parts = $line -split ':\s*'; if ($parts.Count -eq 2) { $csv += "PasswordPolicy,$($parts[0].Trim()),$($parts[1].Trim())`r`n" } } }
$out += "`r`n"

# 6. AUDIT POLICY
$out += "6. AUDIT POLICY [A.8.15 Logging]`r`n"
$out += "─────────────────────────────────────────────────────`r`n"
$audit = auditpol /get /category:* 2>&1
foreach ($line in $audit) {
    $trimmed = $line.Trim()
    if ($trimmed -and $trimmed -notmatch '^(\s*$|^$)') {
        $out += "  $trimmed`r`n"
        if ($trimmed -match '^\s+(.+?)\s{2,}(.+)$') { $csv += "AuditPolicy,$($matches[1].Trim()),$($matches[2].Trim())`r`n" }
    }
}
$out += "`r`n"

# 7. WINDOWS FIREWALL
$out += "7. WINDOWS FIREWALL [A.8.20-22 Network Security]`r`n"
$out += "─────────────────────────────────────────────────────`r`n"
try {
    $fwp = Get-NetFirewallProfile
    foreach ($p in $fwp) {
        $out += "  $($p.Name):`r`n"
        $out += "    Enabled:         $($p.Enabled)`r`n"
        $out += "    Inbound:         $($p.DefaultInboundAction)`r`n"
        $out += "    Outbound:        $($p.DefaultOutboundAction)`r`n"
        $out += "    Log Allowed:     $($p.LogAllowed)`r`n"
        $out += "    Log Blocked:     $($p.LogBlocked)`r`n"
        $out += "    Log Path:        $($p.LogFileName)`r`n"
        $csv += "Firewall,$($p.Name)_Enabled,$($p.Enabled)`r`n"
        $csv += "Firewall,$($p.Name)_Inbound,$($p.DefaultInboundAction)`r`n"
        $csv += "Firewall,$($p.Name)_Outbound,$($p.DefaultOutboundAction)`r`n"
    }
    $ruleCount = (Get-NetFirewallRule | Measure-Object).Count
    $enabledRules = (Get-NetFirewallRule -Enabled True | Measure-Object).Count
    $out += "  Total Rules:     $ruleCount (Enabled: $enabledRules)`r`n"
    $csv += "Firewall,TotalRules,$ruleCount`r`n"
    $csv += "Firewall,EnabledRules,$enabledRules`r`n"
} catch { $out += "  Firewall unavailable.`r`n" }
$out += "`r`n"

# 8. ANTIVIRUS & DEFENDER
$out += "8. ANTIVIRUS & DEFENDER [A.8.7 Malware Protection]`r`n"
$out += "─────────────────────────────────────────────────────`r`n"
try {
    $av = Get-CimInstance -Namespace root\SecurityCenter2 -ClassName AntiVirusProduct
    foreach ($a in $av) {
        $out += "  Product:         $($a.displayName)`r`n"
        $out += "  Path:            $($a.pathToSignedProductExe)`r`n"
        $csv += "Antivirus,Product,$($a.displayName)`r`n"
    }
} catch {}
try {
    $def = Get-MpComputerStatus
    $out += "  Defender Status:`r`n"
    $out += "    Real-Time:       $($def.RealTimeProtectionEnabled)`r`n"
    $out += "    Behavior Mon:    $($def.BehaviorMonitorEnabled)`r`n"
    $out += "    Tamper Protect:  $($def.IsTamperProtected)`r`n"
    $out += "    Sig Version:     $($def.AntivirusSignatureVersion)`r`n"
    $out += "    Sig Updated:     $($def.AntivirusSignatureLastUpdated)`r`n"
    $out += "    Last Scan:       $($def.QuickScanEndTime)`r`n"
    $out += "    Scan Age (days): $($def.QuickScanAge)`r`n"
    $csv += "Defender,RealTimeProtection,$($def.RealTimeProtectionEnabled)`r`n"
    $csv += "Defender,TamperProtection,$($def.IsTamperProtected)`r`n"
    $csv += "Defender,SignatureVersion,$($def.AntivirusSignatureVersion)`r`n"
    $csv += "Defender,SignatureDate,$($def.AntivirusSignatureLastUpdated)`r`n"
    $csv += "Defender,LastScanDate,$($def.QuickScanEndTime)`r`n"
} catch { $out += "  Defender status unavailable.`r`n" }
$out += "`r`n"

# 9. INSTALLED SOFTWARE
$out += "9. INSTALLED SOFTWARE INVENTORY [A.8.19 Software Management]`r`n"
$out += "─────────────────────────────────────────────────────`r`n"
$apps = @()
$apps += Get-ItemProperty HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\* 2>$null
$apps += Get-ItemProperty HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\* 2>$null
$apps = $apps | Where-Object { $_.DisplayName -and $_.DisplayName.Trim() -ne '' } | Sort-Object DisplayName -Unique
$out += "  {0,-45} {1,-20} {2}`r`n" -f "Application","Version","Publisher"
$out += "  {0,-45} {1,-20} {2}`r`n" -f "─────────────────────────────────────────────","────────────────────","─────────────────────"
foreach ($app in $apps | Select-Object -First 100) {
    $name = if ($app.DisplayName.Length -gt 43) { $app.DisplayName.Substring(0,43) + '..' } else { $app.DisplayName }
    $ver = if ($app.DisplayVersion) { $app.DisplayVersion } else { 'N/A' }
    $pub = if ($app.Publisher) { $app.Publisher } else { 'N/A' }
    $out += "  {0,-45} {1,-20} {2}`r`n" -f $name, $ver, $pub
    $csv += "Software,`"$($app.DisplayName)`",$ver|$pub`r`n"
}
$out += "  Total: $($apps.Count) applications`r`n`r`n"
$csv += "Software,TotalCount,$($apps.Count)`r`n"

# 10. WINDOWS UPDATES
$out += "10. WINDOWS UPDATE STATUS [A.8.8 Vulnerability Management]`r`n"
$out += "─────────────────────────────────────────────────────`r`n"
try {
    $hotfixes = Get-HotFix | Sort-Object InstalledOn -Descending | Select-Object -First 15
    $out += "  {0,-15} {1,-20} {2}`r`n" -f "HotfixID","Installed","Description"
    $out += "  {0,-15} {1,-20} {2}`r`n" -f "───────────────","────────────────────","─────────────────────"
    foreach ($h in $hotfixes) {
        $instDate = if ($h.InstalledOn) { $h.InstalledOn.ToString('yyyy-MM-dd') } else { 'Unknown' }
        $out += "  {0,-15} {1,-20} {2}`r`n" -f $h.HotFixID, $instDate, $h.Description
        $csv += "WindowsUpdate,$($h.HotFixID),$instDate|$($h.Description)`r`n"
    }
    $totalHF = (Get-HotFix | Measure-Object).Count
    $out += "  Total Installed Patches: $totalHF`r`n"
    $csv += "WindowsUpdate,TotalPatches,$totalHF`r`n"
} catch { $out += "  Unable to query hotfixes.`r`n" }
$out += "`r`n"

# 11. RUNNING SERVICES
$out += "11. RUNNING SERVICES [A.8.9 Configuration Management]`r`n"
$out += "─────────────────────────────────────────────────────`r`n"
$services = Get-Service | Where-Object Status -eq 'Running' | Sort-Object DisplayName
$out += "  {0,-40} {1,-15} {2}`r`n" -f "Service","StartType","Name"
$out += "  {0,-40} {1,-15} {2}`r`n" -f "────────────────────────────────────────","───────────────","────────────────"
foreach ($s in $services | Select-Object -First 60) {
    $sName = if ($s.DisplayName.Length -gt 38) { $s.DisplayName.Substring(0,38) + '..' } else { $s.DisplayName }
    $out += "  {0,-40} {1,-15} {2}`r`n" -f $sName, $s.StartType, $s.Name
}
$out += "  Total Running: $($services.Count)`r`n`r`n"
$csv += "Services,TotalRunning,$($services.Count)`r`n"

# 12. NETWORK CONFIGURATION 
$out += "12. NETWORK CONFIGURATION [A.8.20 Network Security]`r`n"
$out += "─────────────────────────────────────────────────────`r`n"
$adapters = Get-NetAdapter | Where-Object Status -eq 'Up'
foreach ($a in $adapters) {
    $out += "  Adapter: $($a.Name)`r`n"
    $out += "    Description:   $($a.InterfaceDescription)`r`n"
    $out += "    MAC Address:   $($a.MacAddress)`r`n"
    $out += "    Link Speed:    $($a.LinkSpeed)`r`n"
    $ips = Get-NetIPAddress -InterfaceIndex $a.InterfaceIndex 2>$null
    foreach ($ip in $ips) { $out += "    IP Address:    $($ip.IPAddress)/$($ip.PrefixLength) [$($ip.AddressFamily)]`r`n" }
    $dns = Get-DnsClientServerAddress -InterfaceIndex $a.InterfaceIndex 2>$null | Where-Object ServerAddresses
    foreach ($d in $dns) { $out += "    DNS Servers:   $($d.ServerAddresses -join ', ')`r`n" }
    $csv += "Network,$($a.Name),MAC=$($a.MacAddress)|Speed=$($a.LinkSpeed)`r`n"
}
$gateway = Get-NetRoute -DestinationPrefix '0.0.0.0/0' 2>$null | Select-Object -First 1
if ($gateway) { $out += "  Default Gateway: $($gateway.NextHop)`r`n"; $csv += "Network,DefaultGateway,$($gateway.NextHop)`r`n" }
$out += "`r`n"

# 13. SHARED FOLDERS
$out += "13. SHARED FOLDERS [A.8.3 Information Access]`r`n"
$out += "─────────────────────────────────────────────────────`r`n"
$shares = Get-SmbShare
if ($shares) {
    foreach ($sh in $shares) {
        $out += "  $($sh.Name) → $($sh.Path) [Type: $($sh.ShareType)]`r`n"
        $csv += "SharedFolders,$($sh.Name),$($sh.Path)|$($sh.ShareType)`r`n"
    }
} else { $out += "  No shared folders found.`r`n" }
$out += "`r`n"

# 14. USB & REMOVABLE DEVICES
$out += "14. USB & REMOVABLE DEVICES [A.8.1 Asset Protection]`r`n"
$out += "─────────────────────────────────────────────────────`r`n"
$usb = Get-CimInstance Win32_USBControllerDevice | ForEach-Object { [wmi]$_.Dependent } 2>$null
$usbDevices = $usb | Where-Object { $_.Name } | Select-Object Name, DeviceID -Unique | Select-Object -First 20
if ($usbDevices) {
    foreach ($u in $usbDevices) { $out += "  $($u.Name)`r`n"; $csv += "USB,$($u.Name),Connected`r`n" }
} else { $out += "  No USB devices enumerated.`r`n" }
$out += "`r`n"

# 15. SCHEDULED TASKS
$out += "15. SCHEDULED TASKS (non-Microsoft) [A.8.9]`r`n"
$out += "─────────────────────────────────────────────────────`r`n"
$tasks = Get-ScheduledTask | Where-Object { $_.TaskPath -notlike '\Microsoft\*' -and $_.State -ne 'Disabled' } | Select-Object TaskName, TaskPath, State -First 30
if ($tasks) {
    foreach ($t in $tasks) { $out += "  $($t.TaskName) [$($t.State)] — $($t.TaskPath)`r`n"; $csv += "ScheduledTasks,$($t.TaskName),$($t.State)|$($t.TaskPath)`r`n" }
} else { $out += "  No non-Microsoft scheduled tasks found.`r`n" }
$out += "`r`n"

$out += "$sep`r`n"
$out += "  END OF ISO 27001 AUDIT REPORT`r`n"
$out += "  Total Sections: 15 | Generated: $ts`r`n"
$out += "$sep`r`n"

Write-Output "===TXT_START==="
Write-Output $out
Write-Output "===TXT_END==="
Write-Output "===CSV_START==="
Write-Output $csv
Write-Output "===CSV_END==="
