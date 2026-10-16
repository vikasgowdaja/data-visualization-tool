param(
    [switch]$Once,
    [string]$Namespace = "data-visualization-tool",
    [string]$KustomizePath = "k8s",
    [ValidateSet("auto", "kind", "minikube", "docker-desktop", "none")]
    [string]$ClusterType = "auto",
    [int]$DebounceMilliseconds = 1200
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$backendImageRepo = "datascience-lab-backend"
$frontendImageRepo = "datascience-lab-frontend"
$backendDeployment = "datascience-lab-backend"
$frontendDeployment = "datascience-lab-frontend"
$watchRoots = @(
    (Join-Path $repoRoot "backend"),
    (Join-Path $repoRoot "frontend"),
    (Join-Path $repoRoot "k8s")
)

$script:isRunning = $false
$script:pending = $false
$script:lastEventAt = Get-Date
$script:lastEventPath = ""

function Write-Step([string]$message) {
    $stamp = (Get-Date).ToString("HH:mm:ss")
    Write-Host "[$stamp] $message"
}

function Test-Command([string]$name) {
    $command = Get-Command $name -ErrorAction SilentlyContinue
    if ($null -eq $command) {
        throw "Required command '$name' was not found in PATH."
    }
}

function Resolve-ClusterType([string]$requestedType) {
    if ($requestedType -ne "auto") {
        return $requestedType
    }
    $context = (kubectl config current-context).Trim()
    if ($context -like "kind-*") {
        return "kind"
    }
    if ($context -match "minikube") {
        return "minikube"
    }
    if ($context -match "docker-desktop") {
        return "docker-desktop"
    }
    return "none"
}

function Invoke-LocalDeploy([string]$detectedClusterType) {
    if ($script:isRunning) {
        return
    }
    $script:isRunning = $true
    try {
        $tag = (Get-Date).ToString("yyyyMMddHHmmss")
        $backendImage = "${backendImageRepo}:$tag"
        $frontendImage = "${frontendImageRepo}:$tag"

        Write-Step "Building backend image: $backendImage"
        docker build -t $backendImage -t "$backendImageRepo`:latest" "$repoRoot\backend"

        Write-Step "Building frontend image: $frontendImage"
        docker build -t $frontendImage -t "$frontendImageRepo`:latest" --build-arg "VITE_API_BASE_URL=/api" "$repoRoot\frontend"

        if ($detectedClusterType -eq "kind") {
            Write-Step "Loading images into kind cluster"
            kind load docker-image $backendImage "$backendImageRepo`:latest"
            kind load docker-image $frontendImage "$frontendImageRepo`:latest"
        } elseif ($detectedClusterType -eq "minikube") {
            Write-Step "Loading images into minikube cluster"
            minikube image load $backendImage
            minikube image load "$backendImageRepo`:latest"
            minikube image load $frontendImage
            minikube image load "$frontendImageRepo`:latest"
        } else {
            Write-Step "Skipping explicit image load for cluster type '$detectedClusterType'"
        }

        Write-Step "Applying Kubernetes manifests from '$KustomizePath'"
        kubectl apply -k (Join-Path $repoRoot $KustomizePath)

        Write-Step "Updating deployment images"
        kubectl -n $Namespace set image "deployment/$backendDeployment" "backend=$backendImage"
        kubectl -n $Namespace set image "deployment/$frontendDeployment" "frontend=$frontendImage"

        Write-Step "Waiting for rollout status"
        kubectl -n $Namespace rollout status "deployment/$backendDeployment" --timeout=180s
        kubectl -n $Namespace rollout status "deployment/$frontendDeployment" --timeout=180s

        Write-Step "Deployment successful (tag: $tag)"
    } finally {
        $script:isRunning = $false
    }
}

Test-Command "docker"
Test-Command "kubectl"

$selectedClusterType = Resolve-ClusterType -requestedType $ClusterType
if ($selectedClusterType -eq "kind") {
    Test-Command "kind"
}
if ($selectedClusterType -eq "minikube") {
    Test-Command "minikube"
}

Write-Step "Repository root: $repoRoot"
Write-Step "Cluster type: $selectedClusterType"
Write-Step "Namespace: $Namespace"

Invoke-LocalDeploy -detectedClusterType $selectedClusterType

if ($Once) {
    exit 0
}

$watchers = @()
$eventSubscriptions = @()
try {
    foreach ($root in $watchRoots) {
        if (-not (Test-Path $root)) {
            throw "Watch path not found: $root"
        }
        $watcher = New-Object System.IO.FileSystemWatcher
        $watcher.Path = $root
        $watcher.IncludeSubdirectories = $true
        $watcher.NotifyFilter = [System.IO.NotifyFilters]"FileName, LastWrite, DirectoryName, CreationTime"
        $watcher.EnableRaisingEvents = $true
        $watchers += $watcher

        $action = {
            $changedPath = $Event.SourceEventArgs.FullPath
            $normalized = $changedPath.ToLowerInvariant()
            if (
                $normalized.Contains("\.git\") -or
                $normalized.Contains("\node_modules\") -or
                $normalized.Contains("\dist\") -or
                $normalized.Contains("\__pycache__\") -or
                $normalized.Contains("\.pytest_cache\") -or
                $normalized.Contains("\backend\data\generated\") -or
                $normalized.EndsWith(".pyc")
            ) {
                return
            }
            $script:pending = $true
            $script:lastEventAt = Get-Date
            $script:lastEventPath = $changedPath
        }

        $eventSubscriptions += Register-ObjectEvent -InputObject $watcher -EventName Changed -Action $action
        $eventSubscriptions += Register-ObjectEvent -InputObject $watcher -EventName Created -Action $action
        $eventSubscriptions += Register-ObjectEvent -InputObject $watcher -EventName Renamed -Action $action
        $eventSubscriptions += Register-ObjectEvent -InputObject $watcher -EventName Deleted -Action $action
    }

    Write-Step "Watching for source/config changes. Press Ctrl+C to stop."
    while ($true) {
        Start-Sleep -Milliseconds 500
        if ($script:pending -and -not $script:isRunning) {
            $elapsedMs = ((Get-Date) - $script:lastEventAt).TotalMilliseconds
            if ($elapsedMs -ge $DebounceMilliseconds) {
                $script:pending = $false
                if ($script:lastEventPath) {
                    Write-Step "Detected change: $($script:lastEventPath)"
                }
                Invoke-LocalDeploy -detectedClusterType $selectedClusterType
            }
        }
    }
} finally {
    foreach ($subscription in $eventSubscriptions) {
        if ($null -ne $subscription) {
            Unregister-Event -SubscriptionId $subscription.Id -ErrorAction SilentlyContinue
        }
    }
    foreach ($watcher in $watchers) {
        if ($null -ne $watcher) {
            $watcher.EnableRaisingEvents = $false
            $watcher.Dispose()
        }
    }
}
