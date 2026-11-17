const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),ts=require('typescript');
(async()=>{
 const root=path.resolve(process.argv[2]||'.');
 const data=name=>JSON.parse(fs.readFileSync(path.join(root,'src/assets/data',name+'.json'),'utf8'));
 function load(file){const module={exports:{}};const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,experimentalDecorators:true}}).outputText;new Function('require','module','exports',code)(name=>name==='@angular/core'?{Injectable:()=>x=>x,Component:()=>x=>x,HostListener:()=>()=>{}}:{},module,module.exports);return module.exports;}
 const {AppComponent}=load('src/app/app.component.ts'),{SlaService}=load('src/app/services/sla.service.ts');
 const porta='Controle de Acesso Porta 1',rampa='Controle de Acesso Rampa 1',triagem='Triagem Bagagens 1',extra='Controle de Acesso Rampa 2';
 function make(labels=[porta,rampa,triagem],unit='gol',base='JPA',classification='INTERNACIONAL',dest='GRU'){
  const app=new AppComponent({},new SlaService(),{},{formatDateBR:()=> '17/11/2026',formatHoraAMPM:()=> '12:00:00 PM'});
  app.config=data('config');app.servicos=data('servicos');app.supervisores=data('supervisores');app.colaboradores=data('colaboradores');app.slaProgramado=data('sla_malha_programada');app.slaManual=data('sla_malha_manual');app.cias={};
  for(const u of app.config.unidades)for(const file of u.arquivos)app.cias[file]=data(file.replace('.json',''));
  app.selCiaId=unit;app.onCiaChange();app.selBaseVal=base;app.onBaseChange();app.selBaseDestVal=dest;app.inputBaseDestVal=dest;app.onInputBaseDest();app.selClassifVal=classification;app.onClassifChange();app.inputNumberVal='1234';app.inputDataVal='2026-11-17';app.inputHoraVal='12:00';
  app.svcCols=app.servicos.flatMap(s=>[s.label,s.responsible_column]).filter(Boolean);app.recomputeDuplicates=()=>{};app.showToast=()=>{};
  for(const label of labels){app.addServicoItem(label,app.colaboradores[0]);if(app.selectedServices.at(-1).extra)app.updateManualSla(app.selectedServices.at(-1),-135);}
  assert.equal(app.isAddRowValid,true,app.addRowHint);return app;
 }
 let app=make();await app.addRow();assert.equal(app.rows.length,1);assert.equal(app.serviceReview,null);
 app=make([rampa]);const draft=JSON.stringify(app.selectedServices);await app.addRow();assert.equal(app.rows.length,0);assert.deepEqual(app.serviceReview.additional,[]);assert.deepEqual(app.serviceReview.missing.sort(),[porta,triagem].sort());app.cancelServiceReview();assert.equal(app.rows.length,0);assert.equal(JSON.stringify(app.selectedServices),draft);await app.confirmServiceReview();assert.equal(app.rows.length,0);
 await app.addRow();await app.confirmServiceReview();assert.equal(app.rows.length,1);assert.equal(app.rows[0][rampa],-180);assert.equal(app.rows[0][porta],'');assert.equal(app.serviceReview,null);
 app=make([porta,rampa,triagem,extra]);await app.addRow();assert.equal(app.rows.length,0);assert.deepEqual(app.serviceReview.additional,[extra]);assert.deepEqual(app.serviceReview.missing,[]);await app.confirmServiceReview();assert.equal(app.rows.length,1);assert.equal(app.rows[0][extra],-135);await app.confirmServiceReview();assert.equal(app.rows.length,1,'Duplo OK repetiu o voo');
 app=make([rampa,extra]);await app.addRow();assert.deepEqual(app.serviceReview.additional,[extra]);assert.deepEqual(app.serviceReview.missing.sort(),[porta,triagem].sort());app.inputNumberVal='5678';await app.confirmServiceReview();assert.equal(app.rows.length,0,'Confirmação antiga aceitou dados alterados');assert.equal(app.serviceReview,null);await app.addRow();app.liveClock='13:00:00';await app.confirmServiceReview();assert.equal(app.rows.length,1);assert.ok(app.rows[0]['TÍTULO'].includes('5678'));
 app=make([rampa,extra]);await app.addRow();app.updateManualSla(app.selectedServices.at(-1),null);await app.confirmServiceReview();assert.equal(app.rows.length,0,'SLA inválido confirmado');assert.equal(app.serviceReview,null);
 app=make([rampa]);await app.addRow();app.selClassifVal='VARREDURA';app.onClassifChange();assert.equal(app.serviceReview,null);await app.confirmServiceReview();assert.equal(app.rows.length,0);
 app=make([rampa]);app.selectedServices[0].apac='';await app.addRow();assert.equal(app.serviceReview,null);assert.equal(app.rows.length,0);
 const copa=[rampa,extra,porta,triagem,'Inspeção Cargas'];
 app=make(copa,'copa','GRU','INTERNACIONAL RON PARTIDA','ASU');await app.addRow();assert.equal(app.rows.length,1);assert.equal(app.serviceReview,null,'Os cinco postos da imagem estão previstos');
 app=make(copa.filter(name=>name!=='Inspeção Cargas'),'copa','GRU','INTERNACIONAL RON PARTIDA','ASU');await app.addRow();assert.equal(app.rows.length,0);assert.deepEqual(app.serviceReview.missing,['Inspeção Cargas']);assert.deepEqual(app.serviceReview.additional,[]);
 app=make([...copa,'Profiler 1'],'copa','GRU','INTERNACIONAL RON PARTIDA','ASU');await app.addRow();assert.equal(app.rows.length,0);assert.deepEqual(app.serviceReview.additional,['Profiler 1']);assert.deepEqual(app.serviceReview.missing,[]);
 console.log('OK: postos completos sem alerta; ausentes/extras/simultâneos exigem OK; cancelamento preserva o formulário; sem duplo lançamento ou aprovação de dados alterados/inválidos.');
})().catch(error=>{console.error(error);process.exitCode=1;});
