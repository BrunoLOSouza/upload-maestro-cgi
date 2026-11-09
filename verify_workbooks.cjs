const fs = require('fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const XLSX = require('xlsx');
const model = XLSX.readFile(process.argv[2]);
const data = name => JSON.parse(fs.readFileSync(`src/assets/data/${name}.json`, 'utf8'));
const headers = XLSX.utils.sheet_to_json(model.Sheets['UPLOAD MAESTRO'], {header: 1})[0];
assert.deepEqual(data('colunas').upload_cols, headers);
const fixedReference=XLSX.utils.sheet_to_json(model.Sheets['UPLOAD MAESTRO'])[0];
const fixedConfig=data('config').campos_fixos;
for(const [field, configField] of Object.entries({EMPRESA:'EMPRESA',EXECUTOR:'EXECUTOR','CATEGORIA ':'CATEGORIA',PRIORIDADE:'PRIORIDADE',DISCIPLINA:'DISCIPLINA','GRUPO DE SERVIÇO':'GRUPO_SERVICO',SERVIÇO:'SERVICO'})) {
  assert.equal(fixedConfig[configField],fixedReference[field],`Texto fixo diferente: ${field}`);
}
const sourceBase = XLSX.utils.sheet_to_json(model.Sheets.BASE);
assert.deepEqual(data('config').unidades.map(u => u.label), [...new Set(sourceBase.map(r => r['Unidade de Gestão']).filter(label => label && label !== 'AZUL Linhas Aéreas - Varredura BR'))]);
for (const supervisor of data('supervisores')) {
  const expected = sourceBase.filter(r => r['Responsável'] === supervisor.responsavel && r['Unidade de Gestão'] && r['Setor Responsável'])
    .map(r => ({unidade: r['Unidade de Gestão'], setor: r['Setor Responsável']}));
  if(supervisor.responsavel==='Bruna Rafaelle Da Silva')
    expected.push({unidade:'LATAM Linhas Aéreas - Varredura BR',setor:'Operacional COPA Virtual Brasília'});
  assert.deepEqual(supervisor.unidades, expected.filter((e, i) => expected.findIndex(x => x.unidade === e.unidade && x.setor === e.setor) === i));
}
let workbook;
function load(file, extra = {}) {
  const module = {exports: {}};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, experimentalDecorators: true}}).outputText;
  const req = name => extra[name] || (name === '@angular/core' ? {Injectable: () => x => x, Component: () => x => x, HostListener: () => () => {}} : {});
  new Function('require', 'module', 'exports', code)(req, module, module.exports);
  return module.exports;
}
const {ExcelService} = load('src/app/services/excel.service.ts', {xlsx: {...XLSX, writeFile: wb => {workbook = wb;}}});
const rows = [1,2].map(i => ({'TÍTULO': 'BSB_123_GRU_VARREDURA', _dataISO: '2026-11-05', _horaISO: '12:30', '_contratual_Controle de Acesso Rampa 1': i * 90}));
const slaCols = ['TÍTULO', ...data('servicos').map(s => s.label)];
new ExcelService().exportExcel(rows, headers, slaCols);
assert.deepEqual(XLSX.utils.sheet_to_json(workbook.Sheets['UPLOAD MAESTRO'], {header: 1})[0], headers);
assert.equal(workbook.Sheets['SLA contratual'].B1.v, 'SLA CONTRATUAL');
assert.equal(workbook.Sheets['SLA contratual'].C2.v, 90);
assert.equal(workbook.Sheets['SLA contratual'].C3.v, 180);
const {SlaService} = load('src/app/services/sla.service.ts');
const rules = data('sla_malha_programada');
for (const [key, value] of Object.entries(rules.chaves)) {
  const [unit, base, , classification, service] = key.split('|');
  const result = new SlaService().resolveSla(null, rules, unit, base, 'GRU', classification, service);
  assert.equal(result.sla_upload, value.sla_upload);
  assert.equal(!!result.manual_input, !!value.manual_input);
}
const {AppComponent} = load('src/app/app.component.ts');
const app = new AppComponent({}, new SlaService(), {}, {});
app.servicos = data('servicos'); app.colaboradores = data('colaboradores');
const entry = Object.entries(rules.chaves).find(([,rule]) => rule.manual_input);
const [unit, base, , classification, service] = entry[0].split('|');
app.slaProgramado = rules; app.currentCiaData = {unidade:unit, rotas:[], _isOndemand:false};
app.config=data('config'); app.supervisores=data('supervisores');
const selectedUnit=app.config.unidades.find(u => u.label.toUpperCase()===unit);
app.selCiaId=selectedUnit.id; app.currentCiaData.unidade=selectedUnit.label;
app.currentCiaData.rotas=selectedUnit.arquivos.flatMap(f=>data(f.replace('.json','')).rotas);
app.selBaseVal=base; app.selBaseDestVal='GRU'; app.selClassifVal=classification;
app.selSupervisorName=app.currentCiaData.rotas.find(r=>r.base_atend===base).responsavel;
app.onSupervisorChange(); app.inputNumberVal='123'; app.inputDataVal='2026-11-05'; app.inputHoraVal='12:00';
app.addServicoItem(service, app.colaboradores[0]);
assert.equal(app.isAddRowValid, false);
const selected=app.selectedServices[0]; selected.manualMinutes=135; app.updateManualSla(selected);
assert.equal(app.isAddRowValid, true); assert.equal(selected.slaUpload, 135);
assert.equal(selected.slaContratual, 135);
for(const value of [-240,240,0]) {
  app.updateManualSla(selected,value);
  assert.equal(app.isAddRowValid,true);
  assert.equal(selected.slaUpload,value);
  assert.equal(selected.slaContratual,Math.abs(value));
}
app.updateManualSla(selected,null); assert.equal(app.isAddRowValid,false);
app.updateManualSla(selected,-240);
assert.ok(app.availableServices.some(service=>service.label==='Controle de Acesso Rampa 2'));
const validBase=app.selBaseVal;
app.selBaseVal='ZZZ'; assert.equal(app.isAddRowValid,false); app.selBaseVal=validBase;
const allan = app.supervisores.find(s=>s.responsavel==='ALLAN LEVATI');
app.cias={};
for(const u of app.config.unidades) for(const f of u.arquivos) app.cias[f]=data(f.replace('.json',''));
const sourceRules=XLSX.utils.sheet_to_json(model.Sheets['CONSULTA - SLA E POSTOS']);
const sourceNames={
  copa:'COPA Linhas Aéreas - Varredura BR', gol:'GOL Linhas Aéreas - Varredura BR',
  azul:'AZUL Linhas Aéreas - Varredura BR', latam:'LATAM Linhas Aéreas - Varredura BR',
  cabo:'Cabo Verde Airlines - Varredura BR', modern:'MODERN Logistics - Varredura BR', tap:'TAP Linhas Aéreas - Varredura BR'
};
let auditedRules=0, auditedManual=0, blankServices=0;
const slaService=new SlaService();
for(const configUnit of app.config.unidades){
  app.selCiaId=configUnit.id; app.onCiaChange();
  const sourceName=sourceNames[configUnit.id];
  assert.ok(sourceName, `Nome de origem ausente: ${configUnit.id}`);
  const expectedRoutes=sourceRules.filter(r=>r['Unidade de gestão / Cliente']===sourceName && r.Ativo==='SIM');
  for(const row of expectedRoutes) for(const service of app.servicos){
    const expected=row[service.label];
    const key=[configUnit.label.trim().toUpperCase(),row.Base,'*',row.Atendimento,service.label].join('|');
    const actual=rules.chaves[key];
    const resolved=slaService.resolveSla(null,rules,configUnit.label.trim().toUpperCase(),row.Base,'GRU',row.Atendimento,service.label);
    if(expected===undefined || expected===null || expected===''){
      assert.equal(actual,undefined,`SLA inventado: ${key}`);
      assert.equal(resolved.origem,'ausente',key); blankServices++;
    }else{
      const minutes=Math.round(Math.abs(Number(String(expected).replace('*',''))));
      assert.ok(actual,`Regra faltante: ${key}`);
      assert.equal(actual.sla_upload,row['SLA + ou -']==='+'?minutes:-minutes,key);
      assert.equal(actual.sla_contratual,minutes,key);
      assert.equal(actual.manual_input,typeof expected==='string'&&expected.includes('*'),key);
      assert.equal(resolved.sla_upload,actual.sla_upload,key);
      auditedRules++; if(actual.manual_input) auditedManual++;
    }
  }
  assert.deepEqual(app.availableBases,[...new Set(expectedRoutes.map(r=>r.Base))].sort());
  assert.deepEqual(app.currentCiaData.rotas.map(r=>[r.base_atend,r.classificacao]),
    expectedRoutes.map(r=>[r.Base,r.Atendimento]).filter((r,i,all)=>all.findIndex(x=>x[0]===r[0]&&x[1]===r[1])===i));
  assert.equal(app.availableSupervisores.length,0,'Selecao de supervisor antes da base');
  for(const selectedBase of app.availableBases){
    app.selBaseVal=selectedBase; app.onBaseChange();
    const mappedNames=[...new Set(app.currentCiaData.rotas.filter(r=>r.base_atend===selectedBase).map(r=>r.responsavel).filter(Boolean))];
    assert.deepEqual(app.availableSupervisores.map(s=>s.responsavel),mappedNames);
    const expectedNames=[...new Set(expectedRoutes.filter(r=>r.Base===selectedBase).map(r=>r['Responsável']))];
    const overrides={'Bruna Silva':'Bruna Rafaelle Da Silva','Brenda Coelho':'ANDRESSA DOS SANTOS BARBOSA','Marcio Drumond':'Janderson Henrique de Santana','Ana Ferreira':'Janderson Henrique de Santana'};
    for(const sourceName of expectedNames) if(overrides[sourceName]) {
      assert.deepEqual(mappedNames,[overrides[sourceName]],`Substituicao incorreta: ${configUnit.id}/${selectedBase}`);
      assert.equal(app.selSupervisorName,overrides[sourceName]);
      const link=app.supervisores.find(s=>s.responsavel===overrides[sourceName]).unidades.find(u=>u.unidade===configUnit.label);
      assert.equal(app.autoSetorText,link.setor,`Setor incorreto: ${configUnit.id}/${selectedBase}`);
    }
    assert.deepEqual([...new Set(app.currentCiaData.rotas.filter(r=>r.base_atend===selectedBase).map(r=>r.responsavel_origem))],expectedNames);
    const linked=mappedNames.includes(allan.responsavel);
    app.selSupervisorName=allan.responsavel; app.onSupervisorChange();
    assert.equal(app.selSupervisorName,linked?allan.responsavel:'');
    if(linked) assert.equal(app.autoSetorText,allan.unidades.find(u=>u.unidade===configUnit.label).setor);
    if(!linked) assert.equal(app.isAddRowValid,false);
  }
}
assert.equal(auditedRules,Object.keys(rules.chaves).length);
assert.equal(data('import_pending').length,5);
assert.deepEqual(data('supervisores_pendentes'),[]);
console.log(`OK: ${auditedRules} SLAs confrontados com a planilha, ${auditedManual} manuais, ${blankServices} celulas vazias sem valor padrao; vinculos e exportacao exatos.`);
