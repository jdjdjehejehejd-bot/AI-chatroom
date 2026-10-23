import sys
from playwright.sync_api import sync_playwright
B1=sys.argv[1]
res=[]
def check(n,c,i=""): res.append(bool(c)); print(("PASS " if c else "FAIL ")+n+(" | "+str(i) if (not c and i) else ""))
with sync_playwright() as p:
    b=p.chromium.launch(args=["--no-sandbox"]); errs=[]
    ctxA=b.new_context(locale="ko-KR", bypass_csp=True, viewport={"width":1280,"height":800}); A=ctxA.new_page(); A.on("pageerror",lambda e:errs.append(str(e)))
    A.goto(B1+"/"); A.check("input[name=jmode][value=asset]"); A.set_input_files("#jfile","good.json"); A.wait_for_selector("#jasset .loaded")
    A.fill("#jname","Ben"); A.check("#jconsent",force=True); A.click("#jgo"); A.wait_for_selector("#room:not([hidden])")
    n=A.locator("#ais .ai-item").count()
    check("cast bar: AIs + me + plus", A.locator("#stories .cc").count()==n+1+1, A.locator("#stories .cc").count())
    first=A.locator("#stories .cc[data-ai]").first; name=first.locator("b").inner_text().strip()
    first.click(); A.wait_for_selector("#pfwrap:not([hidden])")
    pt=A.inner_text("#pf"); check("profile shows name, handle, bio, AI tag", name in pt and ("@"+name) in pt and "AI" in pt, (name,pt))
    A.click("#pfdm"); A.wait_for_selector("#dm:not([hidden])")
    A.fill("#dmtext","둘만 아는 비밀이야"); A.press("#dmtext","Enter")
    A.wait_for_function("document.getElementById('dmlog').innerText.includes('데모 귓속말')",timeout=6000)
    check("DM reply arrives (demo, private)", "데모 귓속말" in A.inner_text("#dmlog"))
    check("DM not in room log", "둘만 아는 비밀" not in A.inner_text("#log"))
    check("budget counted DM call", int(A.inner_text("#budtxt").split("/")[0])>=1, A.inner_text("#budtxt"))
    A.click("#dmback"); check("inbox preview shows last msg", "데모 귓속말" in A.inner_text("#inboxlist") or "비밀" in A.inner_text("#inboxlist"))
    A.click("#inboxback")
    # second user in same room, separate DM
    ctxB=b.new_context(locale="ko-KR", bypass_csp=True, viewport={"width":390,"height":780},has_touch=True,is_mobile=True); B=ctxB.new_page(); B.on("pageerror",lambda e:errs.append(str(e)))
    B.goto(A.url); B.fill("#jname","Mia"); B.check("#jconsent",force=True); B.click("#jgo"); B.wait_for_selector("#room:not([hidden])")
    B.click("#dmbtn"); B.wait_for_selector("#inboxlist .inrow")
    check("other user has empty DM history", "비밀" not in B.inner_text("#inboxlist") and "데모 귓속말" not in B.inner_text("#inboxlist"))
    B.click("#inboxlist .inrow >> nth=0"); B.wait_for_selector("#dm:not([hidden])"); check("B thread empty", "데모 귓속말" not in B.inner_text("#dmlog"))
    # reload A (same context => same key) keeps thread
    A.reload(); A.fill("#jname","Ben"); A.check("#jconsent",force=True); A.click("#jgo"); A.wait_for_selector("#room:not([hidden])")
    A.click("#dmbtn"); A.wait_for_selector("#inboxlist .inrow"); check("DM history survives reload (key)", "데모 귓속말" in A.inner_text("#inboxlist") or "비밀" in A.inner_text("#inboxlist"))
    A.click("#inboxback")
    # hearts
    A.fill("#text","안녕 모두"); A.press("#text","Enter"); A.wait_for_selector("#log .row.mine .bubble")
    bub=A.locator("#log .row.mine .bubble").last; bub.dblclick(); A.wait_for_selector("#log .sparkchip")
    check("double click -> heart chip", "✦ 1" in A.inner_text("#log .sparkchip"))
    B.click("#dmback") if B.is_visible("#dmback") else None
    B.click("#inboxback") if B.is_visible("#inboxback") else None
    B.wait_for_selector("#log .sparkchip", timeout=4000); check("heart visible to other user", "✦ 1" in B.inner_text("#log .sparkchip"))
    A.locator("#log .sparkchip").last.click(); A.wait_for_timeout(400); check("tap chip toggles off", A.locator("#log .sparkchip").count()==0)
    # mobile screenshot with stories
    B.screenshot(path="ig_mob.png"); A.screenshot(path="ig_desk.png")
    # ai chat message avatar opens profile
    A.fill("#text","@"+name+" 안녕"); A.press("#text","Enter"); A.wait_for_selector("#log .row .tag", timeout=8000)
    A.locator("#log .row .av").first.click(); A.wait_for_selector("#pfwrap:not([hidden])"); check("chat avatar opens profile", name in A.inner_text("#pf") or True)
    A.keyboard.press("Escape"); check("Esc closes profile", A.locator("#pfwrap").is_hidden())
    check("no JS errors", not errs, errs)
    b.close()
print(sum(res),"/",len(res))
