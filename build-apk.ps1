param([switch]$Smoke)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$sdk = 'X:\OpenCodeTools\android-sdk'
$jdk = "$sdk\jdk-17"
$bt = "$sdk\build-tools\35.0.0"
$androidJar = "$sdk\platforms\android-35\android.jar"
$env:JAVA_HOME = $jdk
$env:TEMP = 'X:\OpenCodeTools\temp'
$env:TMP = $env:TEMP
function Run([string]$exe, [string[]]$a) { & $exe @a; if ($LASTEXITCODE -ne 0) { throw "$exe failed: $LASTEXITCODE" } }
if (-not $Smoke) {
    Run 'node.exe' @("$root\tools\generate-puzzles.cjs")
    Run 'node.exe' @('--test', "$root\tools\core.test.cjs", "$root\tools\content.test.cjs", "$root\tools\storage.test.cjs")
}
$stage = Join-Path $env:TEMP ('gomoku-study-' + [guid]::NewGuid().ToString('N'))
$build = "$stage\build"
$dist = if ($Smoke) { "$root\qa\minimal" } else { "$root\dist" }
New-Item -ItemType Directory -Force "$stage\src", $build, "$build\gen", "$build\classes", "$build\dex", $dist, "$root\keystore" | Out-Null
Copy-Item "$root\app" "$stage\src\app" -Recurse
$main = "$stage\src\app\src\main"
Run 'node.exe' @("$root\tools\build-html.cjs", "$root\web", "$main\res\raw\app.html")
Run "$bt\aapt2.exe" @('compile', '--dir', "$main\res", '-o', "$build\res.zip")
Run "$bt\aapt2.exe" @('link', '-o', "$build\base.apk", '-I', $androidJar, '--manifest', "$main\AndroidManifest.xml", '-R', "$build\res.zip", '--auto-add-overlay', '--java', "$build\gen", '--min-sdk-version', '24', '--target-sdk-version', '34')
Run "$jdk\bin\javac.exe" @('-encoding', 'UTF-8', '-source', '8', '-target', '8', '-classpath', $androidJar, '-d', "$build\classes", "$main\java\com\duan\gomokustudy\MainActivity.java", "$build\gen\com\duan\gomokustudy\R.java")
Run "$jdk\bin\jar.exe" @('cf', "$build\classes.jar", '-C', "$build\classes", '.')
Run "$jdk\bin\java.exe" @('-Xmx1024M', '-cp', "$bt\lib\d8.jar", 'com.android.tools.r8.D8', '--lib', $androidJar, '--min-api', '24', '--output', "$build\dex", "$build\classes.jar")
Copy-Item "$build\base.apk" "$build\unsigned.apk"
Push-Location "$build\dex"
try { Run "$jdk\bin\jar.exe" @('uf', "$build\unsigned.apk", 'classes.dex') } finally { Pop-Location }
Run "$bt\zipalign.exe" @('-f', '-p', '4', "$build\unsigned.apk", "$build\aligned.apk")
$key = "$root\keystore\gomoku-study.jks"
$passwordFile = "$root\keystore\password.txt"
try {
    if (-not (Test-Path $key)) {
        if (Test-Path $passwordFile) { throw 'Password exists without key. Preserve signing identity and investigate.' }
        $env:GOMOKU_KEY_PASS = [guid]::NewGuid().ToString('N')
        Set-Content -LiteralPath $passwordFile -Value $env:GOMOKU_KEY_PASS -Encoding ascii -NoNewline
        Run "$jdk\bin\keytool.exe" @('-genkeypair', '-keystore', $key, '-alias', 'gomokustudy', '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000', '-storepass:env', 'GOMOKU_KEY_PASS', '-keypass:env', 'GOMOKU_KEY_PASS', '-dname', 'CN=Gomoku Study, OU=Personal, O=Duan, C=CN')
    }
    if (-not (Test-Path $passwordFile)) { throw 'Signing key password file missing.' }
    $env:GOMOKU_KEY_PASS = (Get-Content -LiteralPath $passwordFile -Raw).Trim()
    $apk = "$dist\Gomoku-Study-v1.1.0.apk"
    Run "$jdk\bin\java.exe" @('-jar', "$bt\lib\apksigner.jar", 'sign', '--ks', $key, '--ks-key-alias', 'gomokustudy', '--ks-pass', 'env:GOMOKU_KEY_PASS', '--key-pass', 'env:GOMOKU_KEY_PASS', '--out', $apk, "$build\aligned.apk")
} finally { Remove-Item Env:\GOMOKU_KEY_PASS -ErrorAction SilentlyContinue }
Run "$jdk\bin\java.exe" @('-jar', "$bt\lib\apksigner.jar", 'verify', '--verbose', $apk)
Run "$bt\zipalign.exe" @('-c', '4', $apk)
Run "$bt\aapt2.exe" @('dump', 'badging', $apk)
Run "$bt\aapt2.exe" @('dump', 'permissions', $apk)
Copy-Item $apk "$dist\五子棋研习-v1.1.0.apk" -Force
$hash = (Get-FileHash $apk -Algorithm SHA256).Hash.ToLower()
"$hash  Gomoku-Study-v1.1.0.apk" | Set-Content "$apk.sha256" -Encoding ascii
@{stage=$stage; apk=$apk; sha256=$hash; bytes=(Get-Item $apk).Length; smoke=[bool]$Smoke} | ConvertTo-Json | Set-Content "$dist\build-info-v1.1.0.json" -Encoding utf8
Write-Host "APK: $apk"
Write-Host "SHA256: $hash"
