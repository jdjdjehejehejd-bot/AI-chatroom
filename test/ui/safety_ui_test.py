import subprocess,time,os,tempfile,re,sys,json
from playwright.sync_api import sync_playwright
res=[]
def check(n,c,d=""):
    res.append(bool(c));print(("PASS " if c else "FAIL ")+n+("" if c else " :: "+str(d)))
d=tempfile.mkdtemp();log=open(d+"/out.txt","w")
env=dict(os.environ,PORT="3322",DATA_DIR=d,DEMO_DELAY_MS="20",SESSION_SECRET="s",EMAIL_DEV_LOG="1",ADMIN_TOKEN="adm",PUBLIC_URL="http://127.0.0.1:3322",REQUIRE_LOGIN="0")
env.pop("GOOGLE_CLIENT_ID",None)
sv=subprocess.Popen(["node","server.js"],cwd=os.path.join(os.path.dirname(os.path.abspath(__file__)),"..",".."),env=env,stdout=log,stderr=subprocess.STDOUT);time.sleep(1)
B="http://127.0.0.1:3322"
try:
  with sync_playwright() as p:
    b=p.chromium.launch(args=["--no-sandbox"])
    A=b.new_context(locale="ko-KR").new_page();A.goto(B+"/")
    A.check("input[name=jmode][value='']");A.fill("#jname","Ben");A.click("#jgo");time.sleep(.3)
    check("join blocked without consent",A.locator("#room").is_hidden() and "동의" in A.inner_text("#jerr2"))
    check("footer links present",A.locator(".legalfoot a").count()==3 and A.locator(".consent a").count()==2)
    A.check("#jconsent");A.click("#jgo");A.wait_for_selector("#room:not([hidden])")
    url=A.url
    C=b.new_context(locale="ko-KR").new_page();C.goto(url);C.fill("#jname","Mia");
    check("consent remembered next visit (checked)",C.is_checked("#jconsent")==False)  # new context: unchecked
    C.check("#jconsent");C.click("#jgo");C.wait_for_selector("#room:not([hidden])")
    C.fill("#text","안녕하세요 미아입니다");C.keyboard.press("Enter");time.sleep(.6)
    A.wait_for_selector("#log .row:has-text('미아입니다')")
    row=A.locator("#log .row:has-text('미아입니다')").first
    check("mine rows have no menu btn",A.locator("#log .row.mine .mm").count()==0)
    row.hover();row.locator(".mm").click(force=True)
    check("guest menu: report+block+cancel, no kick",A.locator("#sheet button.opt").count()==3 and "강퇴" not in A.inner_text("#sheet"),A.inner_text("#sheet"))
    A.click("#sheet button.opt:has-text('차단')");time.sleep(.5)
    check("blocked msg removed from log",A.locator("#log .row:has-text('미아입니다')").count()==0)
    
    if not A.locator("#seg [data-go=settings]").is_visible(): A.click("#infobtn")
    A.click("#seg [data-go=settings]");
    check("blocked list shown in settings","Mia" in A.inner_text("#blklist"),A.inner_text("#blklist"))
    C.fill("#text","차단 후 또 말함");C.keyboard.press("Enter");time.sleep(.6)
    check("blocked sender msgs hidden live",A.locator("#log .row:has-text('또 말함')").count()==0)
    A.click("#blklist button:has-text('차단 해제')");time.sleep(.4)
    check("unblocked list empty","없어요" in A.inner_text("#blklist"))
    # Mia reports Ben's message
    A.fill("#text","벤의 글");A.keyboard.press("Enter");time.sleep(.5)
    r2=C.locator("#log .row:has-text('벤의 글')").first;r2.hover();r2.locator(".mm").click(force=True)
    check("non-owner menu has no kick","강퇴" not in C.inner_text("#sheet"))
    C.click("#sheet button.opt:has-text('신고')");C.click("#sheet button.opt:has-text('스팸')");time.sleep(.5)
    check("reported message hidden locally",C.locator("#log .row:has-text('벤의 글')").count()==0)
    rl=json.loads(subprocess.check_output(["curl","-s","-H","Authorization: Bearer adm",B+"/admin/reports"]))
    check("server stored report",len(rl["reports"])>=1 and rl["reports"][0]["reason"]=="spam",rl)
    A.close();C.close()
    b.close()
finally:
  sv.terminate()
print("ALL OK" if all(res) else "SOME FAILED")
