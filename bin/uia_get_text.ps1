# ══════════════════════════════════════════════════════════════════════════
#  UIA TEXT EXTRACTOR v4.0 (Renderer Focus)
# ══════════════════════════════════════════════════════════════════════════

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

try {
    $sig = @'
[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
[DllImport("user32.dll")] public static extern IntPtr FindWindowEx(IntPtr hwndParent, IntPtr hwndChildAfter, string lpszClass, string lpszWindow);
'@
    $user32 = Add-Type -MemberDefinition $sig -Name "Win32" -Namespace Win32Functions -PassThru
    $hWnd = $user32::GetForegroundWindow()
    if ($hWnd -eq [IntPtr]::Zero) { exit }

    # 🎯 TARGET RENDERER: Try to find the inner Chrome renderer window directly
    # This immediately bypasses the tabs, toolbar, and search bar.
    $hRenderer = $user32::FindWindowEx($hWnd, [IntPtr]::Zero, "Chrome_RenderWidgetHostHWND", $null)
    $targetHWnd = if ($hRenderer -ne [IntPtr]::Zero) { $hRenderer } else { $hWnd }

    $root = [System.Windows.Automation.AutomationElement]::FromHandle($targetHWnd)
    if ($null -eq $root) { exit }

    # Filter by specific ControlTypes that contain actual content
    $types = @(
        [System.Windows.Automation.ControlType]::Text,
        [System.Windows.Automation.ControlType]::Edit,
        [System.Windows.Automation.ControlType]::Document,
        [System.Windows.Automation.ControlType]::ListItem,
        [System.Windows.Automation.ControlType]::List
    )

    $textBuffer = New-Object System.Text.StringBuilder
    $seenText = New-Object System.Collections.Generic.HashSet[string]

    # Recursive walk is often better for filtering out specific branches
    function Walk($element) {
        try {
            $name = $element.Current.Name
            $type = $element.Current.ControlType
            
            if ($null -ne $name -and $name.Length -gt 3) {
                # Only grab text if it matches our target types or we are deep in the Document
                if ($types -contains $type) {
                    $clean = $name.Trim()
                    if (-not $seenText.Contains($clean)) {
                        # Final noise filter for common browser buttons found even in renderer
                        if ($clean -notmatch "^(Search|Close|Minimize|Maximize|Restore|Bookmark|Extensions|New Tab|Address and search bar)$") {
                            [void]$textBuffer.AppendLine($clean)
                            [void]$seenText.Add($clean)
                        }
                    }
                }
            }

            foreach ($child in $element.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)) {
                Walk($child)
            }
        } catch {}
    }

    Walk($root)

    $result = $textBuffer.ToString()
    if ($result.Length -gt 10) { Write-Output $result }
    else { Write-Output $root.Current.Name } 
} catch {
    Write-Output "ERROR: $($_.Exception.Message)"
}
