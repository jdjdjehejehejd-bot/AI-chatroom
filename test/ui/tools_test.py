import sys
from playwright.sync_api import sync_playwright
B1=sys.argv[1];res=[]
def check(n,c,i=""): res.append(bool(c)); print(("PASS " if c else "FAIL ")+n+(" | "+str(i) if (not c and i) else ""))
with sync_playwright() as p:
    b=p.chromium.launch(args=["--no-sandbox"]);errs=[]
    A=b.new_context(locale="ko-KR", bypass_csp=True, viewport={"width":1280,"height":800}).new_page();A.on("pageerror",lambda e:errs.append(str(e)))
    A.goto(B1+"/");A.check("input[name=jmode][value=asset]");A.set_input_files("#jfile","good.json");A.wait_for_selector("#jasset .loaded")
    A.fill("#jname","Ben");A.check("#jconsent",force=True); A.click("#jgo");A.wait_for_selector("#room:not([hidden])")
    # tools
    A.click('#seg [data-go=tools]');A.wait_for_selector("#toolbox textarea")
    A.fill("#toolbox textarea >> nth=0",'{"a":1,"b":[1,2]}');A.click("text=정리(들여쓰기)")
    check("json pretty",'"b": [' in A.input_value("#toolbox textarea >> nth=1"))
    A.fill("#toolbox textarea >> nth=0",'{bad');A.click("text=정리(들여쓰기)");check("json error shown","오류" in A.input_value("#toolbox textarea >> nth=1"))
    A.select_option("#toolsel","regex");A.fill("#toolbox input >> nth=0","(\\d+)-(\\w+)");A.fill("#toolbox textarea >> nth=0","12-ab 7-z")
    check("regex matches","2개 일치" in A.input_value("#toolbox textarea >> nth=1"),A.input_value("#toolbox textarea >> nth=1"))
    A.fill("#toolbox input >> nth=0","(");check("regex error handled","정규식 오류" in A.input_value("#toolbox textarea >> nth=1"))
    A.select_option("#toolsel","enc");A.fill("#toolbox textarea >> nth=0","안녕 hi");A.click("text=Base64 인코딩");enc=A.input_value("#toolbox textarea >> nth=1")
    A.fill("#toolbox textarea >> nth=0",enc);A.click("text=Base64 디코딩");check("base64 roundtrip utf8 "+enc,A.input_value("#toolbox textarea >> nth=1")=="안녕 hi")
    A.select_option("#toolsel","color");A.wait_for_selector("#colorout .btn");check("color palette+contrast","대비" in A.inner_text("#colorout") and A.locator("#colorout .btn").count()==6)
    A.select_option("#toolsel","count");A.fill("#toolbox textarea","안녕하세요 hello");check("count tool","글자 11" in A.inner_text("#toolbox"),A.inner_text("#toolbox"))
    A.select_option("#toolsel","spark");check("spark card","소재:" in A.inner_text("#sparkout"))
    A.click("text=채팅에 붙이기");check("paste to chat","소재:" in A.input_value("#text"))
    A.fill("#text","")
    # policy free + mute
    A.click('#seg [data-go=settings]');A.check("input[name=policy][value=free]");
    A.click("#apply")
    A.wait_for_timeout(300);A.click('#seg [data-go=ai]')
    n=A.locator("#ais .ai-item").count();first=A.locator("#ais .ai-item").first;nm=first.locator("b").inner_text()
    first.locator("[data-mute]").click();A.wait_for_function("document.querySelector('#ais [data-mute]').textContent.includes('해제')")
    check("mute toggles in list",True);check("cast chip shows mute","뮤트" in A.locator("#stories .cc[data-ai]").first.inner_text())
    first.locator("[data-mute]").click();A.wait_for_function("!document.querySelector('#ais [data-mute]').textContent.includes('해제')")
    # peek
    for i in range(4):
        A.fill("#text","이야기 계속 "+str(i));A.press("#text","Enter");A.wait_for_timeout(2500)
        if A.locator("#dmbtn.on").count(): break
    A.click("#dmbtn");A.wait_for_selector("#inboxlist .inrow.peek",timeout=8000)
    check("peek row in inbox","⇄" in A.inner_text("#inboxlist .inrow.peek"))
    A.click("#inboxlist .inrow.peek");A.wait_for_selector("#dm:not([hidden])")
    check("peek view readonly shows DM",A.locator("#dmcomposer").is_hidden() and "→" in A.inner_text("#dmlog"),A.inner_text("#dmlog"))
    check("DM text not in public log","[DM @" not in A.inner_text("#log"))
    A.click("#dmback");A.click("#inboxlist .inrow:not(.peek) >> nth=0");check("normal DM restores composer",A.locator("#dmcomposer").is_visible())
    check("no page errors",not errs,errs)
    b.close()
print(sum(res),"/",len(res))
