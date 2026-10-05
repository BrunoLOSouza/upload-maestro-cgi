import { Injectable } from '@angular/core';
import { FlightRow, RowDuplicateInfo, ServiceDuplicateDetail } from '../models/maestro.models';

@Injectable({
  providedIn: 'root'
})
export class DuplicateService {
  public horaToMin(hhmm: string): number {
    const [h, m] = String(hhmm).split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  public checkExternal(
    row: FlightRow,
    servico: string,
    malhaIndex: Record<string, Map<string, Array<{ hora: string; servico: string }>> | null>
  ): boolean {
    if (!row._dataISO) return false;
    const [ano, mes] = row._dataISO.split('-').map(Number);
    const monthKey = `${ano}_${String(mes).padStart(2, '0')}`;
    const idx = malhaIndex[monthKey];
    if (!idx) return false;

    const key = `${row._unidadeKey}|${row._baseAtend}|${row._baseDest}|${row._classif}|${row._dataISO}`;
    const candidates = idx.get(key);
    if (!candidates) return false;

    const rowMin = this.horaToMin(row._horaISO);
    return candidates.some(
      c => c.servico === servico && Math.abs(this.horaToMin(c.hora) - rowMin) <= 60
    );
  }

  public computeDuplicates(
    rows: FlightRow[],
    svcCols: string[],
    malhaIndex: Record<string, Map<string, Array<{ hora: string; servico: string }>> | null>
  ): RowDuplicateInfo[] {
    const dup: RowDuplicateInfo[] = rows.map(() => ({ hasAny: false, services: {} }));

    // 1. Verificação Externa contra JSONs históricos
    rows.forEach((row, i) => {
      svcCols.forEach(col => {
        if (col.startsWith('Responsavel')) return;
        const val = row[col];
        if (val === '' || val === undefined || val === null) return;
        if (this.checkExternal(row, col, malhaIndex)) {
          if (!dup[i].services[col]) {
            dup[i].services[col] = { external: false, sessionWith: [] };
          }
          dup[i].services[col].external = true;
          dup[i].hasAny = true;
        }
      });
    });

    // 2. Verificação de Sessão (cards atuais entre si)
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        const a = rows[i];
        const b = rows[j];
        if (a._unidadeKey !== b._unidadeKey) continue;
        if (a._baseAtend !== b._baseAtend) continue;
        if (a._baseDest !== b._baseDest) continue;
        if (a._classif !== b._classif) continue;
        if (a._dataISO !== b._dataISO) continue;
        if (Math.abs(this.horaToMin(a._horaISO) - this.horaToMin(b._horaISO)) > 60) continue;

        svcCols.forEach(col => {
          if (col.startsWith('Responsavel')) return;
          const va = a[col];
          const vb = b[col];
          if (va === '' || va === undefined || vb === '' || vb === undefined) return;

          if (!dup[i].services[col]) {
            dup[i].services[col] = { external: false, sessionWith: [] };
          }
          dup[i].services[col].sessionWith.push({ idx: j, titulo: b['TÍTULO'] });
          dup[i].hasAny = true;

          if (!dup[j].services[col]) {
            dup[j].services[col] = { external: false, sessionWith: [] };
          }
          dup[j].services[col].sessionWith.push({ idx: i, titulo: a['TÍTULO'] });
          dup[j].hasAny = true;
        });
      }
    }

    return dup;
  }

  public buildTooltip(sd: ServiceDuplicateDetail): string {
    const parts: string[] = [];
    if (sd.external) {
      parts.push('Possível duplicidade externa: verifique no sistema antes de lançar.');
    }
    if (sd.sessionWith.length) {
      const refs = sd.sessionWith.map(s => `#${s.idx + 1}`).join(', ');
      parts.push(`Duplicado com o card ${refs} — considere excluir um dos dois.`);
    }
    return parts.join(' ');
  }
}
