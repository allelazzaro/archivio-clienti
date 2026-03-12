# ============================================================
#  FIREBASE HOSTING DEPLOY - PowerShell puro, senza CLI
#  Carica console.html e manifest.json su Firebase Hosting
# ============================================================

$SITE    = "archivio-clienti-trasporti"
$PROJECT = "archivio-clienti-trasporti"

# Cartella dove si trovano i file del progetto
$FOLDER  = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  FIREBASE DEPLOY - Autenticazione" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Apro il browser per il login Google..." -ForegroundColor Yellow
Write-Host ""

# Step 1: Device Authorization Flow Google OAuth2
$CLIENT_ID = "563584335869-fguph86makvjon41ont534qb0n99de7.apps.googleusercontent.com"
$SCOPE     = "https://www.googleapis.com/auth/firebase https://www.googleapis.com/auth/cloud-platform"

$deviceResp = Invoke-RestMethod -Method POST `
    -Uri "https://oauth2.googleapis.com/device/code" `
    -ContentType "application/x-www-form-urlencoded" `
    -Body "client_id=$CLIENT_ID&scope=$([Uri]::EscapeDataString($SCOPE))"

Write-Host "=====================================================" -ForegroundColor Green
Write-Host "  Vai su questo URL nel browser:" -ForegroundColor Green
Write-Host "  $($deviceResp.verification_url)" -ForegroundColor White
Write-Host ""
Write-Host "  Inserisci il codice: $($deviceResp.user_code)" -ForegroundColor Yellow
Write-Host "=====================================================" -ForegroundColor Green
Write-Host ""

# Apri automaticamente il browser
Start-Process $($deviceResp.verification_url)

Write-Host "Aspetto che tu completi il login..." -ForegroundColor Cyan
Write-Host "(Hai circa 5 minuti)" -ForegroundColor Gray
Write-Host ""

# Polling per il token
$token = $null
$deadline = (Get-Date).AddSeconds($deviceResp.expires_in)
$interval = $deviceResp.interval + 2

while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds $interval
    Write-Host "." -NoNewline
    try {
        $tokenResp = Invoke-RestMethod -Method POST `
            -Uri "https://oauth2.googleapis.com/token" `
            -ContentType "application/x-www-form-urlencoded" `
            -Body "client_id=$CLIENT_ID&device_code=$($deviceResp.device_code)&grant_type=urn:ietf:params:oauth:grant-type:device_code" `
            -ErrorAction Stop
        $token = $tokenResp.access_token
        break
    } catch {
        # authorization_pending = aspetta ancora
    }
}

if (-not $token) {
    Write-Host ""
    Write-Host "ERRORE: Login non completato in tempo. Riesegui lo script." -ForegroundColor Red
    pause; exit 1
}

Write-Host ""
Write-Host ""
Write-Host "Login effettuato con successo!" -ForegroundColor Green
Write-Host ""

# Helper: headers autenticazione
$headers = @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" }

# ---- Step 2: Crea nuova versione Hosting ----
Write-Host "Creazione nuova versione..." -ForegroundColor Cyan
$versionResp = Invoke-RestMethod -Method POST `
    -Uri "https://firebasehosting.googleapis.com/v1beta1/sites/$SITE/versions" `
    -Headers $headers `
    -Body '{"config":{"headers":[{"glob":"**","headers":{"Cache-Control":"no-cache, max-age=0"}}]}}'

$versionName = $versionResp.name
$versionId   = $versionName.Split("/")[-1]
Write-Host "Versione creata: $versionId" -ForegroundColor Gray

# ---- Step 3: Calcola hash SHA256 dei file da caricare ----
$files = @("console.html", "manifest.json")
$fileHashes = @{}

foreach ($f in $files) {
    $path = Join-Path $FOLDER $f
    if (-not (Test-Path $path)) {
        Write-Host "ATTENZIONE: File non trovato: $path" -ForegroundColor Yellow
        Write-Host "Assicurati che console.html e manifest.json siano nella stessa cartella di questo script." -ForegroundColor Yellow
        continue
    }
    $bytes = [System.IO.File]::ReadAllBytes($path)
    # Gzip compress
    $ms = New-Object System.IO.MemoryStream
    $gz = New-Object System.IO.Compression.GZipStream($ms, [System.IO.Compression.CompressionMode]::Compress)
    $gz.Write($bytes, 0, $bytes.Length)
    $gz.Close()
    $compressed = $ms.ToArray()
    # SHA256
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $hash = ($sha.ComputeHash($compressed) | ForEach-Object { $_.ToString("x2") }) -join ""
    $fileHashes["/$f"] = $hash
    Write-Host "  $f -> $($hash.Substring(0,16))..." -ForegroundColor Gray
}

# ---- Step 4: Popola la versione con la lista file ----
Write-Host "Invio lista file a Firebase..." -ForegroundColor Cyan
$filesBody = @{ files = $fileHashes } | ConvertTo-Json
$populateResp = Invoke-RestMethod -Method POST `
    -Uri "https://firebasehosting.googleapis.com/v1beta1/$versionName`:populateFiles" `
    -Headers $headers `
    -Body $filesBody

# ---- Step 5: Carica i file che Firebase richiede ----
$uploadToken = $populateResp.uploadToken
$toUpload    = $populateResp.uploadRequiredHashes

if ($toUpload -and $toUpload.Count -gt 0) {
    Write-Host "Caricamento file ($($toUpload.Count) file)..." -ForegroundColor Cyan

    # Inverte la mappa hash->path
    $hashToFile = @{}
    foreach ($kv in $fileHashes.GetEnumerator()) {
        $hashToFile[$kv.Value] = $kv.Key.TrimStart("/")
    }

    foreach ($hash in $toUpload) {
        $fname = $hashToFile[$hash]
        $path  = Join-Path $FOLDER $fname
        $bytes = [System.IO.File]::ReadAllBytes($path)

        # Gzip
        $ms = New-Object System.IO.MemoryStream
        $gz = New-Object System.IO.Compression.GZipStream($ms, [System.IO.Compression.CompressionMode]::Compress)
        $gz.Write($bytes, 0, $bytes.Length)
        $gz.Close()
        $compressed = $ms.ToArray()

        $uploadHeaders = @{
            "Authorization"  = "Bearer $token"
            "Content-Type"   = "application/octet-stream"
            "X-Goog-Upload-Protocol" = "raw"
        }
        Invoke-RestMethod -Method POST `
            -Uri "https://upload.googleapis.com/upload/v1beta1/sites/$SITE/versions/$versionId/files/$hash" `
            -Headers $uploadHeaders `
            -Body $compressed | Out-Null
        Write-Host "  Caricato: $fname" -ForegroundColor Gray
    }
} else {
    Write-Host "File gia' presenti su Firebase (nessun upload necessario)" -ForegroundColor Gray
}

# ---- Step 6: Finalizza la versione ----
Write-Host "Finalizzazione versione..." -ForegroundColor Cyan
Invoke-RestMethod -Method PATCH `
    -Uri "https://firebasehosting.googleapis.com/v1beta1/$versionName`?updateMask=status" `
    -Headers $headers `
    -Body '{"status":"FINALIZED"}' | Out-Null

# ---- Step 7: Pubblica (release) ----
Write-Host "Pubblicazione..." -ForegroundColor Cyan
Invoke-RestMethod -Method POST `
    -Uri "https://firebasehosting.googleapis.com/v1beta1/sites/$SITE/releases?versionName=$versionName" `
    -Headers $headers `
    -Body '{}' | Out-Null

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  DEPLOY COMPLETATO!" -ForegroundColor Green
Write-Host "  https://archivio-clienti-trasporti.web.app" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
pause