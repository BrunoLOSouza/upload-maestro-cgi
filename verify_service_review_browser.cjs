const assert=require('node:assert/strict'),WebSocket=require('ws');
(async()=>{
 const base=process.env.OPERA_BROWSER_URL||'http://127.0.0.1:4200/',port=process.env.OPERA_CDP_PORT||'9223';
 const tabs=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json(),socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
 await new Promise(resolve=>socket.once('open',resolve));let id=0;const jobs=new Map();
 socket.on('message',raw=>{const msg=JSON.parse(raw),job=jobs.get(msg.id);if(job){jobs.delete(msg.id);msg.error?job.reject(new Error('CDP failed')):job.resolve(msg.result);}});
 const call=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;jobs.set(key,{resolve,reject});socket.send(JSON.stringify({id:key,method,params}));});
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const poll=async expression=>{for(let i=0;i<200;i++){try{if(await evaluate(expression))return;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('Timeout: '+expression);};
 const app=`ng.getComponent(document.querySelector('app-root'))`;
 const rampa='Controle de Acesso Rampa 1',porta='Controle de Acesso Porta 1',triagem='Triagem Bagagens 1',extra='Controle de Acesso Rampa 2';
 const setup=async labels=>{
  await evaluate(`(()=>{const app=${app},original=app.toggleTheme;app.toggleTheme=()=>{app.rows=[];app.duplicates=[];app.selCiaId='gol';app.onCiaChange();app.selBaseVal='JPA';app.onBaseChange();app.selBaseDestVal='GRU';app.inputBaseDestVal='GRU';app.onInputBaseDest();app.selClassifVal='INTERNACIONAL';app.onClassifChange();app.inputNumberVal='1234';app.inputDataVal='2026-11-17';app.inputHoraVal='12:00';for(const name of ${JSON.stringify(labels)}){app.addServicoItem(name,app.colaboradores[0]);if(name===${JSON.stringify(extra)})app.updateManualSla(app.selectedServices.at(-1),-135);}};document.querySelector('.header-actions .btn-tool:nth-child(2)').click();app.toggleTheme=original;})()`);
  assert.equal(await evaluate(`${app}.isAddRowValid`),true);
  await evaluate(`document.querySelector('.btn-add-row').click()`);
 };
 try{
  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await call('Page.navigate',{url:base});
  await poll(`!!(window.ng && document.querySelector('app-root') && !${app}.isLoading && !${app}.isRestoringReport)`);
  if(await evaluate(`${app}.apiAvailable || false`))await require('./browser-test-login.cjs')(evaluate);
  await setup([rampa,extra]);await poll(`!!document.querySelector('[role="alertdialog"]')`);
  assert.equal(await evaluate(`${app}.rows.length`),0);
  assert.equal(await evaluate(`document.querySelector('.app').hasAttribute('inert')`),true);
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.review-additional li')].map(e=>e.textContent)`),[extra]);
  assert.deepEqual((await evaluate(`[...document.querySelectorAll('.review-missing li')].map(e=>e.textContent)`)).sort(),[porta,triagem].sort());
  assert.equal(await evaluate(`document.activeElement.classList.contains('review-cancel')`),true);
  for(const key of ['Tab','Tab'])await call('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,windowsVirtualKeyCode:9});
  assert.equal(await evaluate(`document.activeElement.classList.contains('review-cancel')`),true,'Tab escapou do modal');
  await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await poll(`!document.querySelector('[role="alertdialog"]')`);assert.equal(await evaluate(`${app}.rows.length`),0);assert.equal(await evaluate(`${app}.selectedServices.length`),2);
  await evaluate(`document.querySelector('.btn-add-row').click()`);await poll(`!!document.querySelector('.review-confirm')`);
  await evaluate(`document.querySelector('.review-confirm').click()`);await poll(`${app}.rows.length===1`);
  assert.equal(await evaluate(`${app}.rows[0][${JSON.stringify(extra)}]`),-135);assert.equal(await evaluate(`!!document.querySelector('[role="alertdialog"]')`),false);
  await setup([porta,rampa,triagem]);await poll(`${app}.rows.length===1`);assert.equal(await evaluate(`!!document.querySelector('[role="alertdialog"]')`),false);
  await setup([rampa]);await poll(`!!document.querySelector('.review-missing')`);assert.equal(await evaluate(`!!document.querySelector('.review-additional')`),false);await evaluate(`document.querySelector('.review-cancel').click()`);
  await setup([porta,rampa,triagem,extra]);await poll(`!!document.querySelector('.review-additional')`);assert.equal(await evaluate(`!!document.querySelector('.review-missing')`),false);await evaluate(`document.querySelector('.review-cancel').click()`);
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await setup([rampa,extra]);await poll(`!!document.querySelector('.review-confirm')`);
  assert.equal(await evaluate(`document.querySelector('.review-dialog').scrollWidth<=document.querySelector('.review-dialog').clientWidth`),true);
  assert.equal(await evaluate(`(()=>{const b=document.querySelector('.review-confirm'),r=b.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===b;})()`),true,'OK fora da tela ou sobreposto');
  await evaluate(`document.querySelector('.review-cancel').click()`);
  console.log('OK: alertas extras/ausentes/simultâneos; inclusão só com OK; cancelar/Escape preservam o formulário; foco contido; fluxo sem diferenças direto; celular sem cortes. '+base);
 }finally{socket.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
