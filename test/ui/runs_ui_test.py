import sys, os, subprocess, time
from playwright.sync_api import sync_playwright
# 멈추기 버튼은 1.2초 넘게 걸리는 작업에만 뜬다: 데모 응답을 느리게 한 서버를 따로 띄운다
ROOT=os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","..")
srv=subprocess.Popen(["node","server.js"],cwd=ROOT,env=dict(os.environ,PORT="3105",DEMO_DELAY_MS="1200",REQUIRE_LOGIN="0",FREE_KEYLESS="0",DEFAULT_POLICY="mention"),stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1.5)
B="http://127.0.0.1:3105"; res=[]
def check(n,c,i=""): res.append(bool(c)); print(("PASS " if c else "FAIL ")+n+(" | "+str(i) if (not c and i) else ""))
with sync_playwright() as p:
    b=p.chromium.launch(args=["--no-sandbox"]); errs=[]
    pg=b.new_page(locale="ko-KR",viewport={"width":1280,"height":800}); pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(B+"/?mode=make"); pg.wait_for_selector("#jgo")
    pg.fill("#jname","Ann"); pg.check("#jconsent",force=True); pg.click("#jgo"); pg.wait_for_selector("#room:not([hidden])"); pg.wait_for_timeout(400); pg.set_viewport_size({"width":390,"height":844}); pg.evaluate("delete document.getElementById('shell').dataset.info"); pg.wait_for_timeout(200)
    pg.fill("#text","카페 소개 페이지 만들어줘"); pg.keyboard.press("Enter")
    try: pg.wait_for_selector("#runbar:not([hidden])", timeout=4000); shown=True
    except Exception: shown=False
    check("a long AI run shows 'stop' above the composer", shown)
    bx=pg.locator("#runbar").bounding_box() if shown else None
    check("the stop bar fits a phone screen", bx and bx["x"]>=0 and bx["x"]+bx["width"]<=390, bx)
    if shown: pg.click("#runstop")
    pg.wait_for_timeout(1500)
    log=pg.inner_text("#log")
    check("stopping is confirmed in the chat", "진행 중인 AI 작업을 멈췄습니다" in log, log[-200:])
    check("the bar goes away after stopping", pg.locator("#runbar").is_hidden())
    pg.evaluate("document.getElementById('shell').dataset.info='1'"); pg.click('#seg [data-go="settings"]'); pg.wait_for_timeout(200)
    rl=pg.inner_text("#runlist") if pg.locator("#runlist").count() else ""
    check("recent runs list the stopped run with its mode name", "멈춤" in rl and "호출" in rl and "Make" in rl, rl)
    check("no page errors", not errs, errs)
    b.close()
srv.terminate()
print("%d / %d"%(sum(res),len(res)))
