import sys,json
from playwright.sync_api import sync_playwright
B=sys.argv[1]; res=[]
def check(n,c,i=""): res.append(bool(c)); print(("PASS " if c else "FAIL ")+n+(" | "+str(i) if (not c and i) else ""))
with sync_playwright() as p:
    b=p.chromium.launch(args=["--no-sandbox"]); errs=[]; sent=[]
    pg=b.new_context(locale="ko-KR",bypass_csp=True,viewport={"width":1280,"height":800}).new_page(); pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.on("websocket",lambda w: w.on("framesent",lambda f: sent.append(f if isinstance(f,str) else f.get("payload",""))))
    pg.goto(B+"/?mode=make"); pg.fill("#jname","Ann"); pg.check("#jconsent",force=True); pg.click("#jgo"); pg.wait_for_selector("#room:not([hidden])")
    pg.fill("#text","웹페이지 만들어줘"); pg.keyboard.press("Enter"); pg.wait_for_selector("#dcopy",state="attached",timeout=15000)
    pg.click('#seg [data-go=deliv]')
    check("compare button shown for the deliverable", pg.locator("#cmprun").count()==1 and "AI 호출 1회" in pg.inner_text("#cmprun"), pg.inner_text("#delivbox")[-120:])
    pg.click("#cmprun"); pg.wait_for_selector(".dcmpout",timeout=8000)
    check("two blind results A/B shown, labels hidden before voting", pg.locator("[data-vote]").count()==3 and pg.locator(".dcmpout").count()==2 and "여러 AI 결과" not in pg.inner_text(".dcmp details") and "단일 AI 답" not in pg.inner_text(".dcmp details"), pg.inner_text(".dcmp")[:200])
    pg.click("[data-vote=A]"); pg.wait_for_timeout(300)
    vs=[json.loads(x) for x in sent if "compare_vote" in x]
    check("vote sent once, mapped to multi/single (not A/B)", len(vs)==1 and vs[0]["r"] in ("multi","single") and isinstance(vs[0]["v"],int), vs)
    check("reveal after voting (A and B named)", ("여러 AI 결과" in pg.inner_text(".dcmp details")) and ("단일 AI 답" in pg.inner_text(".dcmp details")))
    check("vote buttons disabled after voting", all(pg.locator("[data-vote]").nth(i).is_disabled() for i in range(3)))
    check("no page errors", not errs, errs)
    print(sum(res),"/",len(res))
