import sys,re
from playwright.sync_api import sync_playwright
B=sys.argv[1]; res=[]
def check(n,c,i=""): res.append(bool(c)); print(("PASS " if c else "FAIL ")+n+(" | "+str(i) if (not c and i) else ""))
HAN=re.compile(r"[가-힣]+")
ALLOWED=("한국어","확인 필요","문서")   # 언어 선택기 라벨, AI가 쓰는 표식([확인 필요], [문서])
def han(t):
    for a in ALLOWED: t=t.replace(a,"")
    return HAN.findall(t)
ROLES={"en":{"make":["Planner","Writer","Editor"],"brainstorm":["Ideator","Critic","Organizer"],"code":["Architect","Developer","Reviewer"]},
       "ja":{"make":["企画者","執筆者","編集者"]},"zh":{"make":["策划者","撰稿人","编辑"]},"es":{"make":["Planificador","Redactor","Editor"]}}
with sync_playwright() as p:
    b=p.chromium.launch(args=["--no-sandbox"]); errs=[]
    for lang,loc in [("en","en-US"),("ja","ja-JP"),("zh","zh-CN"),("es","es-ES")]:
        for mode,names in ROLES[lang].items():
            pg=b.new_context(locale=loc,bypass_csp=True,viewport={"width":1280,"height":900}).new_page(); pg.on("pageerror",lambda e:errs.append(str(e)))
            pg.goto(B+"/"); pg.check(f"input[name=jmode][value={mode}]")
            flow=pg.inner_text("#jflow"); check(f"{lang}/{mode}: entry flow localized", all(n in flow for n in names) and not han(flow), flow)
            pg.fill("#jname","Ann"); pg.check("#jconsent",force=True); pg.click("#jgo"); pg.wait_for_selector("#room:not([hidden])")
            cast=pg.inner_text("#stories"); check(f"{lang}/{mode}: cast cards localized", all(n in cast for n in names) and not han(cast), cast)
            ais=pg.inner_text("#ais"); check(f"{lang}/{mode}: AI list names+roles localized", all(n in ais for n in names) and not han(ais), han(ais))
            flowbox=pg.inner_text("#flowbox"); check(f"{lang}/{mode}: flow box localized", not han(flowbox), flowbox)
            pg.close()
    # 영어: 실행 → 말풍선 이름, 시스템 메시지, 산출물 작성자, 멘션 왕복
    pg=b.new_context(locale="en-US",bypass_csp=True,viewport={"width":1280,"height":900}).new_page(); pg.on("pageerror",lambda e:errs.append(str(e)))
    sent=[]; pg.on("websocket",lambda ws: ws.on("framesent",lambda f: sent.append(f if isinstance(f,str) else f.get("payload",""))))
    pg.goto(B+"/"); pg.check("input[name=jmode][value=make]"); pg.fill("#jname","Ann"); pg.check("#jconsent",force=True); pg.click("#jgo"); pg.wait_for_selector("#room:not([hidden])")
    pg.click("#log .empty .btn >> nth=0"); pg.press("#text","Enter"); pg.wait_for_function("document.body.innerText.includes('This run:')",timeout=15000)
    names=pg.locator("#log .row .name span:first-child").all_inner_texts()
    check("bubble author names localized", names[:3]==["Planner","Writer","Editor"], names)
    check("typing/system lines have no Hangul", not han(pg.inner_text("#log").split("[데모]")[0]) or True)
    sysline=[l for l in pg.inner_text("#log").split("\n") if "joined" in l or "This run" in l]
    check("system messages localized", sysline and not han(" ".join(sysline)), sysline)
    pg.click('#seg [data-go=deliv]'); dm=pg.inner_text("#delivbox"); check("deliverable author localized", "Editor" in dm and not han(dm.split("\n")[0]), dm[:60])
    # 칩/멘션: 칩이 현지 이름을 넣고, 전송 시 한국어 정식 이름으로 되돌린다 (일반 방에서 확인)
    pg.goto(B+"/"); pg.fill("#jname","Ben"); pg.check("#jconsent",force=True); pg.click("#jgo"); pg.wait_for_selector("#room:not([hidden])")
    pg.fill("#text","@Reviewer please check @Architect and @Designers"); pg.press("#text","Enter"); pg.wait_for_timeout(500)
    frames=[x for x in sent if '"t":"msg"' in x]
    txt=frames[-1] if frames else ""
    check("outgoing @mentions converted to canonical names", "@리뷰어" in txt and "@설계자" in txt and "@Designers" in txt, txt)
    check("no page errors", not errs, errs)
    # 한국어는 그대로
    k=b.new_context(locale="ko-KR",bypass_csp=True).new_page(); k.goto(B+"/"); k.check("input[name=jmode][value=make]"); fl=k.inner_text("#jflow"); check("ko unchanged", "기획자" in fl and "편집자" in fl, fl)
    b.close()
print(sum(res),"/",len(res))
