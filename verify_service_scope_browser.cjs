const assert=require('node:assert/strict'),WebSocket=require('ws');
(async()=>{
 const base=process.env.OPERA_BROWSER_URL||'http://127.0.0.1:4200/';
 const port=process.env.OPERA_CDP_PORT||'9223';
 const tabs=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
 const socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
 await new Promise(resolve=>socket.once('open',resolve));let id=0;const jobs=new Map();
 socket.on('message',raw=>{const msg=JSON.parse(raw),job=jobs.get(msg.id);if(job){jobs.delete(msg.id);msg.error?job.reject(new Error(JSON.stringify(msg.error))):job.resolve(msg.result);}});
 const call=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;jobs.set(key,{resolve,reject});socket.send(JSON.stringify({id:key,method,params}));});
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const poll=async expression=>{for(let i=0;i<200;i++){try{if(await evaluate(expression))return;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('Timeout: '+expression);};
 const app=`ng.getComponent(document.querySelector('app-root'))`;
 try{
  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1080,deviceScaleFactor:1,mobile:false});
  await call('Page.navigate',{url:base});
  await poll(`!!(window.ng && document.querySelector('app-root') && !${app}.isLoading && !${app}.isRestoringReport)`);
  if(await evaluate(`${app}.apiAvailable || false`))await require('./browser-test-login.cjs')(evaluate);
  await evaluate(`(()=>{const app=${app},original=app.toggleTheme;app.toggleTheme=()=>{app.selCiaId='gol';app.onCiaChange();app.selBaseVal='JPA';app.onBaseChange();app.inputBaseDestVal='GRU';app.onInputBaseDest();app.selClassifVal='INTERNACIONAL';app.onClassifChange();app.inputNumberVal='1234';app.inputDataVal='2026-11-17';app.inputHoraVal='12:00';};document.querySelector('.header-actions .btn-tool:nth-child(2)').click();app.toggleTheme=original;})()`);
  const addStandard=`document.querySelector('.btn-add-svc:not(.btn-add-extra-svc)')`;
  await evaluate(`${addStandard}.click()`);
  const expected=['Controle de Acesso Porta 1','Controle de Acesso Rampa 1','Triagem Bagagens 1'];
  const options=await evaluate(`[...document.querySelector('.standard-services-list select').options].map(o=>o.value).filter(Boolean)`);
  assert.deepEqual(options.sort(),expected);
  await evaluate(`(()=>{const select=document.querySelector('.standard-services-list select');select.value='Controle de Acesso Porta 1';select.dispatchEvent(new Event('change',{bubbles:true}));const app=${app};app.selectedServices[0].apac=app.colaboradores[0];})()`);
  await evaluate(`document.querySelector('.btn-add-extra-svc').click()`);
  await poll(`!!document.querySelector('.extra-services-list select')`);
  const extraOptions=await evaluate(`[...document.querySelector('.extra-services-list select').options].map(o=>o.value).filter(Boolean)`);
  assert.ok(extraOptions.includes('Controle de Acesso Rampa 2'));
  assert.ok(expected.every(label=>!extraOptions.includes(label)));
  await evaluate(`(()=>{const select=document.querySelector('.extra-services-list select');select.value='Controle de Acesso Rampa 2';select.dispatchEvent(new Event('change',{bubbles:true}));const app=${app};app.selectedServices.find(s=>s.extra).apac=app.colaboradores[0];})()`);
  await poll(`!!document.querySelector('.extra-services-list .manual-sla-field input')`);
  assert.equal(await evaluate(`document.querySelector('.btn-add-row').disabled`),true);
  for(const value of [-240,0,240]){
   await evaluate(`(()=>{const input=document.querySelector('.extra-services-list .manual-sla-field input');input.value='${value}';input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
   await poll(`!document.querySelector('.btn-add-row').disabled`);
   assert.equal(await evaluate(`${app}.selectedServices.find(s=>s.extra).slaUpload`),value);
  }
  await evaluate(`${addStandard}.click()`);
  const second=await evaluate(`[...document.querySelectorAll('.standard-services-list select')[1].options].map(o=>o.value).filter(Boolean)`);
  assert.equal(second.includes('Controle de Acesso Porta 1'),false);
  await evaluate(`document.querySelector('.standard-services-list .btn-remove-svc').click()`);
  assert.equal(await evaluate(`${app}.selectedServices.filter(s=>s.extra).length`),1);
  assert.equal(await evaluate(`document.querySelectorAll('.extra-services-list select').length`),1);
  await evaluate(`document.querySelector('.extra-services-list .btn-remove-svc').click()`);
  assert.equal(await evaluate(`${app}.selectedServices.some(s=>s.extra)`),false);
  assert.equal(await evaluate(`document.querySelectorAll('.extra-services-list select').length`),0);
  console.log('OK: seletor principal com 3 postos; extras separados; SLA obrigatório com sinais; sem repetição; remoção usa o índice correto. '+base);
 }finally{socket.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
