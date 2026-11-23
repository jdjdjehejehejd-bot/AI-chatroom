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
    ctx.close()
    en=b.new_context(locale="en-US",bypass_csp=True,viewport={"width":1280,"height":800}); pe=en.new_page(); pe.goto(B+"/?mode=review"); pe.wait_for_selector("#jgo")
    fe=pe.inner_text("#jflow"); check("English flow uses translated roles", all(x in fe for x in ["LogicReviewer","EvidenceReviewer","EditorInChief"]) and "검토" not in fe, fe)
    lab=pe.inner_text("label.mode:has(input[value=review])"); check("English mode card translated", "Several AIs review" in lab, lab)
    check("no page errors", not errs, errs)
    b.close()
print("%d / %d"%(sum(res),len(res)))
