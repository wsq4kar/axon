# Скачивает ядра для сборки в src-tauri/binaries. Версии закреплены: конфиги Axon
# написаны под sing-box 1.11 — переход на новую ветку делается вместе с генератором.
$ErrorActionPreference = 'Stop'
$SingBox = '1.11.15'
$Xray = 'v26.3.27'
$dst = Join-Path $PSScriptRoot '..\src-tauri\binaries'
New-Item -ItemType Directory -Force -Path $dst | Out-Null
$tmp = Join-Path $env:RUNNER_TEMP 'cores'
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

$sb = "https://github.com/SagerNet/sing-box/releases/download/v$SingBox/sing-box-$SingBox-windows-amd64.zip"
Invoke-WebRequest $sb -OutFile "$tmp\sb.zip"
Expand-Archive "$tmp\sb.zip" -DestinationPath "$tmp\sb" -Force
Copy-Item (Get-ChildItem "$tmp\sb" -Recurse -Filter 'sing-box.exe' | Select-Object -First 1).FullName $dst

$xr = "https://github.com/XTLS/Xray-core/releases/download/$Xray/Xray-windows-64.zip"
Invoke-WebRequest $xr -OutFile "$tmp\xr.zip"
Expand-Archive "$tmp\xr.zip" -DestinationPath "$tmp\xr" -Force
Copy-Item "$tmp\xr\xray.exe" $dst

Get-ChildItem $dst | Format-Table Name, Length
