import asyncio
from playwright.async_api import async_playwright
import time

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        # open P1
        page1 = await browser.new_page()
        await page1.goto("http://localhost:8000/double_battle.html")
        await page1.click("#create-double-room-btn")
        
        # open P2
        page2 = await browser.new_page()
        await page2.goto("http://localhost:8000/double_battle.html")
        await page2.evaluate("localStorage.setItem('sb_player_id', 'TEST_P2')")
        await page2.reload()
        
        # P1 get room ID
        room_id_str = await page1.input_value("#double-room-id-input")
        
        # P2 join
        await page2.fill("#double-room-id-input", room_id_str)
        await page2.click("#join-double-room-btn")
        
        # wait 2s
        await asyncio.sleep(2)
        
        # evaluate on P1 to see bounding boxes
        res = await page1.evaluate("""() => {
            const els = ['#double-input-wrapper', '#text', '#double-input', '#target-selection-ui', '#message', '#double-wait-message'];
            const rects = {};
            for(const e of els) {
                const node = document.querySelector(e);
                if (node) {
                    const r = node.getBoundingClientRect();
                    rects[e] = { width: r.width, height: r.height, top: r.top, display: getComputedStyle(node).display, visibility: getComputedStyle(node).visibility };
                } else {
                    rects[e] = null;
                }
            }
            return rects;
        }""")
        for k, v in res.items():
            print(f"{k}: {v}")
            
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
