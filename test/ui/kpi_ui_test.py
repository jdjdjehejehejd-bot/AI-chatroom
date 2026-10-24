import sys,json
from playwright.sync_api import sync_playwright
B=sys.argv[1]; res=[]
def check(n,c,i=""): res.append(bool(c)); print(("PASS " if c else "FAIL ")+n+(" | "+str(i) if (not c and i) else ""))
with sync_playwright() as p:
    b=p.chromium.launch(args=["--no-sandbox"]); errs=[]; sent=[]
    ctx=b.new_context(locale="ko-KR",bypass_csp=True,viewport={"width":1280,"height":800}); ctx.grant_permissions(["clipboard-read","clipboard-write"],origin=B)
    pg=ctx.new_page(); pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.on("websocket",lambda w: w.on("framesent",lambda f: sent.append(f if isinstance(f,str) else f.get("payload",""))))
    pg.goto(B+"/?mode=make"); pg.fill("#jname","Ann"); pg.check("#jconsent",force=True); pg.click("#jgo"); pg.wait_for_selector("#room:not([hidden])")
    pg.fill("#text","웹페이지 만들어줘"); pg.keyboard.press("Enter"); pg.wait_for_selector("#dcopy",state="attached",timeout=15000)
    kp=lambda: [json.loads(x) for x in sent if '"kpi"' in x]
    check("no kpi signal before any action", len(kp())==0, kp())
    check("rating buttons 1-5 shown", pg.locator("#delivbox [data-rate]").count()==5)
    pg.locator("#dcopy").dispatch_event("click"); pg.wait_for_timeout(500)
    k=kp(); check("copy success sends copy_success with the version", any(x.get("n")=="copy_success" and isinstance(x.get("v"),int) for x in k), k)
    check("no legacy deliv_copy event", not any(x.get("n") in ("deliv_copy","deliv_download") for x in k), k)
    pg.locator("#ddown").dispatch_event("click"); pg.wait_for_timeout(300)
    check("download sends download_clicked (not a success claim)", any(x.get("n")=="download_clicked" for x in kp()), kp())
    pg.locator("#delivbox [data-rate='4']").dispatch_event("click"); pg.wait_for_timeout(400)
    check("rating sends rate with score and version", any(x.get("n")=="rate" and x.get("r")==4 and isinstance(x.get("v"),int) for x in kp()), kp())
    check("rating buttons disabled after rating, chosen one highlighted", pg.locator("#delivbox [data-rate]:not([disabled])").count()==0 and "primary" in (pg.get_attribute("#delivbox [data-rate='4']","class") or ""))
    en=b.new_context(locale="en-US",bypass_csp=True); pe=en.new_page(); pe.goto(B+"/")
    check("rating strings translated (en)", pe.evaluate("_t('이 결과가 쓸 만했나요?')")=="Was this result useful?" and pe.evaluate("_t('{n}점',{n:4})")=="4 out of 5")
    check("no page errors", not errs, errs)
    b.close()
print("%d / %d"%(sum(res),len(res)))
