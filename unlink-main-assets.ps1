# Remove the junctions created by link-main-assets.ps1.
#
# Run this BEFORE deleting the worktree. `Remove-Item -Recurse` follows a
# junction into its target, so removing the worktree with these in place would
# delete the main checkout's node_modules and its whole PDF library.
#
# Uses Directory.Delete on the junction itself, which unlinks without touching
# the target.
#
# Usage:  powershell -ExecutionPolicy Bypass -File .\unlink-main-assets.ps1

$ErrorActionPreference = 'Stop'
$worktree = $PSScriptRoot
$removed = 0

Get-ChildItem -LiteralPath $worktree -Recurse -Force -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.LinkType -eq 'Junction' } |
    ForEach-Object {
        Write-Host "  unlinking $($_.FullName.Substring($worktree.Length + 1))"
        [System.IO.Directory]::Delete($_.FullName, $false)
        $script:removed++
    }

Write-Host "`nRemoved $removed junction(s). Safe to remove the worktree now."
