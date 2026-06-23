<#
.SYNOPSIS
  Importa el Catalogo Nacional de Codigos Postales (SEPOMEX) a Postgres.

.DESCRIPTION
  1) Convierte cada .xls/.xlsx de -StateDir a CSV UTF-8 usando Excel (COM),
     tomando la hoja del estado e ignorando la hoja "Nota"/"Notas".
  2) Invoca el loader (tsx db/scripts/import-cp.ts) que asegura el esquema,
     siembra hsp_estados y recarga codigos_postales (TRUNCATE + carga).

  Requiere Microsoft Excel instalado. No usa red externa.
  ASCII-only para compatibilidad con Windows PowerShell 5.1.

.PARAMETER StateDir
  Carpeta con los .xls/.xlsx (uno por estado). Por defecto C:\State.

.PARAMETER CsvDir
  Carpeta de salida para los CSV temporales. Por defecto $env:TEMP\cp_csv.

.PARAMETER SkipConvert
  Omite la conversion y carga los CSV ya existentes en -CsvDir.

.PARAMETER NoLoad
  Solo convierte a CSV; no ejecuta el loader.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File db/scripts/import-cp.ps1
  powershell -ExecutionPolicy Bypass -File db/scripts/import-cp.ps1 -StateDir "C:\State"
#>
[CmdletBinding()]
param(
  [string]$StateDir = "C:\State",
  [string]$CsvDir = (Join-Path $env:TEMP "cp_csv"),
  [switch]$SkipConvert,
  [switch]$NoLoad
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")

$xlCSVUTF8 = 62  # Excel 2016+
$xlCSV = 6       # fallback (ANSI/locale)

function Convert-XlsxToCsv {
  param([string]$OutDir)

  if (-not (Test-Path $StateDir)) {
    throw "No existe la carpeta de origen: $StateDir"
  }
  $files = Get-ChildItem -Path $StateDir -File |
    Where-Object { $_.Extension -in '.xls', '.xlsx', '.xlsm' }
  if ($files.Count -eq 0) {
    throw "No hay archivos .xls/.xlsx en $StateDir"
  }

  try {
    $excel = New-Object -ComObject Excel.Application
  } catch {
    throw "No se pudo iniciar Excel (COM). Esta instalado Microsoft Excel? Detalle: $($_.Exception.Message)"
  }
  $excel.Visible = $false
  $excel.DisplayAlerts = $false

  $notas = @("nota", "notas")
  try {
    foreach ($f in $files) {
      Write-Host ("-> Convirtiendo {0} ..." -f $f.Name) -NoNewline
      $wb = $excel.Workbooks.Open($f.FullName, $false, $true)  # ReadOnly
      try {
        # Hoja del estado = la primera que NO sea "Nota"/"Notas".
        $ws = $null
        foreach ($sheet in $wb.Worksheets) {
          if ($notas -notcontains $sheet.Name.Trim().ToLower()) { $ws = $sheet; break }
        }
        if ($null -eq $ws) { throw "sin hoja de datos (solo Nota)" }

        $csvPath = Join-Path $OutDir ("{0}.csv" -f [IO.Path]::GetFileNameWithoutExtension($f.Name))
        # Copiar la hoja a un libro nuevo y guardarlo como CSV (solo esa hoja).
        $ws.Copy()
        $newWb = $excel.ActiveWorkbook
        try {
          try { $newWb.SaveAs($csvPath, $xlCSVUTF8) }
          catch { $newWb.SaveAs($csvPath, $xlCSV) }
        } finally {
          $newWb.Close($false)
          [void][Runtime.InteropServices.Marshal]::ReleaseComObject($newWb)
        }
        Write-Host (" ok ({0})" -f [IO.Path]::GetFileName($csvPath))
      } finally {
        $wb.Close($false)
        [void][Runtime.InteropServices.Marshal]::ReleaseComObject($wb)
      }
    }
  } finally {
    $excel.Quit()
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($excel)
    [GC]::Collect(); [GC]::WaitForPendingFinalizers()
  }
}

# --- Preparar carpeta de CSV ---
if (-not (Test-Path $CsvDir)) {
  New-Item -ItemType Directory -Path $CsvDir | Out-Null
}

if (-not $SkipConvert) {
  Convert-XlsxToCsv -OutDir $CsvDir
} else {
  Write-Host ("-> Omitiendo conversion (-SkipConvert). Usando CSV en {0}" -f $CsvDir)
}

if ($NoLoad) {
  Write-Host ("OK Conversion lista. CSV en: {0} (no se ejecuto el loader)" -f $CsvDir)
  return
}

# --- Cargar a Postgres ---
Write-Host "-> Ejecutando loader (tsx db/scripts/import-cp.ts) ..."
Push-Location $RepoRoot
try {
  & pnpm exec tsx db/scripts/import-cp.ts $CsvDir
  if ($LASTEXITCODE -ne 0) { throw "El loader termino con codigo $LASTEXITCODE" }
} finally {
  Pop-Location
}
Write-Host "OK Importacion de codigos postales completada."
