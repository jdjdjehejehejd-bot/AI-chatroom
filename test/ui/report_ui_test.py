import sys
from playwright.sync_api import sync_playwright
B=sys.argv[1]; res=[]
def check(n,c,i=""): res.append(bool(c)); print(("PASS " if c else "FAIL ")+n+(" | "+str(i) if (not c and i) else ""))
with sync_playwright() as p:
    b=p.chromium.launch(args=["--no-sandbox"]); errs=[]
    A=b.new_page(locale="ko-KR", bypass_csp=True, viewport={"width":1280,"height":900}); A.on("pageerror",lambda e:errs.append(str(e)))
    A.goto(B+"/"); A.check("input[name=jmode][value=brainstorm]"); A.fill("#jname","Ann"); A.check("#jconsent",force=True); A.click("#jgo"); A.wait_for_selector("#room:not([hidden])")
    check("cost hint before run", "예상: AI 호출 4회" in A.inner_text("#costhint") and "남은 예산" in A.inner_text("#costhint"), A.inner_text("#costhint"))
    A.click("#log .empty .btn >> nth=0"); A.press("#text","Enter")
    A.wait_for_function("document.body.innerText.includes('이번 실행')", timeout=12000)
    check("receipt in chat", "이번 실행: AI 호출 4회" in A.inner_text("#log"), A.inner_text("#log")[-120:])
    A.click('#seg [data-go=deliv]')
    check("no version select with a single version", A.locator("#dver").count()==0)
    check("next-step chips", A.locator(".dnext button").count()==2 and "한 단계 더 완성하기" in A.inner_text(".dnext"))
    A.click(".dnext button >> nth=0"); check("chip fills composer", len(A.input_value("#text"))>5, A.input_value("#text"))
    A.press("#text","Enter"); A.wait_for_function("(document.body.innerText.match(/이번 실행/g)||[]).length>=2", timeout=12000)
    A.click('#seg [data-go=deliv]'); A.wait_for_selector("#dver")
    check("version select appears", A.locator("#dver option").count()==2, A.locator("#dver option").count())
    A.select_option("#dver","1"); A.wait_for_selector("#drestore")
    check("old version view hides next chips", A.locator(".dnext").count()==0)
    A.click("#drestore"); A.wait_for_function("document.querySelectorAll('#dver option').length==3")
    check("restored → v3 latest selected", "v3" in A.locator("#dver option:checked").inner_text(), A.locator("#dver option:checked").inner_text())
    check("no page errors", not errs, errs)
    # english
    E=b.new_page(locale="en-US", bypass_csp=True); E.goto(B+"/"); E.check("input[name=jmode][value=make]"); E.fill("#jname","Eve"); E.check("#jconsent",force=True); E.click("#jgo"); E.wait_for_selector("#room:not([hidden])")
    check("cost hint english", "Estimated per request" in E.inner_text("#costhint"), E.inner_text("#costhint"))
    E.click("#log .empty .btn >> nth=0"); E.press("#text","Enter")
    E.wait_for_function("document.body.innerText.includes('This run:')", timeout=12000)
    check("receipt english", True); import re
    E.click('#seg [data-go=deliv]'); t=E.inner_text(".dnext"); check("next chips english, no Hangul", not re.search("[가-힣]",t), t)
    b.close()
print(sum(res),"/",len(res))
