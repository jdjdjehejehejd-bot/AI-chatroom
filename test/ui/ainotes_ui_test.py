import sys
from playwright.sync_api import sync_playwright
B=sys.argv[1]; res=[]
def check(n,c,i=""): res.append(bool(c)); print(("PASS " if c else "FAIL ")+n+(" | "+str(i) if (not c and i) else ""))
with sync_playwright() as p:
    b=p.chromium.launch(args=["--no-sandbox"]); errs=[]
    ctx=b.new_context(locale="ko-KR",bypass_csp=True,viewport={"width":1280,"height":800}); pg=ctx.new_page(); pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(B+"/"); pg.check("input[name=jmode][value=asset]"); pg.set_input_files("#jfile","good.json"); pg.wait_for_selector("#jasset .loaded")
    pg.fill("#jname","Ann"); pg.check("#jconsent",force=True); pg.click("#jgo"); pg.wait_for_selector("#room:not([hidden])")
    for i in range(4):
        pg.fill("#text","고양이 이야기 %d"%i); pg.keyboard.press("Enter"); pg.wait_for_timeout(3500)
    btn=pg.locator("#ais [data-notes]")
    check("memory button appears on an AI row", btn.count()>=1, btn.count())
    chat=pg.inner_text("#msgs") if pg.locator("#msgs").count() else pg.inner_text("body")
    check("[메모] marker never shown in chat", "[메모]" not in chat)
    btn.first.dispatch_event("click"); pg.wait_for_timeout(300)
    check("notes list opens with explanation", pg.locator(".ainotes").count()==1 and "참고 자료로만" in pg.inner_text(".ainotes"), pg.inner_text("#ais")[:200])
    pg.locator("[data-clearnotes]").first.dispatch_event("click"); pg.wait_for_timeout(500)
    check("clearing removes the memory button", pg.locator("#ais [data-notes]").count()<btn.count() or pg.locator(".ainotes").count()==0)
    ctx.close()
    en=b.new_context(locale="en-US",bypass_csp=True); pe=en.new_page(); pe.goto(B+"/")
    check("translated strings exist (en)", "Memory 3" in pe.evaluate("_t('기억 {n}',{n:3})") and "Clear memory"==pe.evaluate("_t('기억 지우기')"))
    check("no page errors", not errs, errs)
    b.close()
print("%d / %d"%(sum(res),len(res)))
