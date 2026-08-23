param(
    [Parameter(Mandatory = $true)]
    [string[]]$AllowedDeviceIp,
    [string]$OwnerLogin = 'adityaprasadiskool@gmail.com',
    [string]$SillyTavernRoot = 'C:\Users\adity\Documents\Ongoing Local\ST\runtime\SillyTavern-1.18.0',
    [switch]$Apply
)

$ErrorActionPreference = 'Stop'
$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$hardeningScript = Join-Path $scriptDirectory 'apply-sillytavern-hardening.ps1'
$taskNames = @('LexiconForge-SillyTavern', 'LexiconForge-Portal-Bridge')
$targetPorts = @('8000', '8444', '5001')

function Invoke-CheckedCommand {
    param([string]$Executable, [string[]]$Arguments)
    $output = & $Executable @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "$Executable $($Arguments -join ' ') failed (exit $LASTEXITCODE): $($output -join [Environment]::NewLine)"
    }
    return $output
}

function Get-ServeStatus {
    $raw = Invoke-CheckedCommand 'tailscale' @('serve', 'status', '--json')
    return ($raw -join [Environment]::NewLine) | ConvertFrom-Json
}

function Assert-NoFunnel {
    $raw = Invoke-CheckedCommand 'tailscale' @('funnel', 'status', '--json')
    $status = ($raw -join [Environment]::NewLine) | ConvertFrom-Json
    if ($null -ne $status.AllowFunnel -and $status.AllowFunnel.PSObject.Properties.Count -gt 0) {
        throw 'Tailscale Funnel is enabled for at least one endpoint. Public exposure is prohibited.'
    }
}

function Get-UnrelatedRouteMap {
    param($Status)
    $routes = @{}
    foreach ($property in $Status.TCP.PSObject.Properties) {
        if ($targetPorts -notcontains $property.Name) {
            $routes["TCP|$($property.Name)"] = $property.Value | ConvertTo-Json -Depth 20 -Compress
        }
    }
    foreach ($property in $Status.Web.PSObject.Properties) {
        $port = $property.Name.Split(':')[-1]
        if ($targetPorts -notcontains $port) {
            $routes["WEB|$($property.Name)"] = $property.Value | ConvertTo-Json -Depth 20 -Compress
        }
    }
    return $routes
}

function Assert-MapsEqual {
    param([hashtable]$Before, [hashtable]$After)
    if ($Before.Count -ne $After.Count) {
        throw "Unrelated Serve route count changed from $($Before.Count) to $($After.Count)."
    }
    foreach ($key in $Before.Keys) {
        if (-not $After.ContainsKey($key) -or $After[$key] -ne $Before[$key]) {
            throw "Unrelated Serve route changed during cutover: $key"
        }
    }
}

function Get-WebProxy {
    param($Status, [string]$DnsName, [string]$Port)
    $endpoint = "$DnsName`:$Port"
    $webProperty = $Status.Web.PSObject.Properties[$endpoint]
    if ($null -eq $webProperty) {
        return $null
    }
    return $webProperty.Value.Handlers.'/'.Proxy
}

function Assert-Endpoint {
    param(
        $Status,
        [string]$DnsName,
        [string]$Port,
        [string]$Protocol,
        [string]$ExpectedProxy,
        [bool]$MayBeAbsent
    )
    $tcpProperty = $Status.TCP.PSObject.Properties[$Port]
    $proxy = Get-WebProxy $Status $DnsName $Port
    if ($null -eq $tcpProperty -and $null -eq $proxy -and $MayBeAbsent) {
        return
    }
    if ($null -eq $tcpProperty -or $tcpProperty.Value.$Protocol -ne $true) {
        throw "Serve endpoint $Protocol port $Port is absent or has the wrong protocol."
    }
    if ($proxy -ne $ExpectedProxy) {
        throw "Serve endpoint port $Port must proxy to $ExpectedProxy; found $proxy."
    }
}

function Wait-ForLocalRuntime {
    param([string]$Login)
    $deadline = [DateTime]::UtcNow.AddSeconds(30)
    $lastError = 'no probe attempted'
    while ([DateTime]::UtcNow -lt $deadline) {
        try {
            Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8000/' -TimeoutSec 4 | Out-Null
            $headers = @{ 'Tailscale-User-Login' = $Login }
            $health = Invoke-RestMethod -Uri 'http://127.0.0.1:5001/health' -Headers $headers -TimeoutSec 4
            if ($health.ready -eq $true) {
                return
            }
            $lastError = "bridge health returned ready=$($health.ready): $($health.message)"
        } catch {
            $lastError = $_.Exception.Message
        }
        Start-Sleep -Seconds 2
    }
    throw "Local runtime did not become ready within 30 seconds: $lastError"
}

if (-not (Test-Path -LiteralPath $hardeningScript -PathType Leaf)) {
    throw "Required hardening verifier is missing: $hardeningScript"
}

& $hardeningScript -AllowedDeviceIp $AllowedDeviceIp -SillyTavernRoot $SillyTavernRoot

foreach ($taskName in $taskNames) {
    $task = Get-ScheduledTask -TaskName $taskName -ErrorAction Stop
    if ($task.State -notin @('Disabled', 'Ready', 'Running')) {
        throw "Scheduled task $taskName is in unexpected state $($task.State)."
    }
}

Assert-NoFunnel
$tailscaleStatus = (Invoke-CheckedCommand 'tailscale' @('status', '--json') -join [Environment]::NewLine) | ConvertFrom-Json
$dnsName = $tailscaleStatus.Self.DNSName.TrimEnd('.')
if (-not $dnsName) {
    throw 'Tailscale status did not report this device DNS name.'
}

$before = Get-ServeStatus
$unrelatedBefore = Get-UnrelatedRouteMap $before
Assert-Endpoint $before $dnsName '8000' 'HTTP' 'http://127.0.0.1:8000' $true
Assert-Endpoint $before $dnsName '8444' 'HTTPS' 'http://127.0.0.1:8000' $true
Assert-Endpoint $before $dnsName '5001' 'HTTPS' 'http://127.0.0.1:5001' $true

if (-not $Apply) {
    Write-Host 'Cutover preflight passed. No state changed; re-run with -Apply to remove HTTP :8000 and enable the two HTTPS routes.'
    exit 0
}

$addedSillyTavernRoute = $false
$addedBridgeRoute = $false
try {
    if ($null -ne (Get-WebProxy $before $dnsName '8000')) {
        Invoke-CheckedCommand 'tailscale' @('serve', '--http=8000', '--yes', 'off') | Out-Null
        Write-Host 'Removed the exact stale cleartext Serve listener on port 8000.'
    }

    foreach ($taskName in $taskNames) {
        Enable-ScheduledTask -TaskName $taskName | Out-Null
        Start-ScheduledTask -TaskName $taskName
    }
    Wait-ForLocalRuntime $OwnerLogin

    $current = Get-ServeStatus
    if ($null -eq (Get-WebProxy $current $dnsName '8444')) {
        Invoke-CheckedCommand 'tailscale' @('serve', '--bg', '--https=8444', '--yes', 'http://127.0.0.1:8000') | Out-Null
        $addedSillyTavernRoute = $true
    }
    if ($null -eq (Get-WebProxy $current $dnsName '5001')) {
        Invoke-CheckedCommand 'tailscale' @('serve', '--bg', '--https=5001', '--yes', 'http://127.0.0.1:5001') | Out-Null
        $addedBridgeRoute = $true
    }

    $after = Get-ServeStatus
    if ($null -ne (Get-WebProxy $after $dnsName '8000')) {
        throw 'Cleartext Serve endpoint port 8000 still exists after removal.'
    }
    Assert-Endpoint $after $dnsName '8444' 'HTTPS' 'http://127.0.0.1:8000' $false
    Assert-Endpoint $after $dnsName '5001' 'HTTPS' 'http://127.0.0.1:5001' $false
    Assert-MapsEqual $unrelatedBefore (Get-UnrelatedRouteMap $after)
    Assert-NoFunnel
} catch {
    if ($addedBridgeRoute) {
        Invoke-CheckedCommand 'tailscale' @('serve', '--https=5001', '--yes', 'off') | Out-Null
    }
    if ($addedSillyTavernRoute) {
        Invoke-CheckedCommand 'tailscale' @('serve', '--https=8444', '--yes', 'off') | Out-Null
    }
    foreach ($taskName in $taskNames) {
        Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
        Disable-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue | Out-Null
    }
    throw "Portal cutover failed and new HTTPS routes/tasks were rolled back. The stale HTTP route remains removed. $($_.Exception.Message)"
}

Write-Host "Portal cutover passed: https://$dnsName`:8444 and https://$dnsName`:5001 are tailnet-only; unrelated routes are unchanged."
