const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const excelPath = 'C:/Users/Bruno/Downloads/Modelo - Planilha de Cargas.xlsx';
const wb = XLSX.readFile(excelPath);
const outDir = path.join(__dirname, 'src/assets/data');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 1. COLABORADORES
const baseRows = XLSX.utils.sheet_to_json(wb.Sheets['BASE']);
const apacs = [...new Set(baseRows.map(r => r['APACS']).filter(Boolean))].sort((a, b) =>
  String(a).localeCompare(String(b), 'pt-BR')
);
fs.writeFileSync(path.join(outDir, 'colaboradores.json'), JSON.stringify(apacs, null, 2));
console.log('Saved colaboradores.json:', apacs.length);

// 2. SUPERVISORES
const supMap = {};
baseRows.forEach(r => {
  const sup = r['Responsável'];
  const setor = r['Setor Responsável'];
  const unidade = r['Unidade de Gestão'];
  if (!sup) return;
  if (!supMap[sup]) {
    supMap[sup] = { responsavel: sup, unidades: [], setor_ondemand: 'Setor Virtual' };
  }
  if (unidade && setor) {
    if (!supMap[sup].unidades.some(u => u.unidade === unidade && u.setor === setor)) {
      supMap[sup].unidades.push({ unidade, setor });
    }
  }
});
const supervisores = Object.values(supMap).sort((a, b) =>
  a.responsavel.localeCompare(b.responsavel, 'pt-BR')
);
fs.writeFileSync(path.join(outDir, 'supervisores.json'), JSON.stringify(supervisores, null, 2));
console.log('Saved supervisores.json:', supervisores.length);

// 3. COLUNAS
const uploadWs = wb.Sheets['UPLOAD MAESTRO'];
const uploadRows = XLSX.utils.sheet_to_json(uploadWs, { header: 1 });
const allHeaders = uploadRows[0] || [];
const fixedCols = allHeaders.slice(0, 15);
fs.writeFileSync(path.join(outDir, 'colunas.json'), JSON.stringify({ fixed_cols: fixedCols }, null, 2));
console.log('Saved colunas.json with', fixedCols.length, 'fixed cols');

// 4. SERVICOS
const svcCols = allHeaders.slice(15);
const servicos = [];
svcCols.forEach(col => {
  const lower = col.toLowerCase();
  if (!lower.startsWith('responsavel') && !lower.startsWith('responsável')) {
    servicos.push({ label: col });
  }
});
fs.writeFileSync(path.join(outDir, 'servicos.json'), JSON.stringify(servicos, null, 2));
console.log('Saved servicos.json with', servicos.length, 'services');

// 5. UNIDADES DE GESTAO & ROTAS
const unGestRows = XLSX.utils.sheet_to_json(wb.Sheets['Unidades de Gestão']);
const ugs = [...new Set(unGestRows.map(r => r['Unidade de Gestão']).filter(Boolean))];
const configUnidades = [];
const slaProgramado = { chaves: {} };

ugs.forEach(ug => {
  let slug = 'cia';
  if (ug.toLowerCase().includes('latam')) slug = 'latam';
  else if (ug.toLowerCase().includes('gol')) slug = 'gol';
  else if (ug.toLowerCase().includes('azul')) slug = 'azul';
  else if (ug.toLowerCase().includes('copa')) slug = 'copa';
  else if (ug.toLowerCase().includes('cabo')) slug = 'caboverde';
  else slug = ug.toLowerCase().replace(/[^a-z0-9]/g, '_');

  const filename = slug + '_rotas.json';
  const rotasRows = unGestRows.filter(r => r['Unidade de Gestão'] === ug);

  const rotas = rotasRows.map(r => {
    const classif = r['Escopo'] || 'VARREDURA';
    const baseOrig = r['Base Origem'];
    const baseDest = r['Base Destino'];

    servicos.forEach(s => {
      const slaVal = r[s.label];
      if (typeof slaVal === 'number') {
        const key = [ug.trim().toUpperCase(), baseOrig, baseDest, classif, s.label].join('|');
        slaProgramado.chaves[key] = {
          sla_upload: -Math.abs(slaVal),
          sla_contratual: Math.abs(slaVal)
        };
      }
    });

    return {
      base_atend: baseOrig,
      base_dest: baseDest,
      classificacao: classif,
      _destino_tipo: 'select'
    };
  });

  fs.writeFileSync(path.join(outDir, filename), JSON.stringify({ rotas, destino_tipo: 'select' }, null, 2));

  configUnidades.push({
    id: slug,
    label: ug,
    arquivos: [filename]
  });
});

// Ondemand / Administração
configUnidades.push({
  id: 'ondemand',
  label: 'Administração',
  arquivos: ['ondemand.json']
});

const ondemandJson = {
  destino_tipo: 'input',
  subtipos: [
    { classificacao: 'VARREDURA', label: 'VARREDURA' },
    { classificacao: 'NDA_VARREDURA', label: 'NDA_VARREDURA' },
    { classificacao: 'GOL MELI', label: 'GOL MELI' },
    { classificacao: 'AZUL CONECTA', label: 'AZUL CONECTA' },
    { classificacao: 'INTERNACIONAL', label: 'INTERNACIONAL' },
    { classificacao: 'INTERNACIONAL EUA', label: 'INTERNACIONAL EUA' },
    { classificacao: 'INTERNACIONAL EUR', label: 'INTERNACIONAL EUR' },
    { classificacao: 'INTERNACIONAL RON PARTIDA', label: 'INTERNACIONAL RON PARTIDA' },
    { classificacao: 'INTERNACIONAL RON CHEGADA', label: 'INTERNACIONAL RON CHEGADA' },
    { classificacao: 'INTERNACIONAL TURN', label: 'INTERNACIONAL TURN' },
    { classificacao: 'LATAM CARGO', label: 'LATAM CARGO' }
  ]
};
fs.writeFileSync(path.join(outDir, 'ondemand.json'), JSON.stringify(ondemandJson, null, 2));

// 6. CONFIG.JSON
const configJson = {
  unidades: configUnidades,
  campos_fixos: {
    EMPRESA: 'SECURITY MATRIZ - BSB',
    EXECUTOR: 'CONTRATO',
    CATEGORIA: 'MALHA AÉREA',
    PRIORIDADE: 'ALTA',
    DISCIPLINA: 'ATENDIMENTO',
    GRUPO_SERVICO: 'OPERACIONAL',
    SERVICO: 'OPERADOR AEREO'
  }
};
fs.writeFileSync(path.join(outDir, 'config.json'), JSON.stringify(configJson, null, 2));
console.log('Saved config.json with', configUnidades.length, 'unidades');

// 7. SLA PROGRAMADO & MANUAL
fs.writeFileSync(path.join(outDir, 'sla_malha_programada.json'), JSON.stringify(slaProgramado, null, 2));
fs.writeFileSync(path.join(outDir, 'sla_malha_manual.json'), JSON.stringify({ chaves: {} }, null, 2));
console.log('Saved SLA programado with', Object.keys(slaProgramado.chaves).length, 'keys');

// 8. AVISOS.JSON
const avisos = [
  { texto: 'SISTEMA OPERACIONAL CGI - MODELO CARGA ATUALIZADO', data: '2026' },
  { texto: 'Verifique os dados de SLA e APAC antes de exportar a planilha final', data: '' }
];
fs.writeFileSync(path.join(outDir, 'avisos.json'), JSON.stringify(avisos, null, 2));

console.log('--- Extração finalizada com sucesso! ---');
