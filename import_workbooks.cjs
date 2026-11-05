const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const [modelPath, slaPath] = process.argv.slice(2);
if (!modelPath || !slaPath) throw new Error('Informe os arquivos de modelo e SLA.');
const model = XLSX.readFile(modelPath);
const sla = XLSX.readFile(slaPath);
const out = path.join(__dirname, 'src/assets/data');
const save = (name, value) => fs.writeFileSync(path.join(out, name), JSON.stringify(value, null, 2) + '\n');
const headers = XLSX.utils.sheet_to_json(model.Sheets['UPLOAD MAESTRO'], {header: 1})[0];
save('colunas.json', {fixed_cols: headers.slice(0, 15), upload_cols: headers});
const services = [];
for (let i = 15; i < headers.length; i += 2) services.push({label: headers[i], responsible_column: headers[i + 1]});
save('servicos.json', services);
const base = XLSX.utils.sheet_to_json(model.Sheets.BASE);
const supervisors = new Map();
// Contrato encerrado, conforme orientação operacional.
const excludedUnits = new Set(['AZUL Linhas Aéreas - Varredura BR']);
const units = [...new Set(base.map(r => r['Unidade de Gestão']).filter(label => label && !excludedUnits.has(label)))];
for (const row of base) {
  const name = row['Responsável'];
  if (!name) continue;
  if (!supervisors.has(name)) supervisors.set(name, {responsavel: name, unidades: []});
  const entries = supervisors.get(name).unidades;
  const unidade = row['Unidade de Gestão'], setor = row['Setor Responsável'];
  if (unidade && setor && !entries.some(e => e.unidade === unidade && e.setor === setor)) entries.push({unidade, setor});
}
save('supervisores.json', [...supervisors.values()]);
save('colaboradores.json', [...new Set(base.map(r => r.APACS).filter(Boolean))]);
// Matching is internal only: output labels always come unchanged from BASE.
const matchKey = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const rules = XLSX.utils.sheet_to_json(sla.Sheets[sla.SheetNames[0]]);
const config = JSON.parse(fs.readFileSync(path.join(out, 'config.json')));
const newUnits = [];
const chaves = {};
const pending = [];
for (const label of units) {
  const previous = config.unidades.find(u => matchKey(u.label) === matchKey(label));
  const id = previous?.id || matchKey(label).split(' ')[0].toLowerCase();
  const filename = id + '_rotas.json';
  const routes = [];
  for (const rule of rules.filter(r => matchKey(r['Unidade de gestão / Cliente'] || '') === matchKey(label) && r.Ativo === 'SIM')) {
    const base = rule.Base, classification = rule.Atendimento;
    if (!routes.some(r => r.base_atend === base && r.classificacao === classification)) routes.push({base_atend: base, classificacao: classification});
    for (const service of services) {
      const value = rule[service.label];
      if (value === undefined || value === null || value === '') continue;
      const manual_input = typeof value === 'string' && value.includes('*');
      if (!manual_input && typeof value !== 'number') { pending.push({label, base, classification, service: service.label, value}); continue; }
      const minutes = Math.round(Math.abs(Number(String(value).replace('*', ''))));
      chaves[[label.trim().toUpperCase(), base, '*', classification, service.label].join('|')] = {
        sla_upload: rule['SLA + ou -'] === '+' ? minutes : -minutes,
        sla_contratual: minutes, manual_input, observation: rule.Obs || ''
      };
    }
  }
  save(filename, {rotas: routes, destino_tipo: 'input'});
  newUnits.push({id, label, arquivos: [filename]});
}
config.unidades = newUnits;
save('config.json', config);
save('sla_malha_programada.json', {chaves});
save('import_pending.json', pending);
console.log(JSON.stringify({units: units.length, supervisors: supervisors.size, services: services.length, rules: Object.keys(chaves).length, manual: Object.values(chaves).filter(r=>r.manual_input).length, pending}));
