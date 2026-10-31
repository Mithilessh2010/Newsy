import asyncio
import os
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "demo" / "index.html").read_text(encoding="utf-8")


async def main():
    async with async_playwright() as playwright:
        launch = {"headless": True, "args": ["--disable-webgl"]}
        if os.environ.get("CHROMIUM_BIN"):
            launch["executable_path"] = os.environ["CHROMIUM_BIN"]
        browser = await playwright.chromium.launch(**launch)
        try:
            for width, height, label in [(1440, 900, "desktop"), (390, 844, "mobile")]:
                page = await browser.new_page(viewport={"width": width, "height": height})
                errors = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                await page.set_content(HTML, wait_until="load")
                await page.wait_for_timeout(500)

                before = await page.evaluate("""() => ({
                    camera: window.__demoGlobe?.getState(),
                    zoom: window.__demoGlobe?.getZoom(),
                    contentWidth: document.documentElement.scrollWidth,
                    viewport: window.innerWidth
                })""")
                assert before["camera"], f"{label}: interactive renderer is missing"
                assert before["contentWidth"] <= before["viewport"], f"{label}: overflow"

                await page.locator('#city-list button[data-city="Tokyo"]').click()
                await page.locator("#zoom-in").click()
                await page.wait_for_timeout(650)

                after = await page.evaluate("""() => ({
                    label: document.querySelector('#planet-title').textContent,
                    camera: window.__demoGlobe?.getState(),
                    zoom: window.__demoGlobe?.getZoom()
                })""")
                assert after["label"] == "Tokyo", f"{label}: wrong selected city"
                assert after["zoom"] > 1.48, f"{label}: zoom did not increase after focus"
                assert abs(after["camera"]["yaw"] - before["camera"]["yaw"]) > 0.1, f"{label}: globe did not turn"
                assert not errors, f"{label}: browser exceptions: {errors}"
                print(f"PASS {label}: city, zoom, rotation, no overflow, no JS errors")
                await page.close()
        finally:
            await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
