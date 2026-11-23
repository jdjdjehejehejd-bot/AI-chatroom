import sys
from playwright.sync_api import sync_playwright
B=sys.argv[1]; res=[]
def check(n,c,i=""): res.append(bool(c)); print(("PASS " if c else "FAIL ")+n+(" | "+str(i) if (not c and i) else ""))
with sync_playwright() as p:
    b=p.chromium.launch(args=["--no-sandbox"]); errs=[]
    for vp in [{"width":1280,"height":800},{"width":375,"height":812}]:
        ctx=b.new_context(locale="ko-KR",bypass_csp=True,viewport=vp); pg=ctx.new_page(); pg.on("pageerror",lambda e:errs.append(str(e)))
        pg.goto(B+"/"); 
        if vp["width"]<500: pg.click("#newroom")
        pg.fill("#jname","Ann"); pg.check("#jconsent",force=True); pg.click("#jgo"); pg.wait_for_selector("#room:not([hidden])")
        rid=pg.evaluate("new URLSearchParams(location.search).get('room')")
        pg.click("#back" if vp["width"]<500 else "#newroom"); pg.wait_for_timeout(300)
        # 최근 방을 누르면 입력 화면이 보이지 않고 바로(또는 '들어가는 중' 뒤에) 방으로 들어간다
        seen=pg.evaluate("""() => new Promise(res => { const seen = []; const t0 = performance.now();
          const f = () => { const form = document.getElementById('joinform'); const vis = form && form.offsetParent !== null && !document.getElementById('entrypane').hidden;
            seen.push(vis); if (performance.now() - t0 < 1500) requestAnimationFrame(f); else res(seen); };
          document.querySelector('#roomlist .room').click(); requestAnimationFrame(f); })""")
        check("recent room: join form never flashes (%dpx)" % vp["width"], not any(seen), sum(1 for x in seen if x))
        check("recent room: entered the same room (%dpx)" % vp["width"], pg.is_visible("#room") and pg.evaluate("new URLSearchParams(location.search).get('room')")==rid)
        ctx.close()
    # 새로고침·내 방 링크 다시 열기: 이름·동의 화면 없이 바로 이어서 입장. 처음 받은 초대 링크는 이름을 묻는다
    ctx=b.new_context(locale="ko-KR",bypass_csp=True); pg=ctx.new_page(); pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(B+"/"); pg.wait_for_selector("#jgo"); pg.fill("#jname","Ann"); pg.check("#jconsent",force=True); pg.click("#jgo"); pg.wait_for_selector("#room:not([hidden])")
    url=pg.url; pg.reload(); pg.wait_for_timeout(2500)
    check("refresh rejoins my room without the name form", pg.is_visible("#room") and not pg.is_visible("#jgo"))
    pg2=b.new_context(locale="ko-KR",bypass_csp=True).new_page(); pg2.goto(url); pg2.wait_for_timeout(2000)
    check("a first-time invitee still sees the name form", pg2.is_visible("#jgo") and not pg2.is_visible("#room"))
    ctx.close()
    check("no page errors", not errs, errs)
    b.close()
print("%d / %d"%(sum(res),len(res)))
