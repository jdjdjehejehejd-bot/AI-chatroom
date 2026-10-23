import sys,json
from playwright.sync_api import sync_playwright
B=sys.argv[1]; res=[]
def check(n,c,i=""): res.append(bool(c)); print(("PASS " if c else "FAIL ")+n+(" | "+str(i) if (not c and i) else ""))
def rows(pg): return pg.eval_on_selector_all("#roomlist .room", "els=>els.map(e=>[e.querySelector('.av').textContent,e.querySelector('.nm b').textContent,e.querySelector('.av').style.getPropertyValue('--av')])")
with sync_playwright() as p:
    b=p.chromium.launch(args=["--no-sandbox"]); errs=[]
    seed=[{"id":"abc123","title":"방 abc123","ts":1},{"id":"def456","title":"Room def456","ts":2},{"id":"ghi789","title":"ルーム ghi789","ts":3},{"id":"mk1x","title":"Make 방","ts":4},{"id":"cu1","title":"추리 게임","ts":5},{"id":"cu2","title":"🎲 Game Night","ts":6},{"id":"cu3","title":"Café","ts":7}]
    out={}
    for lang,loc in [("ko","ko-KR"),("en","en-US"),("ja","ja-JP"),("zh","zh-CN"),("es","es-ES")]:
        ctx=b.new_context(locale=loc,bypass_csp=True,viewport={"width":1280,"height":800}); ctx.add_init_script("try{localStorage.setItem('rooms',%s)}catch(e){}"%json.dumps(json.dumps(seed)))
        pg=ctx.new_page(); pg.on("pageerror",lambda e:errs.append(str(e))); pg.goto(B+"/"); pg.wait_for_selector("#roomlist .room"); r=rows(pg); out[lang]=r
        icons=[x[0] for x in r]
        check(f"{lang}: auto-title icons use room code / mode letter", icons[:3]==["G","D","A"] or sorted(icons[:3])==["A","D","G"], icons)
        check(f"{lang}: icon for 'Make 방' is M", [x for x in r if x[1].startswith(("Make"))][0][0]=="M", r)
        check(f"{lang}: custom names untouched & icon = first char typed", ["추" if False else None] and [x for x in r if x[1]=="추리 게임"][0][0]=="추" and [x for x in r if x[1]=="🎲 Game Night"][0][0]=="🎲" and [x for x in r if x[1]=="Café"][0][0]=="C", r)
        ctx.close()
    base=[ (x[0],x[2]) for x in out["ko"]]
    check("icon letters and colors identical in every language", all([(x[0],x[2]) for x in out[l]]==base for l in out), {l:[(x[0]) for x in out[l]] for l in out})
    check("auto-title text follows UI language", [x[1] for x in out["en"]][:2]==["Room ghi789","Room def456"] or "Room abc123" in [x[1] for x in out["en"]], [x[1] for x in out["en"]])
    check("no page errors", not errs, errs)
    b.close()
print(sum(res),"/",len(res))
