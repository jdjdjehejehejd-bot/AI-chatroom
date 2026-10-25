import sys, json
from playwright.sync_api import sync_playwright
B1,B2=sys.argv[1],sys.argv[2]
res=[]
def check(n,c,i=""): res.append(bool(c)); print(("PASS " if c else "FAIL ")+n+(" | "+str(i) if (not c and i) else ""))
with sync_playwright() as p:
    b=p.chromium.launch(args=["--no-sandbox"]); errs=[]
    A=b.new_page(locale="ko-KR", bypass_csp=True, viewport={"width":1280,"height":800},accept_downloads=True); A.on("pageerror",lambda e:errs.append(str(e)))
    A.goto(B1+"/"); A.check("input[name=jmode][value=asset]"); A.set_input_files("#jfile","good.json"); A.wait_for_selector("#jasset .loaded")
    A.fill("#jname","Ben"); A.check("#jconsent",force=True); A.click("#jgo"); A.wait_for_selector("#room:not([hidden])")
    A.click('#seg [data-go=assets]')
    check("library has uploaded asset", A.locator("#liblist .mcard").count()==1)
    with A.expect_download() as d: A.click("[data-lib-dl]")
    path=d.value.path(); data=json.load(open(path))
    check("downloaded asset is valid JSON w/ ais", data["format"]=="aichat-asset/1" and len(data["ais"])>=1 and d.value.suggested_filename.endswith(".aichat.json"), d.value.suggested_filename)
    # re-upload downloaded file in a new room (round trip)
    B=b.new_page(locale="ko-KR", bypass_csp=True, viewport={"width":1280,"height":800}); B.on("pageerror",lambda e:errs.append(str(e)))
    B.goto(B1+"/"); B.check("input[name=jmode][value=asset]"); B.set_input_files("#jfile",path); B.wait_for_selector("#jasset .loaded")
    B.fill("#jname","Mia"); B.check("#jconsent",force=True); B.click("#jgo"); B.wait_for_selector("#room:not([hidden])")
    check("round trip: same AIs", B.locator("#ais .ai-item").count()==len(data["ais"]))
    # export current from a mode room
    C=b.new_page(locale="ko-KR", bypass_csp=True, viewport={"width":1280,"height":800},accept_downloads=True); C.on("pageerror",lambda e:errs.append(str(e)))
    C.goto(B1+"/"); C.check("input[name=jmode][value=code]"); C.fill("#jname","Dev"); C.check("#jconsent",force=True); C.click("#jgo"); C.wait_for_selector("#room:not([hidden])")
    C.click('#seg [data-go=assets]')
    with C.expect_download() as d2: C.click("#expcur")
    cur=json.load(open(d2.value.path())); check("export current room (mode) valid", cur["name"]=="Code" and len(cur["ais"])==4 and len(cur["rules"])<=600, (cur["name"],len(cur["rules"])))
    # exported file re-imports
    D=b.new_page(locale="ko-KR", bypass_csp=True, viewport={"width":1280,"height":800}); D.on("pageerror",lambda e:errs.append(str(e)))
    D.goto(B1+"/"); D.check("input[name=jmode][value=asset]"); D.set_input_files("#jfile",d2.value.path()); 
    ok=D.locator("#jasset .loaded").count()==1 or (D.wait_for_selector("#jasset .loaded",timeout=3000) is not None)
    check("exported mode file re-imports", ok)
    # apply from library + delete
    A.click("[data-lib-apply]"); A.wait_for_timeout(300); check("apply from library ok", A.locator("#ais .ai-item").count()==len(data["ais"]))
    A.click('#liblist .mcard button:has-text("삭제")'); A.wait_for_timeout(300); check("delete from library", A.locator("#liblist .mcard").count()==0)
    check("no JS errors", not errs, errs)
    b.close()
print(sum(res),"/",len(res))
