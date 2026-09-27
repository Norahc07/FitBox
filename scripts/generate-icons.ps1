# Builds the game logo, favicon and PWA/install icons from assets/brand/fitbox-logo.png (transparent PNG),
# a dark-mode wordmark from assets/brand/fitbox-wordmark.png,
# and the "Powered by" studio mark from assets/brand/fenix-logo.png (orange artwork on a black background).
# Usage: npm run icons:generate   (Windows; uses .NET System.Drawing)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$fenixSource = Join-Path $root 'assets/brand/fenix-logo.png'
$fitboxSource = Join-Path $root 'assets/brand/fitbox-logo.png'
$wordmarkSource = Join-Path $root 'assets/brand/fitbox-wordmark.png'

Add-Type -AssemblyName System.Drawing
# PowerShell 7 splits System.Drawing across several assemblies; touching GDI+ loads them all so they can be referenced.
$probe = New-Object System.Drawing.Bitmap 1, 1
[System.Drawing.Graphics]::FromImage($probe).Dispose()
$probe.Dispose()
$drawingRefs = [AppDomain]::CurrentDomain.GetAssemblies() |
  Where-Object { $_.Location -and $_.GetName().Name -match '^System\.(Drawing|Private\.Windows|Runtime\.InteropServices$|ComponentModel\.Primitives$|Runtime$|Private\.CoreLib$)' } |
  ForEach-Object { $_.Location } | Select-Object -Unique
if ($PSVersionTable.PSEdition -ne 'Core') { $drawingRefs = @('System.Drawing') }
Add-Type -ReferencedAssemblies $drawingRefs -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class BrandIcons {
    // Black becomes transparent; brightness becomes alpha so anti-aliased edges stay smooth.
    public static Bitmap KeyOutBlack(Bitmap src, out Rectangle bounds) {
        int w = src.Width, h = src.Height;
        var bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb);
        using (var g = Graphics.FromImage(bmp)) g.DrawImage(src, 0, 0, w, h);
        var data = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
        var px = new byte[data.Stride * h];
        Marshal.Copy(data.Scan0, px, 0, px.Length);
        int minX = w, minY = h, maxX = -1, maxY = -1;
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                int i = y * data.Stride + x * 4;
                int b = px[i], gr = px[i + 1], r = px[i + 2];
                int a = Math.Max(r, Math.Max(gr, b));
                if (a < 14) { px[i] = px[i + 1] = px[i + 2] = px[i + 3] = 0; continue; }
                px[i] = (byte)Math.Min(255, b * 255 / a);
                px[i + 1] = (byte)Math.Min(255, gr * 255 / a);
                px[i + 2] = (byte)Math.Min(255, r * 255 / a);
                px[i + 3] = (byte)a;
                if (a > 40) {
                    if (x < minX) minX = x; if (x > maxX) maxX = x;
                    if (y < minY) minY = y; if (y > maxY) maxY = y;
                }
            }
        }
        Marshal.Copy(px, 0, data.Scan0, px.Length);
        bmp.UnlockBits(data);
        bounds = Rectangle.FromLTRB(minX, minY, maxX + 1, maxY + 1);
        return bmp;
    }

    // Copies an image that already has transparency and finds the bounds of its visible pixels.
    public static Bitmap Opaque(Bitmap src, out Rectangle bounds) {
        int w = src.Width, h = src.Height;
        var bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb);
        using (var g = Graphics.FromImage(bmp)) g.DrawImage(src, 0, 0, w, h);
        var data = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
        var px = new byte[data.Stride * h];
        Marshal.Copy(data.Scan0, px, 0, px.Length);
        bmp.UnlockBits(data);
        int minX = w, minY = h, maxX = -1, maxY = -1;
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                if (px[y * data.Stride + x * 4 + 3] <= 24) continue;
                if (x < minX) minX = x; if (x > maxX) maxX = x;
                if (y < minY) minY = y; if (y > maxY) maxY = y;
            }
        }
        bounds = Rectangle.FromLTRB(minX, minY, maxX + 1, maxY + 1);
        return bmp;
    }

    // Dark-mode variant: near-black neutral pixels (charcoal lettering) become off-white; coloured pixels are untouched.
    public static void LightenNeutrals(Bitmap bmp) {
        int w = bmp.Width, h = bmp.Height;
        var data = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
        var px = new byte[data.Stride * h];
        Marshal.Copy(data.Scan0, px, 0, px.Length);
        for (int i = 0; i < px.Length; i += 4) {
            if (px[i + 3] == 0) continue;
            int b = px[i], g = px[i + 1], r = px[i + 2];
            int max = Math.Max(r, Math.Max(g, b)), min = Math.Min(r, Math.Min(g, b));
            if (max - min < 36 && max < 150) { px[i] = 0xf2; px[i + 1] = 0xf2; px[i + 2] = 0xf2; }
        }
        Marshal.Copy(px, 0, data.Scan0, px.Length);
        bmp.UnlockBits(data);
    }

    // Saves the cropped artwork at `width` pixels wide, keeping its aspect ratio.
    public static void SaveCropped(Bitmap mark, Rectangle bounds, int width, string path) {
        int height = (int)Math.Round((double)bounds.Height * width / bounds.Width);
        using (var canvas = new Bitmap(width, height, PixelFormat.Format32bppArgb))
        using (var g = Graphics.FromImage(canvas)) {
            g.Clear(Color.Transparent);
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.SmoothingMode = SmoothingMode.HighQuality;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            g.CompositingQuality = CompositingQuality.HighQuality;
            using (var attrs = new ImageAttributes()) {
                attrs.SetWrapMode(WrapMode.TileFlipXY);
                g.DrawImage(mark, new Rectangle(0, 0, width, height), bounds.X, bounds.Y, bounds.Width, bounds.Height, GraphicsUnit.Pixel, attrs);
            }
            canvas.Save(path, ImageFormat.Png);
        }
    }

    // Draws the cropped mark centred in a square canvas, scaled to `fill` of the canvas.
    public static void Save(Bitmap mark, Rectangle bounds, int size, double fill, Color background, string path) {
        using (var canvas = new Bitmap(size, size, PixelFormat.Format32bppArgb))
        using (var g = Graphics.FromImage(canvas)) {
            g.Clear(background);
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.SmoothingMode = SmoothingMode.HighQuality;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            g.CompositingQuality = CompositingQuality.HighQuality;
            double scale = size * fill / Math.Max(bounds.Width, bounds.Height);
            double dw = bounds.Width * scale, dh = bounds.Height * scale;
            var dest = new RectangleF((float)((size - dw) / 2), (float)((size - dh) / 2), (float)dw, (float)dh);
            using (var attrs = new ImageAttributes()) {
                attrs.SetWrapMode(WrapMode.TileFlipXY);
                g.DrawImage(mark, Rectangle.Round(dest), bounds.X, bounds.Y, bounds.Width, bounds.Height, GraphicsUnit.Pixel, attrs);
            }
            canvas.Save(path, ImageFormat.Png);
        }
    }
}
'@

$black = [System.Drawing.Color]::FromArgb(255, 0, 0, 0)
$clear = [System.Drawing.Color]::Transparent

function Write-Icons($mark, $bounds, $outputs) {
  foreach ($o in $outputs) {
    $path = Join-Path $root $o[0]
    New-Item -ItemType Directory -Force (Split-Path -Parent $path) | Out-Null
    [BrandIcons]::Save($mark, $bounds, $o[1], $o[2], $o[3], $path)
    Write-Output "wrote $($o[0])"
  }
}

$src = [System.Drawing.Bitmap]::FromFile($fitboxSource)
$bounds = [System.Drawing.Rectangle]::Empty
$mark = [BrandIcons]::Opaque($src, [ref]$bounds)
Write-Icons $mark $bounds @(
  @('public/brand/fitbox-logo.png', 512, 1.0, $clear),
  @('public/favicon.png', 64, 1.0, $clear),
  @('public/icons/icon-192.png', 192, 0.86, $black),
  @('public/icons/icon-512.png', 512, 0.86, $black),
  @('public/icons/maskable-512.png', 512, 0.66, $black),
  @('public/icons/apple-touch-icon.png', 180, 0.82, $black)
)
$mark.Dispose()
$src.Dispose()

$src = [System.Drawing.Bitmap]::FromFile($wordmarkSource)
$bounds = [System.Drawing.Rectangle]::Empty
$mark = [BrandIcons]::Opaque($src, [ref]$bounds)
[BrandIcons]::LightenNeutrals($mark)
[BrandIcons]::SaveCropped($mark, $bounds, 900, (Join-Path $root 'public/brand/fitbox-wordmark.png'))
Write-Output 'wrote public/brand/fitbox-wordmark.png'
$mark.Dispose()
$src.Dispose()

$src = [System.Drawing.Bitmap]::FromFile($fenixSource)
$bounds = [System.Drawing.Rectangle]::Empty
$mark = [BrandIcons]::KeyOutBlack($src, [ref]$bounds)
Write-Icons $mark $bounds @(
  , @('public/brand/fenix-mark.png', 256, 1.0, $clear)
)
$mark.Dispose()
$src.Dispose()
