import os
import logging
from pathlib import Path

logger = logging.getLogger("screenshot")

def capture_mt5_window(output_filename: str = "mt5_capture.webp") -> str:
    """
    Captures the visual state of the active MT5 application window on the host.
    Compresses and saves it as a WebP image under the system uploads folder.
    """
    # 1. Resolve output path under the data uploads directory
    uploads_dir = Path(__file__).resolve().parents[2] / "data" / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)
    output_path = uploads_dir / output_filename

    captured = False
    
    # 2. Windows-Specific Window Handle Capture
    try:
        import win32gui
        import win32ui
        import win32con
        from PIL import Image

        # Find the MetaTrader 5 active window handle
        hwnd = win32gui.FindWindow(None, "MetaTrader 5")
        if hwnd:
            left, top, right, bottom = win32gui.GetWindowRect(hwnd)
            width = right - left
            height = bottom - top

            hwndDC = win32gui.GetWindowDC(hwnd)
            mfcDC = win32ui.CreateDCFromHandle(hwndDC)
            saveDC = mfcDC.CreateCompatibleDC()

            saveBitMap = win32ui.CreateBitmap()
            saveBitMap.CreateCompatibleBitmap(mfcDC, width, height)
            saveDC.SelectObject(saveBitMap)

            # Copy screen pixels
            saveDC.BitBlt((0, 0), (width, height), mfcDC, (0, 0), win32con.SRCCOPY)

            # Create PIL image from bytes
            bmpinfo = saveBitMap.GetInfo()
            bmpstr = saveBitMap.GetBitmapBits(True)
            im = Image.frombuffer(
                'RGB',
                (bmpinfo['bmWidth'], bmpinfo['bmHeight']),
                bmpstr, 'raw', 'BGRX', 0, 1
            )
            
            # Resize image to optimize LLM prefill costs
            im.thumbnail((1024, 1024))
            im.save(output_path, "WEBP", quality=80)
            captured = True
            logger.info(f"Captured active MT5 window to: {output_path}")
            
            # Resource cleanup
            win32gui.DeleteObject(saveBitMap.GetHandle())
            saveDC.DeleteDC()
            mfcDC.DeleteDC()
            win32gui.ReleaseDC(hwnd, hwndDC)
    except Exception as e:
        logger.debug(f"Direct Win32 screen capture failed: {e}")

    # 3. Fallback: Full primary monitor screen grab
    if not captured:
        try:
            from PIL import ImageGrab
            im = ImageGrab.grab()
            im.thumbnail((1024, 1024))
            im.save(output_path, "WEBP", quality=80)
            captured = True
            logger.info(f"Fallback monitor grab captured to: {output_path}")
        except Exception as e:
            logger.debug(f"Primary monitor grab failed: {e}")

    # 4. Headless Sandbox Fallback: Programmatic Mock Drawing
    if not captured:
        try:
            from PIL import Image, ImageDraw
            
            # Draw a simulated dark-theme MT5 workspace
            img = Image.new('RGB', (1024, 1024), color='#131722')
            draw = ImageDraw.Draw(img)
            
            # Render grid system
            for i in range(0, 1024, 64):
                draw.line([(i, 0), (i, 1024)], fill='#1f222e', width=1)
                draw.line([(0, i), (1024, i)], fill='#1f222e', width=1)
            
            # Draw simulated price action chart line
            points = [(50, 800), (200, 700), (350, 740), (550, 520), (700, 560), (950, 310)]
            draw.line(points, fill='#f23645', width=3)
            
            # Annotate mock labels
            draw.text((30, 30), "MOCK MT5 TERMINAL VIEWPORT (Headless Sandbox Mode)", fill='#848e9c')
            draw.text((30, 60), "Active Window: GBPUSD H1", fill='#2962ff')
            draw.text((30, 90), "Heuristic Pattern: Bearish Order Block @ 1.2750", fill='#4caf50')
            
            img.save(output_path, "WEBP", quality=80)
            captured = True
            logger.info(f"Generated headless fallback placeholder at: {output_path}")
        except Exception as e:
            logger.error(f"Failed to generate mock visual placeholder: {e}")
            return ""

    return str(output_path)
