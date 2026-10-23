import sys
from playwright.sync_api import sync_playwright
B=sys.argv[1]; res=[]
def check(n,c,i=""): res.append(bool(c)); print(("PASS " if c else "FAIL ")+n+(" | "+str(i) if (not c and i) else ""))
with sync_playwright() as p:
    b=p.chromium.launch(args=["--no-sandbox"]); errs=[]
    ctx=b.new_context(locale="ko-KR",bypass_csp=True,viewport={"width":1280,"height":800}); pg=ctx.new_page(); pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(B+"/?mode=debate"); pg.wait_for_selector("#jgo")
    check("?mode=debate preselects Debate", pg.is_checked("input[name=jmode][value=debate]"))
    fl=pg.inner_text("#jflow"); check("flow shows debate roles", all(x in fl for x in ["옹호자","반박자","심판"]), fl)
    pg.goto(B+"/?mode=nonsense"); pg.wait_for_selector("#jgo"); check("unknown mode ignored (default free room stays selected)", pg.is_checked("input[name=jmode][value=free]"))
    pg.goto(B+"/?mode=%3Cscript%3E"); pg.wait_for_selector("#jgo"); check("odd mode value ignored", pg.is_checked("input[name=jmode][value=free]"))
    # 방 만들고 입장 → 판정 카드까지
    pg.goto(B+"/?mode=debate"); pg.fill("#jname","Ann"); pg.check("#jconsent",force=True); pg.click("#jgo"); pg.wait_for_selector("#room:not([hidden])")
    pg.fill("#text","재택근무가 나을까?"); pg.keyboard.press("Enter"); pg.wait_for_timeout(3500)
    body=pg.inner_text("body"); check("verdict card reaches deliverable panel", "합의된 것" in body or "결론" in body, body[-300:])
    ctx.close()
    en=b.new_context(locale="en-US",bypass_csp=True,viewport={"width":1280,"height":800}); pe=en.new_page(); pe.goto(B+"/?mode=debate"); pe.wait_for_selector("#jgo")
    fe=pe.inner_text("#jflow"); check("English flow uses translated roles", all(x in fe for x in ["Advocate","Rebutter","Judge"]) and "옹호" not in fe, fe)
    lab=pe.inner_text("label.mode:has(input[value=debate])"); check("English mode card translated", "Advocate, rebut" in lab, lab)
    check("no page errors", not errs, errs)
    b.close()
print("%d / %d"%(sum(res),len(res)))
