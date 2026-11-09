// Integration check against the development server and a dedicated Chrome CDP port.
const WebSocket = require('ws');
const assert = require('node:assert/strict');
(async () => {
  const tabs = await (await fetch('http://127.0.0.1:9223/json/list')).json();
  const socket = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => socket.once('open', resolve));
  let id = 0;
  const pending = new Map();
  socket.on('message', raw => {
    const msg = JSON.parse(raw);
    if (!pending.has(msg.id)) return;
    const {resolve, reject} = pending.get(msg.id); pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const key = ++id; pending.set(key, {resolve, reject}); socket.send(JSON.stringify({id:key, method, params}));
  });
  const evaluate = async expression => {
    const result = await call('Runtime.evaluate', {expression, awaitPromise:true, returnByValue:true});
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  try {
    await call('Page.navigate', {url:'http://127.0.0.1:4200/'});
    let ready = false;
    for (let i = 0; i < 100; i++) {
      ready = await evaluate(`!!(window.ng && document.querySelector('app-root') && !ng.getComponent(document.querySelector('app-root')).isLoading)`);
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, 'Aplicacao nao inicializou');
    const result = await evaluate(`(async () => {
      const app=ng.getComponent(document.querySelector('app-root'));
      const tick=()=>new Promise(resolve=>setTimeout(resolve,30));
      const check=(condition,message)=>{if(!condition)throw new Error(message);};
      let basesChecked=0;
      for(const unit of app.config.unidades){
        const bases=[...new Set(unit.arquivos.flatMap(file=>app.cias[file].rotas.map(r=>r.base_atend)))];
        for(const base of bases){
          const originalToggle=app.toggleTheme;
          app.toggleTheme=()=>{app.selCiaId=unit.id;app.onCiaChange();app.selBaseVal=base;app.onBaseChange();};
          document.querySelector('.header-actions .btn-tool:nth-child(2)').click(); app.toggleTheme=originalToggle; await tick();
          const expected=[...new Set(app.currentCiaData.rotas.filter(r=>r.base_atend===base).map(r=>r.responsavel).filter(Boolean))];
          const select=[...document.querySelectorAll('select')].find(el=>el.previousElementSibling?.textContent.includes('Supervisor'));
          check(!!select,'Seletor de supervisor ausente');
          check(JSON.stringify([...select.options].map(o=>o.value).filter(Boolean))===JSON.stringify(expected),'Lista de outra base: '+unit.id+'/'+base);
          if(expected.length===1) {
            check(app.selSupervisorName===expected[0] && select.value===expected[0],'Supervisor nao preenchido: '+base);
            const link=app.supervisores.find(s=>s.responsavel===expected[0]).unidades.find(u=>u.unidade===unit.label);
            check(app.autoSetorText===link.setor,'Setor de outra unidade: '+unit.id+'/'+base);
          }
          else check(select.disabled && !app.isAddRowValid,'Cadastro pendente nao bloqueado: '+base);
          basesChecked++;
        }
      }
      const manual=Object.entries(app.slaProgramado.chaves).filter(([,rule])=>rule.manual_input);
      manual.push(['GOL LINHAS AÉREAS - VARREDURA BR|AJU|*|VARREDURA|Controle de Acesso Rampa 2', {}]);
      app.githubService.ensureMalhaMonth=async()=>null;
      const cases=[];
      const blocked=[];
      for(const [key,rule] of manual){
        const [unit,base,,classification,service]=key.split('|');
        // Initialize inside Angular's event zone so dynamically created inputs use normal change detection.
        const originalToggle=app.toggleTheme;
        app.toggleTheme=()=>{
        app.selCiaId=app.config.unidades.find(u=>u.label.trim().toUpperCase()===unit).id;
        app.onCiaChange(); app.selBaseVal=base; app.onBaseChange();
        app.inputBaseDestVal='GRU'; app.onInputBaseDest();
        app.selClassifVal=classification; app.onClassifChange();
        app.inputNumberVal='1234'; app.inputDataVal='2026-11-06'; app.inputHoraVal='12:00';
        if(app.availableSupervisores.length) {
          app.selSupervisorName=app.availableSupervisores[0].responsavel; app.onSupervisorChange();
        }
        app.addServicoItem(service,app.colaboradores[0]);
        };
        document.querySelector('.header-actions .btn-tool:nth-child(2)').click();
        app.toggleTheme=originalToggle; await tick();
        const button=document.querySelector('.btn-add-row');
        if(!app.availableSupervisores.length){
          check(button.disabled,'Base sem cadastro liberou lancamento: '+key);
          blocked.push(key); continue;
        }
        check(button.disabled,'Botao deveria bloquear SLA vazio: '+key);
        const input=document.querySelector('.manual-sla-field input');
        check(!!input,'Campo manual ausente: '+key);
        for(const invalid of ['', '1.5']) {
          input.value=invalid; input.dispatchEvent(new Event('input',{bubbles:true})); await tick();
          check(button.disabled,'Botao aceitou SLA invalido '+invalid+': '+key);
        }
        for(const value of [240,-240,0]) {
          input.value=String(value); input.dispatchEvent(new Event('input',{bubbles:true})); await tick();
          check(!button.disabled,'Botao bloqueou valor valido '+value+': '+key);
          check(app.selectedServices[0].slaUpload===value,'Sinal alterado para '+value+': '+key);
        }
        input.value='-135'; input.dispatchEvent(new Event('input',{bubbles:true})); await tick();
        const svc=app.selectedServices[0];
        check(svc.manualMinutes===-135,'Evento nao atualizou minutos: '+key);
        check(svc.slaUpload===-135,'Sinal ou valor incorreto: '+key);
        check(!button.disabled,'Botao continua bloqueado: '+key+' / '+app.addRowHint);
        button.scrollIntoView({block:'center'}); await tick();
        const bounds=button.getBoundingClientRect();
        check(document.elementFromPoint(bounds.x+bounds.width/2,bounds.y+bounds.height/2)?.closest('.btn-add-row')===button,'Botao sobreposto: '+key);
        const expectedSupervisor=app.selSupervisorName, expectedSetor=app.autoSetorText, expectedUnit=app.currentCiaData.unidade;
        const previous=app.rows.length; button.click(); await tick();
        check(app.rows.length===previous+1,'Clique nao adicionou voo: '+key);
        const row=app.rows[app.rows.length-1];
        check(row['RESPONSÁVEL']===expectedSupervisor && row['SETOR RESPONSÁVEL']===expectedSetor && row['UNIDADE DE GESTÃO']===expectedUnit,'Nome ou setor alterado no lancamento: '+key);
        check(row[service]===-135,'Valor do upload incorreto: '+key);
        check(row['_contratual_'+service]===135,'Valor contratual incorreto: '+key);
        app.cloneRow(app.rows.length-1);
        check(app.selectedServices.find(s=>s.label===service).slaUpload===-135,'Clone alterou sinal manual: '+key);
        cases.push(key); app.rows=[];
      }
      return {tested:cases.length,blocked:blocked.length,basesChecked,cases};
    })()`);
    assert.equal(result.tested+result.blocked, 26);
    assert.ok(result.tested>0);
    console.log(`OK: ${result.basesChecked} combinacoes unidade/base verificadas no seletor; ${result.tested} fluxos manuais testados; ${result.blocked} casos sem cadastro bloqueados; sinal preservado.`);
  } finally { socket.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
