<#
    sync-gpt-images.ps1
    将 Downloads 中 ChatGPT 生成的图片同步到 Share/Image-Share，
    自动更新 index.json，提交并推送至 GitHub。
#>

$ErrorActionPreference = "Stop"

# ===== 路径配置 =====
$sourceDir   = "C:\Users\25382\Downloads"
$targetDir   = "D:\AI Related\Jillax.github.io\Share\Image-Share"
$repoDir     = "D:\AI Related\Jillax.github.io"
$indexFile   = Join-Path $targetDir "index.json"

Write-Host "[sync] 扫描下载目录..."

# 查找 ChatGPT 图片（按文件名模式匹配）
$gptImages = Get-ChildItem -Path $sourceDir -File | Where-Object {
    $_.Name -like "ChatGPT Image *" -and $_.Extension -match '\.(png|jpg|jpeg|gif|webp|bmp)$'
}

if ($gptImages.Count -eq 0) {
    Write-Host "[sync] 未找到 ChatGPT 图片"
    exit 0
}

Write-Host ("[sync] 找到 " + $gptImages.Count + " 张 ChatGPT 图片")

# 检查哪些文件尚未同步
$existingNames = @(Get-ChildItem -Path $targetDir -File | Where-Object { $_.Name -ne "index.json" } | ForEach-Object { $_.Name })

$newFiles = @()
foreach ($img in $gptImages) {
    if ($existingNames -contains $img.Name) {
        Write-Host ("[sync] 跳过（已存在）: " + $img.Name)
        continue
    }
    $newFiles += $img
}

if ($newFiles.Count -eq 0) {
    Write-Host "[sync] 没有新图片需要同步"
    exit 0
}

Write-Host ("[sync] 同步 " + $newFiles.Count + " 张新图片...")

# 复制文件
foreach ($img in $newFiles) {
    $dest = Join-Path $targetDir $img.Name
    Copy-Item -Path $img.FullName -Destination $dest -Force
    Write-Host ("[sync] 已复制: " + $img.Name)
}

# ===== 生成 index.json =====
Write-Host "[sync] 更新 index.json..."

$allFiles = Get-ChildItem -Path $targetDir -File | Where-Object { $_.Name -ne "index.json" } | Sort-Object Name

$filesArray = @()
foreach ($f in $allFiles) {
    $filesArray += @{
        name = $f.Name
        type = "file"
        size = $f.Length
    }
}

$indexContent = @{
    files   = $filesArray
    updated = (Get-Date -Format "yyyy-MM-dd")
}

$json = $indexContent | ConvertTo-Json
Set-Content -Path $indexFile -Value $json -Encoding UTF8
Write-Host "[sync] index.json 已更新"

# ===== Git 提交并推送 =====
Write-Host "[sync] 提交并推送至 GitHub..."

Push-Location $repoDir
try {
    git add "Share/Image-Share/"
    $hasChanges = git status --porcelain
    if ($hasChanges) {
        $count = $newFiles.Count
        $msg = "auto: sync " + $count + " GPT image(s) to Share/Image-Share"
        git commit -m $msg *>$null
        git push *>$null
        Write-Host "[sync] 已推送至 GitHub"
    } else {
        Write-Host "[sync] 无变更，跳过提交"
    }
} finally {
    Pop-Location
}

Write-Host "[sync] 完成"
