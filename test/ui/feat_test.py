import sys, urllib.request
from playwright.sync_api import sync_playwright
B1,B2=sys.argv[1],sys.argv[2]
res=[]
def check(n,c,i=""): res.append(bool(c)); print(("PASS " if c else "FAIL ")+n+(" | "+str(i) if (not c and i) else ""))
def used(pg): return int(pg.inner_text("#budtxt").split("/")[0])
def run(pg,text,n):
    pg.fill("#text",text); pg.press("#text","Enter")
    pg.wait_for_function("document.querySelectorAll('#log .row .tag').length>=%d"%n, timeout=12000); pg.wait_for_timeout(500)
with sync_playwright() as p:
    b=p.chromium.launch(args=["--no-sandbox"]); errs=[]
    def page(): 
        x=b.new_page(locale="ko-KR", bypass_csp=True, viewport={"width":1280,"height":800}); x.on("pageerror",lambda e:errs.append(str(e))); return x
    # FREE: make mode
    A=page(); A.goto(B1+"/"); A.check("input[name=jmode][value=make]"); A.fill("#jname","Ben"); A.check("#jconsent",force=True); A.click("#jgo"); A.wait_for_selector("#room:not([hidden])")
    A.click('#seg [data-go=settings]')
    check("free: pipeline editor locked", A.is_disabled("#pipeapply") and A.is_visible("#pipelock"))
    A.fill("#bname","관저 로스터리"); A.evaluate("document.getElementById('bprimary').value='#aa3300'"); A.click("#bsave"); A.wait_for_timeout(300)
    run(A,"동네 카페 웹사이트",3)
    A.click('#seg [data-go=deliv]')
    A.click("#dtoggle"); code=A.inner_text("#dcode")
    check("brand name + color in html", "관저 로스터리" in code and "#aa3300" in code, code[:200])
    A.click("#shareres"); A.wait_for_selector("#sharebox input")
    url=A.input_value("#sharebox input"); r=urllib.request.urlopen(url); html=r.read().decode(); csp=r.headers.get("content-security-policy","")
    check("share page served w/ CSP + sandbox iframe", "sandbox=\"\"" in html and "default-src 'none'" in csp, csp)
    check("free: badge present", "나도 만들어 보기" in html)
    S=page(); S.goto(url); fr=S.frame_locator("iframe"); check("share page renders deliverable", "핵심 내용" in fr.locator("body").inner_text())
    A.click("#sharechat"); A.wait_for_timeout(300); u2=A.input_value("#sharebox input"); h2=urllib.request.urlopen(u2).read().decode()
    check("chat highlight page escapes + shows", "편집자" in h2 and "badge" in h2)
    try: urllib.request.urlopen(B1+"/s/000000000000"); nf=False
    except Exception as e: nf=("404" in str(e))
    check("unknown share 404", nf)
    u0=used(A); A.click('#seg [data-go=deliv]'); A.click("#retry"); A.wait_for_timeout(3500)
    check("free retry consumes budget (+3)", used(A)==u0+3, (u0,used(A)))
    A.click('#seg [data-go=settings]'); check("stats show runs", "AI 요청 실행" in A.inner_text("#stats"))
    # PLUS
    C=page(); C.goto(B2+"/"); C.fill("#jname","Dev"); C.check("#jconsent",force=True); C.click("#jgo"); C.wait_for_selector("#room:not([hidden])")
    C.click("#devplan"); C.wait_for_function("document.querySelector('#planbadge').innerText.includes('플러스')")
    C.click('#seg [data-go=assets]'); C.click('[data-mode=make]'); C.click("#modeok"); C.wait_for_function("document.querySelectorAll('#ais .ai-item').length==4")
    C.click('#seg [data-go=settings]'); check("plus: pipeline unlocked", not C.is_disabled("#pipeapply"))
    # edit pipeline to 기획자 -> 편집자
    for _ in range(4): C.click("#pipesteps .x >> nth=0")
    C.select_option("#pipeadd","기획자"); C.click("#pipeplus"); C.select_option("#pipeadd","편집자"); C.click("#pipeplus"); C.click("#pipeapply"); C.wait_for_timeout(400)
    run(C,"카페 소개 페이지",2); u1=used(C)
    check("custom pipeline: 2 calls", u1==2, u1)
    C.click('#seg [data-go=deliv]'); C.click("#retry"); C.wait_for_timeout(3000)
    check("plus retry refunds previous run (net +0)", used(C)==u1, (u1,used(C)))
    C.click('#seg [data-go=deliv]'); C.click("#shareres"); C.wait_for_selector("#sharebox input"); h3=urllib.request.urlopen(C.input_value("#sharebox input")).read().decode()
    check("plus: no badge", "나도 만들어 보기" not in h3)
    C.click('#seg [data-go=settings]'); check("refund count shown", "품질 보증 환불" in C.inner_text("#stats"))
    check("no JS errors", not errs, errs)
    b.close()
print(sum(res),"/",len(res))
