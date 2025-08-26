# PowerShell script to organize version control backups
# Run this after the browser downloads backup files

param(
    [Parameter(Mandatory=$true)]
    [string]$VersionNumber
)

$ProjectPath = $PSScriptRoot
$VersionsPath = Join-Path $ProjectPath "versions"
$VersionPath = Join-Path $VersionsPath "version-$VersionNumber"
$DownloadsPath = "$env:USERPROFILE\Downloads"

Write-Host "🔄 Organizing backup for version $VersionNumber" -ForegroundColor Cyan
Write-Host "Project path: $ProjectPath" -ForegroundColor Gray
Write-Host "Downloads path: $DownloadsPath" -ForegroundColor Gray

# Create version directory if it doesn't exist
if (-not (Test-Path $VersionPath)) {
    New-Item -ItemType Directory -Path $VersionPath -Force | Out-Null
    Write-Host "✅ Created directory: $VersionPath" -ForegroundColor Green
}

# Find all files for this version in Downloads
$BackupFiles = Get-ChildItem -Path $DownloadsPath -Filter "version-$VersionNumber-*"

if ($BackupFiles.Count -eq 0) {
    Write-Host "❌ No backup files found for version $VersionNumber in Downloads folder" -ForegroundColor Red
    Write-Host "Looking for files matching pattern: version-$VersionNumber-*" -ForegroundColor Yellow
    exit 1
}

Write-Host "📁 Found $($BackupFiles.Count) backup files" -ForegroundColor Green

$OrganizedCount = 0

foreach ($File in $BackupFiles) {
    try {
        # Remove the version prefix to get the original filename
        $OriginalName = $File.Name -replace "^version-$VersionNumber-", ""
        
        # Handle folder structure (replace dashes with slashes for paths)
        if ($OriginalName -match "^(js|css)-") {
            $FolderName = ($OriginalName -split "-")[0]
            $FileName = ($OriginalName -split "-", 2)[1]
            
            $FolderPath = Join-Path $VersionPath $FolderName
            if (-not (Test-Path $FolderPath)) {
                New-Item -ItemType Directory -Path $FolderPath -Force | Out-Null
            }
            $DestinationPath = Join-Path $FolderPath $FileName
        } else {
            $DestinationPath = Join-Path $VersionPath $OriginalName
        }
        
        # Move the file
        Move-Item -Path $File.FullName -Destination $DestinationPath -Force
        Write-Host "📥 Moved: $($File.Name) → $OriginalName" -ForegroundColor White
        $OrganizedCount++
    }
    catch {
        Write-Host "❌ Failed to move $($File.Name): $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "🎉 Backup organization complete!" -ForegroundColor Green
Write-Host "✅ Organized $OrganizedCount files" -ForegroundColor Green
Write-Host "📂 Location: $VersionPath" -ForegroundColor Cyan

# Create a completion marker
$CompletionFile = Join-Path $VersionPath "BACKUP_COMPLETE.txt"
@"
Backup Version $VersionNumber - COMPLETE

Organized on: $(Get-Date)
Files processed: $OrganizedCount
Location: $VersionPath

This backup is ready for use with the version control system.
To restore: Use console command vc.restore($([int]$VersionNumber))
"@ | Out-File -FilePath $CompletionFile -Encoding UTF8

Write-Host ""
Write-Host "🚀 Backup version $VersionNumber is ready!" -ForegroundColor Magenta
Write-Host "Use: vc.restore($([int]$VersionNumber)) to restore this version" -ForegroundColor Yellow