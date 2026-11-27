import sys
from playwright.sync_api import sync_playwright
B=sys.argv[1]; res=[]
def check(n,c,i=""): res.append(bool(c)); print(("PASS " if c else "FAIL ")+n+(" | "+str(i) if (not c and i) else ""))
with sync_playwright() as p:
    b=p.chromium.launch(args=["--no-sandbox"]); errs=[]
    for vp in [{"width":1280,"height":800},{"width":390,"height":844}]:
        pg=b.new_page(locale="ko-KR",viewport=vp); pg.on("pageerror",lambda e:errs.append(str(e)))
        pg.goto(B+"/?new=1")
        if pg.is_visible("#newroom"): pg.click("#newroom")
        pg.fill("#jname","Ann"); pg.check("#jconsent",force=True); pg.click("#jgo"); pg.wait_for_selector("#room:not([hidden])"); pg.wait_for_timeout(300)
        pg.evaluate("document.getElementById('shell').dataset.info='1'"); pg.click('#seg [data-go="settings"]')
        pg.wait_for_timeout(200)
        check("activity dial hidden when AIs only answer @mentions", pg.locator("#actsec").is_hidden())
        pg.check('input[name="policy"][value="free"]',force=True); pg.click("#apply"); pg.wait_for_timeout(400)
        check("activity dial shows for autonomous chat, 'normal' selected", pg.locator("#actsec").is_visible() and pg.is_checked('input[name="activity"][value="normal"]'))
        pg.click('.seg3 label:has(input[value="quiet"])'); pg.wait_for_timeout(400)
        check("choosing Quiet is applied by the server and announced", pg.is_checked('input[name="activity"][value="quiet"]') and "AI 활동량을 \"조용\"" in pg.inner_text("#log"), pg.inner_text("#log")[-200:])
        check("hint explains the chosen level", "AI끼리 이어서 떠들지 않아" in pg.inner_text("#acthint"))
        pg.check('input[name="judge"][value="one"]',force=True); pg.wait_for_timeout(400)
        check("'decide once' is applied by the server", pg.evaluate("document.querySelector('input[name=judge][value=one]').checked"))
        bx=pg.locator(".seg3").bounding_box(); check("dial fits the panel at "+str(vp["width"]), bx and bx["width"]<=vp["width"], bx)
        pg.close()
    check("no page errors", not errs, errs)
    b.close()
print("%d / %d"%(sum(res),len(res)))
