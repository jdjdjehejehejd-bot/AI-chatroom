const {spawn}=require('child_process'),fs=require('fs'),os=require('os'),path=require('path');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aichat-ui-'));const out=fs.openSync('growth_server.log','w');
spawn('node',['server.js'],{cwd:require('path').resolve(__dirname,'../..'),stdio:['ignore',out,out],env:Object.assign({},process.env,{PORT:'3313',DATA_DIR:dir,SESSION_SECRET:'g5',DEMO_DELAY_MS:'30',EMAIL_DEV_LOG:'1',MEMORY_EVERY:'4',ALLOW_DEV_PLAN:'1'})});
