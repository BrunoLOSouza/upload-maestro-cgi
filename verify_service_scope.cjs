const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),ts=require('typescript'),XLSX=require('xlsx');
(async()=>{
const root=path.resolve(process.argv[2]||'.');
const data=name=>JSON.parse(fs.readFileSync(path.join(root,'src/assets/data',name+'.json'),'utf8'));
function load(file,extra={}){
 const module={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,experimentalDecorators:true}}).outputText;
 const req=name=>extra[name]||(name==='@angular/core'?{Injectable:()=>x=>x,Component:()=>x=>x,HostListener:()=>()=>{}}:{});
 new Function('require','module','exports',code)(req,module,module.exports);return module.exports;
}
const {SlaService}=load('src/app/services/sla.service.ts'),{AppComponent}=load('src/app/app.component.ts');
const app=new AppComponent({},new SlaService(),{check:()=>[]},{formatDateBR:date=>date.split('-').reverse().join('/'),formatHoraAMPM:()=> '12:00:00 PM'});
app.config=data('config');app.servicos=data('servicos');app.supervisores=data('supervisores');app.colaboradores=data('colaboradores');
app.slaProgramado=data('sla_malha_programada');app.slaManual=data('sla_malha_manual');app.cias={};
for(const u of app.config.unidades)for(const file of u.arquivos)app.cias[file]=data(file.replace('.json',''));
const normalize=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').toUpperCase().trim();
function context(unit,base,classification){
 app.selCiaId=unit.id;app.onCiaChange();app.selBaseVal=base;app.onBaseChange();
 app.selBaseDestVal='GRU';app.inputBaseDestVal='GRU';app.onInputBaseDest();app.selClassifVal=classification;app.onClassifChange();
 app.inputNumberVal='1234';app.inputDataVal='2026-11-17';app.inputHoraVal='12:00';
}
const downloads=path.join(process.env.USERPROFILE||'C:/Users/brunosouza.7','Downloads');
const workbookName=fs.readdirSync(downloads).find(n=>n.startsWith('SLA ')&&n.endsWith('.xlsx'));
assert.ok(workbookName,'Planilha de referência SLA não encontrada');
const workbook=XLSX.readFile(path.join(downloads,workbookName));const rows=XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
let audited=0,rules=0;
for(const row of rows.filter(r=>r.Ativo==='SIM')){
 const unit=app.config.unidades.find(u=>normalize(u.label)===normalize(row['Unidade de gestão / Cliente']));
 if(!unit)continue;
 context(unit,row.Base,row.Atendimento);
 const expected=app.servicos.filter(s=>row[s.label]!==undefined&&row[s.label]!==null&&row[s.label]!=='').map(s=>s.label).sort();
 assert.deepEqual(app.availableServices.map(s=>s.label).sort(),expected,`${unit.id}/${row.Base}/${row.Atendimento}`);
 assert.equal(app.serviceCatalog.length,app.servicos.length);
 assert.equal(app.extraServices.length,app.servicos.length-expected.length);
 for(const label of expected){
  const svc=app.servicos.find(s=>s.label===label);app.addServicoItem(svc.label,app.colaboradores[0]);
  const selected=app.selectedServices.at(-1),minutes=Math.round(Math.abs(Number(String(row[label]).replace('*',''))));
  assert.equal(selected.extra,false);assert.equal(selected.slaContratual,minutes);
  assert.equal(selected.slaUpload,row['SLA + ou -']==='+'?minutes:-minutes);
  assert.equal(selected.manualInput,typeof row[label]==='string'&&row[label].includes('*'));
  rules++;
 }
 assert.equal(app.canAddStandardService,false);audited++;
}
const gol=app.config.unidades.find(u=>u.id==='gol');context(gol,'JPA','INTERNACIONAL');
const expected=['Controle de Acesso Porta 1','Controle de Acesso Rampa 1','Triagem Bagagens 1'];
assert.deepEqual(app.availableServices.map(s=>s.label).sort(),expected);
app.addServicoItem();let standard=app.selectedServices[0];assert.deepEqual(app.serviceOptions(standard).map(s=>s.label).sort(),expected);
standard.label=expected[0];standard.apac=app.colaboradores[0];app.onServiceSelectChange(standard);assert.equal(standard.slaUpload,-180);
app.addServicoItem(expected[1],app.colaboradores[0]);app.addServicoItem(expected[2],app.colaboradores[0]);assert.equal(app.selectedServices[2].slaUpload,-240);
assert.equal(app.canAddStandardService,false);assert.equal(app.isAddRowValid,true,app.addRowHint);
app.addExtraServicoItem();const extra=app.selectedServices.at(-1);assert.equal(extra.extra,true);
assert.ok(app.serviceOptions(extra).every(s=>!expected.includes(s.label)));
extra.label='Controle de Acesso Rampa 2';extra.apac=app.colaboradores[0];app.onServiceSelectChange(extra);
assert.equal(extra.manualInput,true);assert.equal(extra.manualMinutes,null);assert.equal(app.isAddRowValid,false);
for(const invalid of [null,1.5,NaN]){app.updateManualSla(extra,invalid);assert.equal(app.isAddRowValid,false);}
for(const value of [-240,0,240]){app.updateManualSla(extra,value);assert.equal(app.isAddRowValid,true,app.addRowHint);assert.equal(extra.slaUpload,value);assert.equal(extra.slaContratual,Math.abs(value));}
app.updateManualSla(extra,-135);
const label=extra.label;extra.label=expected[0];assert.equal(app.isAddRowValid,false);extra.label=label;
app.selectedServices.splice(0,1);assert.equal(app.serviceOptions(extra).some(s=>s.label===expected[0]),false);assert.equal(app.canAddStandardService,true);
app.addServicoItem(expected[0],app.colaboradores[0]);
const columns=data('colunas');app.fixedCols=columns.fixed_cols;app.svcCols=app.servicos.flatMap(s=>[s.label,s.responsible_column]).filter(Boolean);
app.recomputeDuplicates=()=>{};app.showToast=()=>{};
await app.addRow();assert.equal(app.rows.length,0);
assert.deepEqual(app.serviceReview.additional,['Controle de Acesso Rampa 2']);
await app.confirmServiceReview();assert.equal(app.rows.length,1);const row=app.rows[0];
assert.equal(row['Controle de Acesso Rampa 2'],-135);assert.equal(row['_contratual_Controle de Acesso Rampa 2'],135);
context(gol,'JPA','INTERNACIONAL');app.cloneRow(0);const restored=app.selectedServices.find(s=>s.label===label);
assert.equal(restored.extra,true);assert.equal(restored.manualMinutes,-135);assert.equal(restored.slaUpload,-135);assert.equal(app.isAddRowValid,true,app.addRowHint);
app.selClassifVal='VARREDURA';app.onClassifChange();
assert.ok(app.selectedServices.filter(s=>!s.extra).every(s=>app.availableServices.some(def=>def.label===s.label)));
assert.ok(app.selectedServices.some(s=>s.label===label&&s.extra));
let exported;const {ExcelService}=load('src/app/services/excel.service.ts',{xlsx:{...XLSX,writeFile:wb=>{exported=wb;}}});
new ExcelService().exportExcel([row],columns.upload_cols,['TÍTULO',...app.servicos.map(s=>s.label)]);
assert.deepEqual(XLSX.utils.sheet_to_json(exported.Sheets['UPLOAD MAESTRO'],{header:1})[0],columns.upload_cols);
assert.ok(XLSX.utils.sheet_to_json(exported.Sheets['UPLOAD MAESTRO'])[0][label]===-135);
console.log(`OK: ${audited} atendimentos e ${rules} SLAs conferidos na planilha; JPA com apenas 3 postos; extras separados, SLA manual assinado, duplicação e exportação preservados.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
