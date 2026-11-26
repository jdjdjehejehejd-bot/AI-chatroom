import sys
from playwright.sync_api import sync_playwright
B=sys.argv[1]; res=[]
def check(n,c,i=""): res.append(bool(c)); print(("PASS " if c else "FAIL ")+n+(" | "+str(i) if (not c and i) else ""))
with sync_playwright() as p:
    b=p.chromium.launch(args=["--no-sandbox"]); errs=[]
    ctx=b.new_context(locale="ko-KR",bypass_csp=True,viewport={"width":1280,"height":800}); pg=ctx.new_page(); pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(B+"/?mode=review"); pg.wait_for_selector("#jgo")
    check("?mode=review preselects Review", pg.is_checked("input[name=jmode][value=review]"))
    fl=pg.inner_text("#jflow"); check("flow shows reviewer roles", all(x in fl for x in ["논리검토자","근거검토자","편집장"]), fl)
    pg.fill("#jname","Ann"); pg.check("#jconsent",force=True); pg.click("#jgo"); pg.wait_for_selector("#room:not([hidden])"); pg.wait_for_timeout(400)
    check("composer accepts a whole document (8000) in review mode", pg.evaluate("document.getElementById('text').maxLength")==8000)
    doc="보고서 초안입니다. "+"본문 문장입니다. "*200
    pg.fill("#text",doc); pg.keyboard.press("Enter"); pg.wait_for_timeout(4000)
    body=pg.inner_text("body"); check("review card reaches the deliverable panel", "합의된 문제" in body and "고친 버전" in body, body[-300:])
    check("the long document was posted whole", len(doc)>1000 and pg.inner_text("#log").count("본문 문장입니다")>=200, pg.inner_text("#log").count("본문 문장입니다"))
    pg.click('#seg [data-go="deliv"]'); pg.wait_for_timeout(150)
    check("review card offers 'compare with original'", pg.is_visible("#dcompare"))
    pg.click("#dcompare"); pg.wait_for_timeout(200)
    cols=pg.locator("#dcmpbox .dcol"); t0=cols.nth(0).inner_text() if cols.count()==2 else ""; t1=cols.nth(1).inner_text() if cols.count()==2 else ""
    check("compare shows original and revised side by side", cols.count()==2 and "보고서 초안입니다" in t0 and "(목적 한 줄)" in t1, (cols.count(), t0[:60], t1[:60]))
    check("changed sentences are marked on both sides", pg.locator("#dcmpbox mark.del").count()>0 and pg.locator("#dcmpbox mark.ins").count()>0)
    check("copy/save act on the revised version in compare view", pg.inner_text("#ddown")=="고친 버전 저장" and pg.inner_text("#dcopy")=="고친 버전 복사")
    with pg.expect_download() as dl: pg.click("#ddown")
    f=dl.value; txt=open(f.path(),encoding="utf-8").read()
    check("saved file holds only the revised text", txt.startswith("(목적 한 줄)") and "합의된 문제" not in txt, txt[:80])
    pg.set_viewport_size({"width":390,"height":844}); pg.wait_for_timeout(200)
    bx=[cols.nth(i).bounding_box() for i in range(2)]
    check("on a phone the two panes stack", bx[0] and bx[1] and bx[1]["y"]>bx[0]["y"]+bx[0]["height"]-1, bx)
    pg.click("#dcompare"); pg.wait_for_timeout(150)
    check("toggle returns to the review card", pg.locator("#dcmpbox").count()==0 and "합의된 문제" in pg.inner_text("#delivbox"))
    ctx.close()
    en=b.new_context(locale="en-US",bypass_csp=True,viewport={"width":1280,"height":800}); pe=en.new_page(); pe.goto(B+"/?mode=review"); pe.wait_for_selector("#jgo")
    fe=pe.inner_text("#jflow"); check("English flow uses translated roles", all(x in fe for x in ["LogicReviewer","EvidenceReviewer","EditorInChief"]) and "검토" not in fe, fe)
    lab=pe.inner_text("label.mode:has(input[value=review])"); check("English mode card translated", "Several AIs review" in lab, lab)
    check("no page errors", not errs, errs)
    b.close()
print("%d / %d"%(sum(res),len(res)))
