const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),ts=require('typescript'),XLSX=require('xlsx');
(async()=>{
 const root=path.resolve(process.argv[2]||'.'),data=n=>JSON.parse(fs.readFileSync(path.join(root,'src/assets/data',n+'.json'),'utf8'));
 function load(file,extra={}){const module={exports:{}};const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,experimentalDecorators:true}}).outputText;new Function('require','module','exports',code)(n=>extra[n]||(n==='@angular/core'?{Injectable:()=>x=>x,Component:()=>x=>x,HostListener:()=>()=>{}}:{}),module,module.exports);return module.exports;}
 const {AppComponent}=load('src/app/app.component.ts'),{SlaService}=load('src/app/services/sla.service.ts'),sla=new SlaService();
 for(let h=0;h<24;h++)for(let m=0;m<60;m++){const time=String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');assert.equal(sla.isFiveMinuteTime(time),m%5===0,time);assert.equal(sla.isBeforeNoon(time),h<12&&m%5===0,time);}
 for(const time of ['','24:00','10:00:01','10:00:05','0:00','10:60'])assert.equal(sla.isFiveMinuteTime(time),false,time);
 assert.equal(sla.isFiveMinuteTime('10:05:00'),true);
 let exported=0;
 function appFor(time='10:00',classification='INTERNACIONAL'){
  const app=new AppComponent({},sla,{},{formatDateBR:()=> '17/11/2026',formatHoraAMPM:()=> '10:00:00 AM',exportExcel:()=>{exported++;}});
  app.config=data('config');app.servicos=data('servicos');app.supervisores=data('supervisores');app.colaboradores=data('colaboradores');app.slaProgramado=data('sla_malha_programada');app.slaManual=data('sla_malha_manual');app.cias={};
  for(const u of app.config.unidades)for(const file of u.arquivos)app.cias[file]=data(file.replace('.json',''));
  app.selCiaId='gol';app.onCiaChange();app.selBaseVal='GRU';app.onBaseChange();app.inputBaseDestVal='ASU';app.selBaseDestVal='ASU';app.onInputBaseDest();app.selClassifVal=classification;app.onClassifChange();app.inputNumberVal='1234';app.inputDataVal='2026-11-17';app.inputHoraVal=time;app.onReferenceTimeChange();
  app.svcCols=app.servicos.flatMap(s=>[s.label,'Responsavel '+s.label]);app.allCols=data('colunas').upload_cols;app.recomputeDuplicates=()=>{};app.showToast=()=>{};return app;
 }
 for(const time of ['00:00','10:00','10:05','11:55']){const app=appFor(time);assert.equal(app.availableServices.length,4);assert.ok(app.availableServices.some(s=>s.label==='TPS 3'));assert.equal(app.extraServices.some(s=>s.label==='TPS 3'),false);}
 for(const time of ['12:00','12:05','23:55','10:02','']){const app=appFor(time);assert.equal(app.availableServices.length,3);assert.equal(app.serviceCatalog.some(s=>s.label==='TPS 3'),false);}
 let app=appFor();for(const s of app.availableServices)app.addServicoItem(s.label,app.colaboradores[0]);const tps=app.selectedServices.find(s=>s.label==='TPS 3');
 assert.equal(tps.slaUpload,-240);assert.equal(tps.slaContratual,240);assert.equal(tps.manualInput,false);assert.equal(app.isAddRowValid,true,app.addRowHint);
 app.updateManualSla(tps,90);assert.equal(tps.slaUpload,-240);
 tps.slaUpload=-90;assert.equal(app.isAddRowValid,false);tps.slaUpload=-240;
 app.inputHoraVal='10:02';app.onReferenceTimeChange();assert.equal(app.inputHoraVal,'10:02');assert.equal(app.isAddRowValid,false);await app.addRow();assert.equal(app.rows.length,0);
 app.inputHoraVal='10:00';app.onReferenceTimeChange();await app.addRow();assert.equal(app.rows.length,1);assert.equal(app.rows[0]['TPS 3'],-240);assert.equal(app.rows[0]['_contratual_TPS 3'],240);
 assert.deepEqual(app.exportSchemaIssues,[]);app.exportExcel();assert.equal(exported,1,'TPS 3 deve exportar com cabeçalhos confirmados');
 let wb;const {ExcelService}=load('src/app/services/excel.service.ts',{xlsx:{...XLSX,writeFile:value=>{wb=value;}}});
 new ExcelService().exportExcel(app.rows,app.allCols,['TÍTULO','TPS 3']);
 assert.equal(wb.Sheets['UPLOAD MAESTRO'][XLSX.utils.encode_cell({r:1,c:app.allCols.indexOf('TPS 3')})].v,-240);
 assert.equal(wb.Sheets['UPLOAD MAESTRO'][XLSX.utils.encode_cell({r:1,c:app.allCols.indexOf('Responsavel TPS 3')})].v,app.colaboradores[0]);
 assert.throws(()=>new ExcelService().exportExcel(app.rows,app.allCols.filter(c=>c!=='TPS 3'),['TÍTULO','TPS 3']),/TPS 3/);
 app=appFor('11:55');for(const s of app.availableServices)app.addServicoItem(s.label,app.colaboradores[0]);const apacs=app.selectedServices.filter(s=>s.label!=='TPS 3').map(s=>s.apac);app.inputHoraVal='12:00';app.onReferenceTimeChange();assert.equal(app.selectedServices.length,3);assert.deepEqual(app.selectedServices.map(s=>s.apac),apacs);await app.addRow();assert.equal(app.serviceReview,null);assert.equal(app.rows.length,1);
 app=appFor();for(const s of app.availableServices.filter(s=>s.label!=='TPS 3'))app.addServicoItem(s.label,app.colaboradores[0]);await app.addRow();assert.deepEqual(app.serviceReview.missing,['TPS 3']);app.inputHoraVal='12:00';app.onReferenceTimeChange();assert.equal(app.serviceReview,null);await app.addRow();assert.equal(app.rows.length,1);
 assert.equal(appFor('10:00','VARREDURA').serviceCatalog.some(s=>s.label==='TPS 3'),false);
 console.log('OK: 1.440 horários auditados; TPS 3 fixo -240/240 antes das 12h; 12:00 excluído; minutos fora de 5 bloqueados sem arredondar; confirmação e proteção de exportação preservadas.');
})().catch(error=>{console.error(error);process.exitCode=1;});
