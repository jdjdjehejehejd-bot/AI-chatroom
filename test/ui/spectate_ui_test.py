import sys
from playwright.sync_api import sync_playwright
B=sys.argv[1]; res=[]
def check(n,c,i=""): res.append(bool(c)); print(("PASS " if c else "FAIL ")+n+(" | "+str(i) if (not c and i) else ""))
with sync_playwright() as p:
    b=p.chromium.launch(args=["--no-sandbox"]); errs=[]
    ctx=b.new_context(locale="ko-KR",bypass_csp=True,viewport={"width":1280,"height":800},accept_downloads=True); pg=ctx.new_page(); pg.on("pageerror",lambda e:errs.append(str(e)))
    # 1) 빈 방: AI 1명이면 구경 칩 없음, 2명이면 생김, 누르면 AI끼리 대화
    pg.goto(B+"/"); pg.wait_for_selector("#jgo"); pg.fill("#jname","Ann"); pg.check("#jconsent",force=True); pg.click("#jgo"); pg.wait_for_selector("#room:not([hidden])")
    check("quick-start button on empty room", pg.locator("#quickai").count()==1)
    pg.click("#quickai"); pg.wait_for_function("document.querySelectorAll('#ais .ai-item').length==1")
    check("one AI: no spectate chip", pg.locator("#spectate").count()==0)
    pg.fill("#text","안녕"); pg.keyboard.press("Enter"); pg.wait_for_timeout(1800)
    check("single AI answers without @", pg.locator("#log .row").count()>=2, pg.locator("#log .row").count())
    pg.click("#invdet summary") if pg.locator("#invdet").get_attribute("open") is None else None
    pg.fill("#ainame","둘째"); pg.fill("#aipersona","p"); pg.select_option("#aiprov","demo"); pg.click("#addai"); pg.wait_for_function("document.querySelectorAll('#ais .ai-item').length==2")
    check("two AIs: spectate chip appears", pg.locator("#spectate").count()==1)
    n0=pg.locator("#log .row").count()
    pg.fill("#text","짜장면 vs 짬뽕"); pg.click("#spectate"); pg.wait_for_timeout(4000)
    n1=pg.locator("#log .row").count()-n0
    check("spectate produced a human line + >=2 AI lines", n1>=3, n1)
    # 2) Debate 카드 이미지
    pg.goto(B+"/?mode=debate"); pg.wait_for_selector("#jgo"); pg.fill("#jname","Bob"); pg.check("#jconsent",force=True); pg.click("#jgo"); pg.wait_for_selector("#room:not([hidden])")
    pg.fill("#text","재택근무가 나을까?"); pg.keyboard.press("Enter"); pg.wait_for_selector("#dimg",state="attached",timeout=15000); pg.click("#seg [data-go=deliv]")
    with pg.expect_download(timeout=10000) as dl: pg.click("#dimg")
    d=dl.value; path=d.path(); data=open(path,"rb").read()
    check("card PNG downloaded", d.suggested_filename.endswith(".png") and data[:8]==b"\x89PNG\r\n\x1a\n" and len(data)>5000, (d.suggested_filename,len(data)))
    check("no page errors", not errs, errs)
    b.close()
print("%d / %d"%(sum(res),len(res)))
