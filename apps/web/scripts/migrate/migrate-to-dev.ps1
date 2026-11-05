# /scripts/migrate/migrate-to-dev.ps1

# ==============================================================================
# CONFIG - variables first
# ==============================================================================
$sourceSchema = "public"
$targetSchema  = "dev"
$envFile       = "$PSScriptRoot\..\..\.env.local"
$dumpFile      = "$PSScriptRoot\temp_dump_schema.sql"

Write-Host "=== SAFE DUPLICATION: $sourceSchema -> $targetSchema ===" -ForegroundColor Green

# UTF-8 encoding
chcp 65001 | Out-Null
$env:PGCLIENTENCODING = "UTF8"
$env:PGSSLMODE        = "prefer"

# Load .env.local
if (-Not (Test-Path $envFile)) {
    Write-Host "ERROR: $envFile not found" -ForegroundColor Red
    exit 1
}

Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -and $line -notlike "#*") {
        $parts = $line -split '=', 2
        if ($parts.Count -eq 2) {
            $name  = $parts[0].Trim()
            $value = $parts[1].Trim() -replace '^["'']|["'']$', ''
            Set-Item -Path "env:$name" -Value $value
        }
    }
}

$hostParam = $env:DB_HOST
$port      = if ($env:DB_PORT) { $env:DB_PORT } else { "5432" }
$user      = $env:DB_USER
$db        = $env:DB_NAME
$password  = $env:DB_PASSWORD

if (-not ($hostParam -and $user -and $db -and $password)) {
    Write-Host "ERROR: missing variables in $envFile" -ForegroundColor Red
    exit 1
}

Write-Host "  Host:    $hostParam" -ForegroundColor Cyan
Write-Host "  Port:    $port"      -ForegroundColor Cyan
Write-Host "  User:    $user"      -ForegroundColor Cyan
Write-Host "  DB:      $db"        -ForegroundColor Cyan

$env:PGPASSWORD = $password

try {
    # --- Step 1: drop the target schema ---
    Write-Host "`nStep 1: dropping target schema if it exists..." -ForegroundColor Yellow
    psql -h $hostParam -p $port -U $user -d $db `
         -c "DROP SCHEMA IF EXISTS `"$targetSchema`" CASCADE;" | Out-Null
    Write-Host "OK - $targetSchema dropped" -ForegroundColor Green

    # --- Step 2: dump ---
    Write-Host "`nStep 2: dumping $sourceSchema ..." -ForegroundColor Yellow

    # No weird escapes: pg_dump gets the clean name
    & pg_dump -h $hostParam -p $port -U $user -d $db `
              -n $sourceSchema `
              --no-owner --no-acl --encoding=UTF8 `
              -f $dumpFile

    if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with code $LASTEXITCODE" }
    Write-Host "Dump created: $dumpFile" -ForegroundColor Green

    # --- Step 3: replace the schema name ---
    Write-Host "`nStep 3: replacing schema name..." -ForegroundColor Yellow

    $content = Get-Content $dumpFile -Raw -Encoding UTF8

    # With dashes in the name, \b is unreliable — use literal replacement with quotes
    $escaped = [regex]::Escape($sourceSchema)
    $content = $content -replace "`"$escaped`"", "`"$targetSchema`""

    # In case it appears unquoted (uncommon but possible in SET search_path)
    $content = $content -replace "(?<![`"\w-])$escaped(?![`"\w-])", $targetSchema

    $content | Set-Content $dumpFile -Encoding UTF8 -Force
    Write-Host "Replacement complete" -ForegroundColor Green

    # --- Step 4: restore ---
    Write-Host "`nStep 4: restoring schema $targetSchema ..." -ForegroundColor Yellow
    & psql -h $hostParam -p $port -U $user -d $db -f $dumpFile
    if ($LASTEXITCODE -ne 0) { throw "psql restore failed with code $LASTEXITCODE" }

    Write-Host "`n✅ SUCCESS: '$targetSchema' created correctly." -ForegroundColor Green
}
catch {
    Write-Host "`nERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
finally {
    if (Test-Path $dumpFile) { Remove-Item $dumpFile -Force -ErrorAction SilentlyContinue }
    $env:PGPASSWORD        = $null
    $env:PGSSLMODE         = $null
    $env:PGCLIENTENCODING  = $null
}

# Final verification
Write-Host "`nExisting schemas:" -ForegroundColor Cyan
