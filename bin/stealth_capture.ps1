# ══════════════════════════════════════════════════════════════════════════
#  STEALTH GDI CAPTURE v2.0 (Zero-Screenshot)
# ══════════════════════════════════════════════════════════════════════════

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class GdiCapture {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
}

[StructLayout(LayoutKind.Sequential)]
public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
}
"@

try {
    $hWnd = [GdiCapture]::GetForegroundWindow()
    if ($hWnd -eq [IntPtr]::Zero) { exit }

    $rect = New-Object RECT
    if (-not [GdiCapture]::GetWindowRect($hWnd, [ref]$rect)) { exit }

    $width = $rect.Right - $rect.Left
    $height = $rect.Bottom - $rect.Top
    if ($width -le 0 -or $height -le 0) { exit }

    # GDI+ Memory Capture
    $bmp = New-Object System.Drawing.Bitmap($width, $height)
    $graphics = [System.Drawing.Graphics]::FromImage($bmp)
    $graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bmp.Size)

    # Convert to Base64 in-memory (no disk trace)
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bytes = $ms.ToArray()
    $base64 = [Convert]::ToBase64String($bytes)

    Write-Output "data:image/png;base64,$base64"

    $graphics.Dispose()
    $bmp.Dispose()
    $ms.Dispose()
} catch {
    Write-Output "ERROR: $($_.Exception.Message)"
}
