import sys,re,subprocess,time,urllib.request,os
from playwright.sync_api import sync_playwright
B=sys.argv[1]; ok=0; tot=0
def check(n,c,d=""):
    global ok,tot; tot+=1; ok+=bool(c); print(("PASS " if c else "FAIL ")+n, "" if c else "| "+str(d))
def get(path,hdr=None):
    r=urllib.request.Request(B+path,headers=hdr or {}); return urllib.request.urlopen(r).read().decode()
HAN=re.compile(r"[가-힣]")
def nk(s): return s.replace("한국어","")
with sync_playwright() as p:
    b=p.chromium.launch(args=["--no-sandbox"]); errs=[]
    for loc,word,lang in [("en-US","Join","en"),("ja-JP","参加","ja"),("zh-CN","加入","zh"),("es-ES","Entrar","es"),("fr-FR","Join","en"),("ko-KR","입장","ko")]:
        c=b.new_context(locale=loc,bypass_csp=True); pg=c.new_page(); pg.on("pageerror",lambda e:errs.append(str(e)))
        pg.goto(B+"/"); pg.wait_for_selector("#jgo")
        txt=pg.inner_text("body"); l=pg.evaluate("document.documentElement.lang")
        check(f"{loc} → lang={lang}", l==lang, l)
        if lang!="ko": check(f"{loc} 첫 화면에 한글 없음", not HAN.search(nk(txt)), HAN.findall(nk(txt))[:20])
        # 법적 링크에 ?lang
        h=pg.get_attribute('a[href^="/terms"]',"href"); check(f"{loc} 약관 링크 lang", h and ("lang="+lang) in h, h)
        c.close()
    # 언어 전환 + 유지
    c=b.new_context(locale="en-US",bypass_csp=True); pg=c.new_page(); pg.goto(B+"/"); pg.wait_for_selector("#jgo")
    sel=pg.locator("#langbox1 select"); check("언어 선택기 존재", sel.count()==1)
    with pg.expect_navigation(): sel.select_option("ja")
    pg.wait_for_selector("#jgo"); check("일본어로 전환", pg.evaluate("document.documentElement.lang")=="ja")
    pg.reload(); pg.wait_for_selector("#jgo"); check("새로고침 후 유지", pg.evaluate("document.documentElement.lang")=="ja")
    # 입장 후 화면·시스템 메시지
    pg.fill("#jname","Aki"); pg.check("#jconsent",force=True); pg.click("#jgo"); pg.wait_for_selector("#room:not([hidden])")
    time.sleep(1); body=pg.inner_text("body")
    check("방 화면에 한글 없음(ja)", not HAN.search(nk(body)), "".join(sorted(set(HAN.findall(nk(body)))))[:40])
    # _tx 패턴
    r=pg.evaluate("""()=>[_tx('Aki 님이 입장했습니다.'),_tx('AI 연속 발언 한도(3회)에 도달했습니다. 사람이 말하면 이어집니다.'),_tx('에셋을 적용하지 못했습니다: 이미 사용 중인 이름입니다.'),_tx('없는 문장입니다')]""")
    check("_tx 입장", "Aki" in r[0] and not HAN.search(r[0]), r[0]); check("_tx 숫자 치환", "3" in r[1] and not HAN.search(r[1]), r[1])
    check("_tx 중첩", not HAN.search(r[2]), r[2]); check("_tx 미등록은 원문", r[3]=="없는 문장입니다")
    c.close()
    # 알 수 없는 언어 → en, ?lang= 우선
    c=b.new_context(locale="de-DE",bypass_csp=True); pg=c.new_page(); pg.goto(B+"/?lang=es"); pg.wait_for_selector("#jgo")
    check("?lang=es 우선", pg.evaluate("document.documentElement.lang")=="es"); c.close()
    check("JS 오류 없음", not errs, errs)
    b.close()
# 법적 페이지
for lg,key in [("ko","개인정보"),("en","Privacy"),("ja","Privacy"),("es","Privacy")]:
    h=get("/privacy?lang="+lg); check(f"privacy ?lang={lg}", key in h)
h=get("/privacy",{"Accept-Language":"en-US,en;q=0.9"}); check("privacy Accept-Language en", "Privacy" in h and not HAN.search(re.sub(r"<[^>]+>","",h)[:400]))
for lg,key in [("ko","삭제"),("en","Delete"),("ja","削除"),("zh","删除"),("es","Eliminar")]:
    h=get("/delete-account?lang="+lg); check(f"delete-account ?lang={lg}", key in h)
print(f"{ok} / {tot}")
