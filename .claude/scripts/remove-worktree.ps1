# Remove a git worktree that `git worktree remove` cannot delete.
#
# ASCII only, deliberately. Windows PowerShell 5.1 reads a .ps1 as ANSI unless
# it has a BOM, so a UTF-8 em dash arrives as three bytes of garbage and the
# parser fails somewhere unrelated. Keep punctuation plain in this file.
#
# TWO problems this exists for, both of which have bitten:
#
#  1. `git worktree remove` fails with "Filename too long". pnpm's nested
#     node_modules paths exceed Windows MAX_PATH, so git gives up and leaves
#     the whole tree behind. The \\?\ extended-length prefix deletes it fine.
#
#  2. `Remove-Item -Recurse` FOLLOWS JUNCTIONS into their targets. A worktree
#     set up with `link-main-assets.ps1` has junctions pointing at the MAIN
#     checkout's node_modules and its 3.2GB PDF library. Deleting that worktree
#     naively deletes the main checkout's content with it.
#
#     On 2026-09-12 a cleanup ran `Remove-Item -Recurse -Force` over three
#     worktrees without checking. Nothing was lost, because those three
#     happened to have no junctions. The g9-* extraction worktrees, which exist
#     precisely to read those PDFs, would have taken the library down. That
#     near-miss is why this script replaced the ad-hoc one-liner.
#
# So: unlink first, verify the unlink worked, and only then delete. If any
# junction survives, refuse. Deleting is not worth guessing about.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File .claude\scripts\remove-worktree.ps1 <name> [<name>...]
#   powershell -ExecutionPolicy Bypass -File .claude\scripts\remove-worktree.ps1 -WhatIf <name>
#
# <name> is a directory under .claude\worktrees\. Branch refs are never
# touched: anything committed in a worktree survives in its branch.

[CmdletBinding(SupportsShouldProcess)]
param(
  [Parameter(Mandatory, ValueFromRemainingArguments)]
  [string[]] $Name
)

$ErrorActionPreference = 'Stop'

# Always resolve the MAIN checkout, never "two levels up from this file".
#
# Every worktree carries its own copy of this script, so the naive relative
# path resolves to the worktree you happen to be standing in, `.claude\
# worktrees` under it does not exist, and the script reports every target as
# "absent" and silently does nothing. Caught doing exactly that in testing.
#
# `--git-common-dir` is the shared .git directory no matter which worktree you
# ask from; its parent is the main checkout.
$common = (& git -C $PSScriptRoot rev-parse --path-format=absolute --git-common-dir 2>$null)
if ($LASTEXITCODE -eq 0 -and $common) {
  $repo = Split-Path -Parent ($common.Trim())
} else {
  # Not a git repo, or a git too old for --path-format. Fall back and say so.
  $repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
  Write-Warning "git rev-parse failed; assuming repo root is $repo"
}
$worktrees = Join-Path $repo '.claude\worktrees'
Write-Host "main checkout: $repo"

function Get-Junctions([string]$root) {
  # ONLY junctions whose target is OUTSIDE the worktree. That is the precise
  # danger: a `Remove-Item -Recurse` that follows one deletes someone else's
  # files.
  #
  # A recursive scan is both wrong and unusable here. pnpm links every package
  # in node_modules as a junction into its own store, so `g8-batch` reports
  # 3545 of them; they point INSIDE the worktree and deleting the worktree is
  # exactly what should happen to them. Severing all 3545 first would be slow
  # and would break that worktree's node_modules for nothing.
  #
  # NOTE: unlink-main-assets.ps1 does do the unfiltered recursive scan, so
  # running it in a worktree with node_modules installed unlinks pnpm's
  # junctions too. Not destructive (a reinstall fixes it) but not intended.
  #
  # The dangerous set is small and known, because link-main-assets.ps1 creates
  # exactly these.
  $candidates = @(
    'node_modules'
    'lib\curriculum\node_modules'
    'attached_assets\knowledge-base-pending'
  )
  $kb = Join-Path $root 'knowledge-base'
  if (Test-Path -LiteralPath $kb) {
    Get-ChildItem -LiteralPath $kb -Directory -Force -ErrorAction SilentlyContinue |
      ForEach-Object { $candidates += "knowledge-base\$($_.Name)\support-pdfs" }
  }

  foreach ($rel in $candidates) {
    $p = Join-Path $root $rel
    if (-not (Test-Path -LiteralPath $p)) { continue }
    $item = Get-Item -LiteralPath $p -Force -ErrorAction SilentlyContinue
    if (-not $item -or -not $item.LinkType) { continue }
    # Target outside this worktree is the thing that makes it dangerous.
    $target = @($item.Target)[0]
    if ($target -and -not $target.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {
      $item
    }
  }
}

foreach ($n in $Name) {
  $path = Join-Path $worktrees $n
  Write-Host "`n=== $n ==="

  if (-not (Test-Path -LiteralPath $path)) { Write-Host "  absent"; continue }

  # --- 1. Unlink, using the repo's own teardown when the worktree has it ----
  # Guarded by ShouldProcess like the delete is: -WhatIf must report what it
  # would do without severing anything, or a dry run is not a dry run.
  $found = @(Get-Junctions $path)
  if ($found.Count -gt 0) {
    Write-Host "  $($found.Count) junction(s) present. These point at the MAIN checkout:"
    $found | ForEach-Object { Write-Host "    $($_.FullName.Substring($path.Length + 1))" }

    if ($PSCmdlet.ShouldProcess($path, "unlink $($found.Count) junction(s)")) {
      $unlink = Join-Path $path 'unlink-main-assets.ps1'
      if (Test-Path -LiteralPath $unlink) {
        Write-Host "  running unlink-main-assets.ps1"
        & powershell -ExecutionPolicy Bypass -File $unlink | ForEach-Object { "    $_" }
      }
      # Belt and braces: that script only exists on branches carrying it, and a
      # junction can outlive it.
      foreach ($j in Get-Junctions $path) {
        Write-Host "  unlinking $($j.FullName.Substring($path.Length + 1))"
        [System.IO.Directory]::Delete($j.FullName, $false)   # the link, not the target
      }
    }
  }

  # --- 2. Verify, and refuse rather than risk the main checkout ------------
  # Under -WhatIf nothing was actually unlinked, so the junctions are still
  # there by design. Checking would refuse every dry run and teach nothing.
  $left = if ($WhatIfPreference) { @() } else { @(Get-Junctions $path) }
  if ($left.Count -gt 0) {
    Write-Warning "  $($left.Count) junction(s) still present. REFUSING to delete $n."
    $left | ForEach-Object { Write-Warning "    $($_.FullName)" }
    Write-Warning "  Remove them by hand, then re-run. Deleting now could take the main checkout's node_modules and PDF library with it."
    continue
  }

  # --- 3. Delete, via \\?\ so MAX_PATH does not stop it --------------------
  if ($PSCmdlet.ShouldProcess($path, 'Remove-Item -Recurse')) {
    try {
      Remove-Item -LiteralPath "\\?\$path" -Recurse -Force -ErrorAction Stop
      Write-Host "  removed"
    } catch {
      # "used by another process" usually means a shell, editor or watcher has
      # the directory open, including the agent session that created it.
      Write-Warning "  FAILED: $($_.Exception.Message)"
    }
  }
}

# Metadata for a directory that is gone. `prune` skips entries marked `locked`,
# which is how a stale row survives a cleanup and reappears in `worktree list`.
Write-Host "`n=== pruning ==="
Push-Location $repo
git worktree list --porcelain | Select-String '^worktree (.+)$' | ForEach-Object {
  $p = $_.Matches[0].Groups[1].Value
  if ($p -like '*.claude/worktrees/*' -and -not (Test-Path -LiteralPath $p)) {
    git worktree unlock $p 2>$null | Out-Null
  }
}
git worktree prune
Write-Host "`nRemaining worktrees:"
git worktree list
Pop-Location
