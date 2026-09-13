# Junction the gitignored assets from the main checkout into this worktree.
#
# A fresh worktree carries neither node_modules nor the source PDFs, because
# both are gitignored. Copying them is ~420MB of PDFs plus a pnpm install;
# junctions cost nothing and both trees want byte-identical content anyway.
#
# Writes through a junction land in the MAIN checkout. That is fine for what is
# linked here (node_modules and support-pdfs are read-only during extraction),
# but it is why extraction OUTPUT — lib/curriculum/src/data/extracted/ — is
# deliberately NOT linked: those files are tracked, and they must stay in the
# worktree where they can be committed on this branch.
#
# TEARDOWN, and it matters: run .\unlink-main-assets.ps1 BEFORE removing this
# worktree. `Remove-Item -Recurse` walks into a junction and deletes the
# target's contents — removing the worktree with these in place would take the
# main checkout's node_modules and PDF library with it.
#
# Usage:  powershell -ExecutionPolicy Bypass -File .\link-main-assets.ps1

$ErrorActionPreference = 'Stop'
$worktree = $PSScriptRoot
$main = (Resolve-Path (Join-Path $worktree '..\..\..')).Path

Write-Host "main checkout: $main"
Write-Host "worktree:      $worktree`n"

function New-Link($relative) {
    $target = Join-Path $main $relative
    $link = Join-Path $worktree $relative
    if (-not (Test-Path -LiteralPath $target)) {
        Write-Host "  skip (no target) $relative"
        return
    }
    if (Test-Path -LiteralPath $link) {
        $item = Get-Item -LiteralPath $link -Force
        if ($item.LinkType) {
            Write-Host "  already linked   $relative"
            return
        }
        # A real directory with content of its own: leave it alone rather than
        # shadow it. The PE and English folders this session created are real.
        if ((Get-ChildItem -LiteralPath $link -Force | Measure-Object).Count -gt 0) {
            Write-Host "  skip (real dir, has content) $relative"
            return
        }
        Remove-Item -LiteralPath $link -Force
    }
    $parent = Split-Path -Parent $link
    if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    New-Item -ItemType Junction -Path $link -Target $target | Out-Null
    Write-Host "  linked           $relative"
}

# Dependencies: the root store plus the one package whose script we run.
New-Link 'node_modules'
New-Link 'lib\curriculum\node_modules'

# Source PDFs, one gitignored folder per subject.
Get-ChildItem -LiteralPath (Join-Path $main 'knowledge-base') -Directory |
    ForEach-Object { New-Link "knowledge-base\$($_.Name)\support-pdfs" }

# attached_assets holds the rest of the corpus (math/chem support material).
New-Link 'attached_assets\knowledge-base-pending'

Write-Host "`nDone. Remember: .\unlink-main-assets.ps1 before removing the worktree."
