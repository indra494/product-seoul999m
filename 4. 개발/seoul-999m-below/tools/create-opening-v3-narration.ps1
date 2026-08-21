param(
  [string]$OutputRoot = "C:\data\game_builders\3. 설계\영상\프롤로그\v3",
  [ValidateRange(-10, 10)]
  [int]$Rate = 10,
  [double]$MaximumDuration = 27.0
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Speech

$segments = @(
  "지상은 죽었다. 하늘은 독성 먼지로 뒤덮였고, 인류는 더 이상 그곳에서 숨을 쉴 수 없었다.",
  "살아남은 사람들은 땅속으로 내려갔다.",
  "지하 구백구십구 미터. 과거에 건설된 공기 정화층이 아직 작동하는, 마지막 생존 가능 구역이었다.",
  "서울도 그곳에 새로운 도시를 세웠다. 전력망과 공장, 통신망은 무너졌고 사람들은 버려진 기계와 고철을 이어 붙이며 문명을 다시 시작했다.",
  "세계의 지하 도시들은 비밀 터널로 연결되었다. 자원과 연구 자료가 오갔고, 각 도시의 연구자들은 언젠가 지상을 되살리기 위한 연구를 계속했다.",
  "하지만 터널을 통해 오간 것은 희망만이 아니었다. 부족한 자원, 정체불명의 생물, 그리고 주인을 잃은 기계들이 도시 사이의 어둠을 차지하기 시작했다.",
  "나는 서울의 두더지다. 땅을 파고, 자원을 찾고, 새로운 도시로 향하는 길을 만드는 사람. 오늘도 평범한 굴착 작업이어야 했다.",
  "우리가 먼저 이곳에 온 것이 아니라는 사실을 발견하기 전까지는."
)

$audioRoot = Join-Path $OutputRoot "audio"
$tempRoot = Join-Path $env:TEMP "seoul-999m-opening-v3-voice"
New-Item -ItemType Directory -Force -Path $audioRoot, $tempRoot | Out-Null

function Read-WaveData([string]$Path) {
  $bytes = [System.IO.File]::ReadAllBytes($Path)
  $position = 12
  $format = $null
  $data = $null
  while ($position + 8 -le $bytes.Length) {
    $chunkId = [System.Text.Encoding]::ASCII.GetString($bytes, $position, 4)
    $chunkSize = [BitConverter]::ToInt32($bytes, $position + 4)
    if ($chunkId -eq "fmt ") {
      $format = $bytes[($position + 8)..($position + 8 + $chunkSize - 1)]
    } elseif ($chunkId -eq "data") {
      $data = $bytes[($position + 8)..($position + 8 + $chunkSize - 1)]
      break
    }
    $position += 8 + $chunkSize + ($chunkSize % 2)
  }
  if ($null -eq $format -or $null -eq $data) { throw "Invalid WAV: $Path" }
  [pscustomobject]@{
    Format = $format
    Data = $data
    SampleRate = [BitConverter]::ToInt32($format, 4)
    ByteRate = [BitConverter]::ToInt32($format, 8)
    BlockAlign = [BitConverter]::ToInt16($format, 12)
  }
}

$waves = @()
for ($index = 0; $index -lt $segments.Count; $index += 1) {
  $path = Join-Path $tempRoot ("segment-{0:d2}.wav" -f ($index + 1))
  $speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
  try {
    $speaker.SelectVoice("Microsoft Heami Desktop")
    $speaker.Rate = $Rate
    $speaker.Volume = 100
    $speaker.SetOutputToWaveFile($path)
    $speaker.Speak($segments[$index])
  } finally {
    $speaker.Dispose()
  }
  $waves += Read-WaveData $path
}

$reference = $waves[0]
$gapSeconds = 0.08
$gapBytes = [int]([Math]::Round($reference.ByteRate * $gapSeconds / $reference.BlockAlign) * $reference.BlockAlign)
$silence = New-Object byte[] $gapBytes
$memory = New-Object System.IO.MemoryStream
$timings = @()
$cursorBytes = 0
for ($index = 0; $index -lt $waves.Count; $index += 1) {
  $wave = $waves[$index]
  if (-not [System.Linq.Enumerable]::SequenceEqual([byte[]]$reference.Format, [byte[]]$wave.Format)) {
    throw "Narration segments use different WAV formats."
  }
  $start = $cursorBytes / $reference.ByteRate
  $memory.Write($wave.Data, 0, $wave.Data.Length)
  $cursorBytes += $wave.Data.Length
  $end = $cursorBytes / $reference.ByteRate
  $timings += [ordered]@{ index = $index; start = [Math]::Round($start, 4); end = [Math]::Round($end, 4) }
  if ($index -lt $waves.Count - 1) {
    $memory.Write($silence, 0, $silence.Length)
    $cursorBytes += $silence.Length
  }
}

$dataBytes = $memory.ToArray()
$memory.Dispose()
$outputPath = Join-Path $audioRoot "narration-female-heami.wav"
$stream = [System.IO.File]::Create($outputPath)
$writer = New-Object System.IO.BinaryWriter($stream)
try {
  $writer.Write([System.Text.Encoding]::ASCII.GetBytes("RIFF"))
  $writer.Write([int](4 + 8 + $reference.Format.Length + 8 + $dataBytes.Length))
  $writer.Write([System.Text.Encoding]::ASCII.GetBytes("WAVE"))
  $writer.Write([System.Text.Encoding]::ASCII.GetBytes("fmt "))
  $writer.Write([int]$reference.Format.Length)
  $writer.Write([byte[]]$reference.Format, 0, $reference.Format.Length)
  $writer.Write([System.Text.Encoding]::ASCII.GetBytes("data"))
  $writer.Write([int]$dataBytes.Length)
  $writer.Write([byte[]]$dataBytes, 0, $dataBytes.Length)
} finally {
  $writer.Dispose()
}

$duration = $dataBytes.Length / $reference.ByteRate
if ($duration -gt $MaximumDuration) { throw "Narration is too long for this edit: $duration seconds" }

$metadata = [ordered]@{
  voice = "Microsoft Heami Desktop"
  gender = "Female"
  culture = "ko-KR"
  rate = $Rate
  duration = [Math]::Round($duration, 4)
  gapSeconds = $gapSeconds
  segments = $timings
}
$metadata | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $audioRoot "narration-timings.json") -Encoding utf8
$metadata | ConvertTo-Json -Depth 4
