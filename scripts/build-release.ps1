param(
    [string]$ArchiveName = "dipomm-release.zip"
)

$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$OutputDir = Join-Path $ProjectRoot "outputs"
$StageDir = Join-Path $OutputDir "dipomm-release"
$ArchivePath = Join-Path $OutputDir $ArchiveName

$excludedNames = @(
    ".git",
    ".pytest_cache",
    ".tools",
    ".venv",
    ".venv312",
    "node_modules",
    "__pycache__",
    "outputs",
    "backups",
    "static\uploads"
)

$excludedFiles = @(
    ".env",
    "farm.db",
    "farmmarket.db",
    "runtime_test_ok.db",
    "served_check.js",
    "committed_ref.js",
    "_mojibake.txt",
    "_unmatched.txt",
    "uvicorn.out.log",
    "uvicorn.err.log",
    "uvicorn-8000.log",
    "uvicorn-8000.err.log"
)

$excludedPatterns = @(
    "*.pyc",
    "*.log",
    "shot_*.png"
)

function Test-IsExcluded {
    param(
        [System.IO.FileSystemInfo]$Item,
        [string]$Root = $ProjectRoot
    )

    $rootFull = [System.IO.Path]::GetFullPath($Root).TrimEnd("\") + "\"
    $itemFull = [System.IO.Path]::GetFullPath($Item.FullName)
    if ($itemFull.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
        $relative = $itemFull.Substring($rootFull.Length)
    } else {
        $relative = $Item.Name
    }
    $normalized = $relative.Replace("/", "\")
    foreach ($name in $excludedNames) {
        $normalizedName = $name.TrimEnd("\")
        if (
            $normalized -eq $normalizedName `
            -or $normalized.StartsWith("$normalizedName\") `
            -or $normalized.Contains("\$normalizedName\") `
            -or $normalized.EndsWith("\$normalizedName")
        ) {
            return $true
        }
    }

    if (-not $Item.PSIsContainer) {
        foreach ($file in $excludedFiles) {
            if ($normalized -eq $file) {
                return $true
            }
        }
        foreach ($pattern in $excludedPatterns) {
            if ($Item.Name -like $pattern) {
                return $true
            }
        }
    }

    return $false
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
if (Test-Path $StageDir) {
    Remove-Item -LiteralPath $StageDir -Recurse -Force
}
if (Test-Path $ArchivePath) {
    Remove-Item -LiteralPath $ArchivePath -Force
}
New-Item -ItemType Directory -Force -Path $StageDir | Out-Null

Get-ChildItem -LiteralPath $ProjectRoot -Force | Where-Object { -not (Test-IsExcluded $_) } | ForEach-Object {
    $target = Join-Path $StageDir $_.Name
    if ($_.PSIsContainer) {
        Copy-Item -LiteralPath $_.FullName -Destination $target -Recurse -Force
    } else {
        Copy-Item -LiteralPath $_.FullName -Destination $target -Force
    }
}

Get-ChildItem -LiteralPath $StageDir -Recurse -Force | Where-Object { Test-IsExcluded $_ $StageDir } | ForEach-Object {
    Remove-Item -LiteralPath $_.FullName -Recurse -Force
}

Compress-Archive -Path (Join-Path $StageDir "*") -DestinationPath $ArchivePath -Force
Remove-Item -LiteralPath $StageDir -Recurse -Force
Write-Host "Release archive created: $ArchivePath"
