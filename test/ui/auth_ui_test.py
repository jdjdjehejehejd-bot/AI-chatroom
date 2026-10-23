import re,time
from playwright.sync_api import sync_playwright
B="http://127.0.0.1:3304";res=[]
def check(n,c,i=""): res.append(bool(c)); print(("PASS " if c else "FAIL ")+n+(" | "+str(i) if (not c and i) else ""))
with sync_playwright() as p:
    b=p.chromium.launch(args=["--no-sandbox"]);errs=[]
    pg=b.new_context(locale="ko-KR", bypass_csp=True, viewport={"width":1280,"height":820}).new_page();pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.route("**/accounts.google.com/**",lambda r:r.abort())
    pg.goto(B+"/");pg.wait_for_selector("#gbox:not([hidden])")
    check("GitHub + email buttons visible, google hidden (no client id)",pg.locator("#ghbtn").is_visible() and pg.locator("#embtn").is_visible() and pg.locator("#gbtn").is_hidden())
    check("gate message + form gated before login",pg.locator("#gatemsg").is_visible() and pg.locator("#joinform.gated").count()==1)
    pg.fill("#jname","x",force=True);pg.check("#jconsent",force=True); pg.click("#jgo",force=True);pg.wait_for_selector("#jerr2:not([hidden])");check("start blocked while logged out","로그인" in pg.inner_text("#jerr2") and pg.locator("#room").is_hidden());pg.fill("#jname","",force=True)
    pg.click("#embtn");pg.fill("#emaddr","ben@example.com");pg.click("#emsend");pg.wait_for_selector("#emcodewrap:not([hidden])")
    time.sleep(.3);code=re.findall(r"코드: (\d{6})",open("auth_ui_server.log").read())[-1]
    pg.fill("#emcode","000000" if code!="000000" else "111111");pg.click("#emverify");pg.wait_for_selector("#jerr2:not([hidden])")
    check("wrong code shows error",True)
    pg.fill("#emcode",code);pg.click("#emverify");pg.wait_for_selector("#gwho:not([hidden])")
    check("gate lifts after login",pg.locator("#gatemsg").is_hidden());check("email login -> who bar + name prefilled","이메일" in pg.inner_text("#gwho") and pg.input_value("#jname")=="ben",pg.inner_text("#gwho"))
    check("github connect link offered in who bar",pg.locator("#gwho a.ghconn").count()==1)
    pg.click("#gwho a.ghconn");pg.wait_for_selector("#gwho:not([hidden])");pg.wait_for_timeout(500)
    check("after OAuth round-trip: still email account + GitHub connected @octo","이메일" in pg.inner_text("#gwho") and "@octo" in pg.inner_text("#gwho"),pg.inner_text("#gwho"))
    pg.select_option if False else None
    pg.check("input[name=jmode][value=code]");pg.check("#jconsent",force=True); pg.click("#jgo");pg.wait_for_selector("#room:not([hidden])")
    pg.click('#seg [data-go=settings]');check("settings account section shows connection","@octo" in pg.inner_text("#acct"),pg.inner_text("#acct"))
    pg.click('#seg [data-go=deliv]');check("gist buttons hidden until deliverable? visible when connected",pg.locator("#gistres").is_visible())
    pg.fill("#text","간단한 함수");pg.press("#text","Enter");pg.wait_for_selector('#delivbox .dmeta',timeout=20000)
    pg.click("#gistres");pg.wait_for_timeout(1500);pg.wait_for_selector("#gistmsg a")
    check("gist link shown",pg.get_attribute("#gistmsg a","href")=="https://gist.github.com/octo/zzz")
    pg.click('#seg [data-go=settings]');pg.click("#acct .ghdisc");pg.wait_for_timeout(400)
    check("disconnect works",pg.locator("#acct a.ghconn").count()==1 and pg.locator("#gistres").is_hidden())
    # reload keeps session
    pg.goto(B+"/");pg.wait_for_selector("#gwho:not([hidden])");check("session persists across reload",True)
    pg.click("#glogout");pg.wait_for_selector("#glogin:not([hidden])");check("logout shows login options",True)
    # autherr display
    pg.goto(B+"/?autherr=%ED%85%8C%EC%8A%A4%ED%8A%B8");pg.wait_for_selector("#jerr2:not([hidden])");check("autherr surfaced + stripped from URL","autherr" not in pg.url)
    check("no page errors",not errs,errs);b.close()
print(sum(res),"/",len(res))
