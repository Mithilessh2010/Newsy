import asyncio
import os
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / 'demo/index.html').read_text(encoding='utf-8')


async def test_mode(browser, label: str, width: int, height: int, expect_webgl: bool):
    page = await browser.new_page(viewport={'width': width, 'height': height})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    await page.set_content(HTML, wait_until='load')
    await page.wait_for_timeout(700)
    before = await page.evaluate('''() => {
      const canvas = document.querySelector('#earth');
      const state = window.__demoGlobe?.getState?.();
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      const context = gl ? 'webgl' : (canvas.getContext('2d') ? 'canvas2d' : 'image');
      return {
        state,
        context,
        width: document.documentElement.scrollWidth,
        viewport: innerWidth,
        sample: canvas.toDataURL().slice(0, 200),
      };
    }''')
    assert before['state'] is not None, f'{label}: renderer never started'
    assert before['width'] <= before['viewport'], f'{label}: horizontal overflow'
    if expect_webgl:
        assert before['context'] == 'webgl', f'{label}: expected WebGL, got {before["context"]}'
    else:
        assert before['context'] == 'canvas2d', f'{label}: expected Canvas fallback, got {before["context"]}'
    await page.locator('#city-list button[data-city="Tokyo"]').click()
    await page.locator('#zoom-in').click()
    await page.wait_for_timeout(900)
    after = await page.evaluate('''() => ({
      title: document.querySelector('#planet-title')?.textContent,
      state: window.__demoGlobe?.getState?.(),
      zoom: window.__demoGlobe?.getZoom?.(),
      image: document.querySelector('#earth').toDataURL('image/png'),
    })''')
    assert after['title'] == 'Tokyo', f'{label}: city label not updated'
    assert abs(after['state']['yaw'] - before['state']['yaw']) > .1, f'{label}: globe camera did not rotate'
    assert after['zoom'] > 1.48, f'{label}: zoom-in regressed after city selection'
    assert len(after['image']) > 3500, f'{label}: globe canvas drew no content'
    assert not errors, f'{label}: JS errors {errors}'
    print(f'PASS {label}: {before["context"]} renderer, focus, zoom, image, no JS errors/overflow')
    await page.close()


async def main():
    async with async_playwright() as p:
        options = {'headless': True}
        if os.environ.get('CHROMIUM_BIN'):
            options['executable_path'] = os.environ['CHROMIUM_BIN']
        browser = await p.chromium.launch(**options, args=['--no-sandbox', '--disable-webgl'])
        try:
            for label, width, height in [('desktop', 1366, 768), ('mobile', 390, 844)]:
                await test_mode(browser, 'fallback-' + label, width, height, False)
        finally:
            await browser.close()
        browser = await p.chromium.launch(**options, args=[
            '--no-sandbox', '--enable-webgl', '--use-gl=angle',
            '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox',
        ])
        try:
            probe = await browser.new_page()
            await probe.set_content('<canvas id="probe"></canvas>')
            supported = await probe.evaluate(
                "() => !!document.querySelector('#probe').getContext('webgl')"
            )
            await probe.close()
            if supported:
                await test_mode(browser, 'swiftshader-webgl', 1366, 768, True)
            else:
                print('SKIP WebGL: this Chromium runtime cannot create a WebGL context')
        finally:
            await browser.close()


if __name__ == '__main__':
    asyncio.run(main())
