param(
  [string]$InputPath = "C:\data\game_builders\3. 설계\영상\프롤로그\v9\audio\narration-female-heami.wav",
  [string]$OutputPath = "C:\data\game_builders\3. 설계\영상\프롤로그\v9\audio\opening-final-mix.wav"
)

$ErrorActionPreference = "Stop"
$bytes = [System.IO.File]::ReadAllBytes($InputPath)
$position = 12
$format = $null
$pcm = $null
while ($position + 8 -le $bytes.Length) {
  $chunkId = [System.Text.Encoding]::ASCII.GetString($bytes, $position, 4)
  $chunkSize = [BitConverter]::ToInt32($bytes, $position + 4)
  if ($chunkId -eq "fmt ") { $format = $bytes[($position + 8)..($position + 8 + $chunkSize - 1)] }
  if ($chunkId -eq "data") { $pcm = $bytes[($position + 8)..($position + 8 + $chunkSize - 1)]; break }
  $position += 8 + $chunkSize + ($chunkSize % 2)
}
if ($null -eq $format -or $null -eq $pcm) { throw "Invalid WAV: $InputPath" }

$audioFormat = [BitConverter]::ToInt16($format, 0)
$channels = [BitConverter]::ToInt16($format, 2)
$sampleRate = [BitConverter]::ToInt32($format, 4)
$byteRate = [BitConverter]::ToInt32($format, 8)
$blockAlign = [BitConverter]::ToInt16($format, 12)
$bitsPerSample = [BitConverter]::ToInt16($format, 14)
if ($audioFormat -ne 1 -or $bitsPerSample -ne 16) { throw "Expected PCM 16-bit narration WAV." }

$duration = 20.0
$narrationStart = 0.35
$glitchStart = 14.8
$glitchEnd = 16.8
$frameCount = [int]([Math]::Round($duration * $sampleRate))
$output = New-Object byte[] ($frameCount * $blockAlign)
$sourceFrames = [int]($pcm.Length / $blockAlign)
$maxNarrationFrames = [int](($glitchStart - $narrationStart - 0.02) * $sampleRate)
$copyFrames = [Math]::Min($sourceFrames, $maxNarrationFrames)
$fadeFrames = [int](0.045 * $sampleRate)

for ($frame = 0; $frame -lt $copyFrames; $frame += 1) {
  $destinationFrame = $frame + [int]($narrationStart * $sampleRate)
  $fade = if ($frame -ge $copyFrames - $fadeFrames) { ($copyFrames - $frame) / [double]$fadeFrames } else { 1.0 }
  for ($channel = 0; $channel -lt $channels; $channel += 1) {
    $sourceOffset = $frame * $blockAlign + $channel * 2
    $destinationOffset = $destinationFrame * $blockAlign + $channel * 2
    $sample = [int]([BitConverter]::ToInt16($pcm, $sourceOffset) * 0.96 * $fade)
    $sampleBytes = [BitConverter]::GetBytes([int16]$sample)
    $output[$destinationOffset] = $sampleBytes[0]
    $output[$destinationOffset + 1] = $sampleBytes[1]
  }
}

$random = [System.Random]::new(999)
$alarmStartFrame = [int]($glitchStart * $sampleRate)
$alarmEndFrame = [int]($glitchEnd * $sampleRate)
for ($frame = $alarmStartFrame; $frame -lt $alarmEndFrame; $frame += 1) {
  $local = ($frame - $alarmStartFrame) / [double]$sampleRate
  $pulse = [Math]::Floor($local / 0.18)
  $inside = $local % 0.18
  $frequency = if (($pulse % 2) -eq 0) { 960.0 } else { 1260.0 }
  $envelope = 0.0
  if ($inside -lt 0.12) {
    $attack = [Math]::Min(1.0, $inside / 0.008)
    $release = [Math]::Min(1.0, (0.12 - $inside) / 0.025)
    $envelope = [Math]::Min($attack, $release)
  }
  $beep = [Math]::Sin(2.0 * [Math]::PI * $frequency * $local) * 0.42 * $envelope
  $burstEnvelope = [Math]::Max(0.0, 1.0 - $local / 0.11)
  $tearNoise = (($random.NextDouble() * 2.0) - 1.0) * (0.09 + 0.34 * $burstEnvelope)
  $surge = [Math]::Sin(2.0 * [Math]::PI * (88.0 + 42.0 * $local) * $local) * 0.07 * [Math]::Max(0.0, 1.0 - $local / 2.0)
  $mixed = [Math]::Max(-0.95, [Math]::Min(0.95, $beep + $tearNoise + $surge))
  $sample = [int16]([Math]::Round($mixed * 32767.0))
  $sampleBytes = [BitConverter]::GetBytes($sample)
  for ($channel = 0; $channel -lt $channels; $channel += 1) {
    $offset = $frame * $blockAlign + $channel * 2
    $output[$offset] = $sampleBytes[0]
    $output[$offset + 1] = $sampleBytes[1]
  }
}

$stream = [System.IO.File]::Create($OutputPath)
$writer = [System.IO.BinaryWriter]::new($stream)
try {
  $writer.Write([System.Text.Encoding]::ASCII.GetBytes("RIFF"))
  $writer.Write([int](4 + 8 + $format.Length + 8 + $output.Length))
  $writer.Write([System.Text.Encoding]::ASCII.GetBytes("WAVE"))
  $writer.Write([System.Text.Encoding]::ASCII.GetBytes("fmt "))
  $writer.Write([int]$format.Length)
  $writer.Write([byte[]]$format, 0, $format.Length)
  $writer.Write([System.Text.Encoding]::ASCII.GetBytes("data"))
  $writer.Write([int]$output.Length)
  $writer.Write([byte[]]$output, 0, $output.Length)
} finally { $writer.Dispose() }

[ordered]@{
  output = $OutputPath
  duration = $duration
  narrationStart = $narrationStart
  narrationCut = $glitchStart - 0.02
  alarmStart = $glitchStart
  alarmEnd = $glitchEnd
  sampleRate = $sampleRate
  channels = $channels
  bitsPerSample = $bitsPerSample
} | ConvertTo-Json
