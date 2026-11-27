# 관문(실행 계획) 화면: 검토 → 평가 → 공유 → 공유 페이지 열람 → '내 문서도 검토받기' → 새 방 첫 작업 완료가
# 운영자 화면의 관문 표에 그대로 잡히는지, 운영자 화면 스크립트가 오류 없이 도는지 확인한다.
import sys, os, subprocess, time
from playwright.sync_api import sync_playwright
ROOT=os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","..")
srv=subprocess.Popen(["node","server.js"],cwd=ROOT,env=dict(os.environ,PORT="3106",DEMO_DELAY_MS="40",REQUIRE_LOGIN="0",FREE_KEYLESS="0",ADMIN_TOKEN="adm-test-token",DEFAULT_POLICY="mention"),stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1.5)
B="http://127.0.0.1:3106"; res=[]
def check(n,c,i=""): res.append(bool(c)); print(("PASS " if c else "FAIL ")+n+(" | "+str(i) if (not c and i) else ""))
DOC="보고서 초안입니다. "+"본문 문장입니다. "*60
try:
  with sync_playwright() as p:
    b=p.chromium.launch(args=["--no-sandbox"]); errs=[]
    ctx=b.new_context(locale="ko-KR",viewport={"width":1280,"height":800}); pg=ctx.new_page(); pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(B+"/?mode=review"); pg.wait_for_selector("#jgo")
    pg.fill("#jname","Ann"); pg.check("#jconsent",force=True); pg.click("#jgo"); pg.wait_for_selector("#room:not([hidden])"); pg.wait_for_timeout(300)
    pg.fill("#text",DOC); pg.keyboard.press("Enter"); pg.wait_for_timeout(2500)
    pg.click('#seg [data-go="deliv"]'); pg.wait_for_timeout(200)
    pg.click('#delivbox button[data-rate="5"]'); pg.wait_for_timeout(200)
    pg.click("#shareres"); pg.wait_for_timeout(600)
    link=pg.evaluate("(function(){var a=[].slice.call(document.querySelectorAll('a,input,code,span')).map(function(x){return x.href||x.value||x.textContent}).filter(function(t){return /\\/s\\/[0-9a-f]{12}/.test(t)});return a[0]||''})()")
    sid=__import__("re").search(r"/s/[0-9a-f]{12}",link or "")
    check("sharing the review card gives a link", sid, link)
    # 다른 사람(새 브라우저)이 공유 페이지를 열고 '내 문서도 검토받기'로 새 방을 만들어 첫 검토를 끝낸다
    ctx2=b.new_context(locale="ko-KR",viewport={"width":390,"height":844}); v=ctx2.new_page(); v.on("pageerror",lambda e:errs.append(str(e)))
    v.goto(B+sid.group(0)); v.click("text=내 문서도 검토받기"); v.wait_for_selector("#jgo")
    check("the share CTA lands on a review room setup", v.is_checked("input[name=jmode][value=review]") and "ref=share" in v.url, v.url)
    v.fill("#jname","Mia"); v.check("#jconsent",force=True); v.click("#jgo"); v.wait_for_selector("#room:not([hidden])"); v.wait_for_timeout(300)
    v.fill("#text",DOC); v.keyboard.press("Enter"); v.wait_for_timeout(2500)
    # 운영자 화면
    a=ctx.new_page(); a.on("pageerror",lambda e:errs.append("admin: "+str(e)))
    a.goto(B+"/admin"); a.fill("#tok","adm-test-token"); a.click("#gtgo"); a.wait_for_selector("#gates .g")
    g=a.inner_text("#gates")
    check("gate 2 counts view → new room → first run done, and passes", "공유 페이지 열람 1 → 새 방 1 → 첫 작업 완료 1" in g, g)
    check("gate 1 shows the review rating and copy/share rate", "평가 1건" in g and "4~5점 100%" in g and "복사·공유" in g, g)
    check("gate 0 says there is no store and no paid calls yet (not passed)", "저장소 없음" in g and "유료 호출 0건" in g, g)
    check("run averages per kind are listed", "review:" in a.inner_text("#gates"), g)
    a.click("#evgo"); a.wait_for_timeout(500)
    evt=a.inner_text("#ev"); check("usage table renders with line breaks (script parses)", a.locator("#ev table").count()>=1 and "\n실행" in evt, (a.locator("#ev table").count(), evt[:300]))
    check("no page errors (main page, share CTA, admin)", not errs, errs)
    b.close()
finally:
  srv.terminate()
print("%d / %d"%(sum(res),len(res)))
