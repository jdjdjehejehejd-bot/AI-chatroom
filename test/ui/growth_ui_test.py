import re,time
from playwright.sync_api import sync_playwright
B="http://127.0.0.1:3313";res=[]
def check(n,c,i=""): res.append(bool(c)); print(("PASS " if c else "FAIL ")+n+(" | "+str(i) if (not c and i) else ""))
def agree(pg):
    """동의 체크: 보이고 활성일 때까지 기다린 뒤 실제 클릭하고, 상태가 바뀌었는지 직접 확인한다(강제 클릭·임의 대기 없음)."""
    box=pg.locator("#jconsent"); box.wait_for(state="visible"); box.scroll_into_view_if_needed()
    for _ in range(3):
        if box.is_checked(): return
        pg.locator("label.consent input").click()
        try: pg.wait_for_function("document.getElementById('jconsent').checked", timeout=1500); return
        except Exception: pass
    raise AssertionError("consent checkbox did not become checked")
with sync_playwright() as p:
    b=p.chromium.launch(args=["--no-sandbox"]);errs=[]
    pg=b.new_context(locale="ko-KR", bypass_csp=True, viewport={"width":1280,"height":820}).new_page();pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(B+"/");pg.wait_for_selector("#gbox:not([hidden])")
    pg.click("#embtn");pg.fill("#emaddr","ben@example.com");pg.click("#emsend");pg.wait_for_selector("#emcodewrap:not([hidden])");time.sleep(.3)
    code=re.findall(r"코드: (\d{6})",open("growth_server.log").read())[-1];pg.fill("#emcode",code);pg.click("#emverify");pg.wait_for_selector("#gwho:not([hidden])")
    pg.check("input[name=jmode][value=brainstorm]");agree(pg); pg.click("#jgo");pg.wait_for_selector("#room:not([hidden])")
    check("credits chip shows 0 used of 60","60/60" in pg.inner_text("#crtxt"),pg.inner_text("#crtxt"))
    pg.fill("#text","새 앱 아이디어");pg.press("#text","Enter");pg.wait_for_function("document.querySelector('#crtxt').innerText.indexOf('60/60')<0",timeout=10000)
    check("credits decrease after AI call","60/60" not in pg.inner_text("#crtxt"),pg.inner_text("#crtxt"))
    # memory card
    pg.click('#seg [data-go=doc]');check("memory hint explains free manual mode","플러스" in pg.inner_text("#memhint"))
    pg.fill("#memtext","마감은 금요일");pg.click("#memsave");pg.wait_for_timeout(300)
    # publish
    pg.click('#seg [data-go=assets]');pg.fill("#pubdesc","브레인스토밍 3인 팀");pg.click("#pubgo");pg.wait_for_function("document.getElementById('pubmsg').innerText.length>0")
    check("publish success message","게시했어요" in pg.inner_text("#pubmsg"),pg.inner_text("#pubmsg"))
    check("premium option hidden for free",pg.locator("#pubprem").is_hidden())
    # market from home
    pg.reload();pg.wait_for_selector("#gwho:not([hidden])")
    pg.click("#marketbtn");pg.wait_for_selector("#mklist .mk")
    check("market shows published asset + featured banner","브레인스토밍 3인 팀" in pg.inner_text("#mklist") and pg.locator("#mkfeat .mk.feat").count()==1)
    pg.click("#mklist .mk >> text=♡ 좋아요");pg.wait_for_function("document.querySelector('#mklist .likes').innerText.indexOf('1')>=0")
    check("like counted","♥ 1" in pg.inner_text("#mklist .likes"))
    pg.fill("#mkq","없는검색어");pg.wait_for_function("document.querySelector('#mklist .mk')===null");check("search filters",True)
    pg.fill("#mkq","");pg.wait_for_selector("#mklist .mk")
    pg.click("#mklist .mk >> text=이 구성으로 방 만들기");pg.wait_for_selector("#jasset .loaded")
    check("install fills entry with asset",pg.locator("#market").is_hidden() and "Brainstorm" in pg.inner_text("#jasset"),pg.inner_text("#jasset"))
    agree(pg); pg.click("#jgo");pg.wait_for_selector("#room:not([hidden])");check("room created from marketplace asset",pg.locator("#ais .ai-item").count()==4)
    # my rooms (server-side) after clearing local list
    pg.wait_for_timeout(3500)
    pg.evaluate("localStorage.clear()");pg.goto(B+"/");pg.wait_for_selector("#gwho:not([hidden])");pg.wait_for_selector("#acctroomswrap:not([hidden])",timeout=8000)
    check("my account rooms listed from server (>=2)",pg.locator("#acctrooms .room").count()>=2,pg.locator("#acctrooms .room").count())
    pg.click("#acctrooms .room >> nth=0");pg.wait_for_selector("#room:not([hidden])");check("open room from account list",True)
    check("no page errors",not errs,errs);b.close()
print(sum(res),"/",len(res))
