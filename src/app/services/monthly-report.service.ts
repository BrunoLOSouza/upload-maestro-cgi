import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { FlightRow, MonthlyMatch, MonthlyRecord, MonthlyReport, ServicoDef } from '../models/maestro.models';

@Injectable({ providedIn: 'root' })
export class MonthlyReportService {
  // Normalize comparison keys only. Source values and exported labels are kept unchanged.
  public normalize(value: unknown): string {
    return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
  }

  private key(unit: string, base: string, flight: string, destination: string, type: string, service: string): string {
    return [unit, base, flight, destination, type, service].map(value => this.normalize(value)).join('|');
  }

  // Compare wall-clock minutes, without converting operational Excel dates to the browser timezone.
  public parseDate(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value) && value > 1 && value < 2958466)
      return Math.round(value * 1440);
    if (typeof value !== 'string') return null;
    const text = value.trim();
    const br = /^(\d{2})\/(\d{2})\/(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(text);
    const iso = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(text);
    if (!br && !iso) return null;
    const match = (br || iso)!;
    const year = Number(br ? match[3] : match[1]), month = Number(match[2]), day = Number(br ? match[1] : match[3]);
    const hour = Number(match[4]), minute = Number(match[5]), second = Number(match[6] || 0);
    const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59) return null;
    return Math.round((date.getTime() - Date.UTC(1899, 11, 30)) / 60000);
  }

  public formatDate(minutes: number | null): string {
    return minutes === null ? 'Não informado' : XLSX.SSF.format('dd/mm/yyyy hh:mm', minutes / 1440);
  }

  public parse(buffer: ArrayBuffer, filename: string, services: ServicoDef[]): MonthlyReport {
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false, raw: true });
    const required = ['OS', 'Base', 'Voo', 'Destino', 'Atendimento', 'Unidade de gestão', 'Título', 'Status', 'Data Inicio', 'Data Prazo', 'Início', 'Fim'];
    let rows: unknown[][] | undefined;
    let columns: string[] = [];
    for (const sheet of workbook.SheetNames) {
      const candidate = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheet], { header: 1, defval: null, blankrows: true });
      const headers = (candidate[0] || []).map(value => this.normalize(value));
      if (required.every(name => headers.includes(this.normalize(name)))) { rows = candidate; columns = headers; break; }
    }
    if (!rows) throw new Error('Relatório incompatível. Use a exportação de Medição de Malhas Aéreas com OS, Base, Voo, Título e os dois pares de datas.');
    for (const name of required) if (columns.filter(column => column === this.normalize(name)).length !== 1)
      throw new Error(`Coluna obrigatória repetida: ${name}.`);
    const field = (row: unknown[], name: string) => row[columns.indexOf(this.normalize(name))];
    const text = (row: unknown[], name: string) => String(field(row, name) ?? '');
    const report: MonthlyReport = { filename, importedAt: new Date().toISOString(), records: [], ignoredGroups: 0, rejected: [], warnings: [], from: Infinity, to: -Infinity, index: new Map() };
    const known = [...services].sort((a, b) => b.label.length - a.label.length);
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!text(row, 'OS').trim()) { report.ignoredGroups++; continue; }
      const id = text(row, 'OS');
      const primaryStart = this.parseDate(field(row, 'Data Inicio')), primaryEnd = this.parseDate(field(row, 'Data Prazo'));
      if (['Base', 'Voo', 'Destino', 'Atendimento', 'Unidade de gestão', 'Título', 'Status'].some(name => !text(row, name).trim()) || primaryStart === null || primaryEnd === null || primaryEnd < primaryStart) {
        report.rejected.push(`Linha ${i + 1}, OS ${id}: campo obrigatório ou intervalo principal inválido.`); continue;
      }
      const title = this.normalize(text(row, 'Título'));
      const service = known.find(item => title.startsWith(this.normalize(item.label) + ' '));
      const posto = service?.label || text(row, 'Título').split(/\s+[A-Z]{3}_/)[0];
      const warnings: string[] = [];
      if (!service) warnings.push('Posto sem coluna correspondente no modelo de upload.');
      const expectedTitle = [text(row, 'Base'), text(row, 'Voo'), text(row, 'Destino'), text(row, 'Atendimento')].join('_');
      if (!title.endsWith(this.normalize(expectedTitle))) warnings.push('Voo/rota no título divergem das colunas próprias; a comparação usa as colunas Base, Voo, Destino e Atendimento.');
      const date = (name: string) => this.parseDate(field(row, name));
      const alternateStart = date('Início'), alternateEnd = date('Fim');
      if (alternateStart === null || alternateEnd === null || alternateEnd < alternateStart) warnings.push('Intervalo complementar ausente ou inválido.');
      if (alternateStart !== primaryStart || alternateEnd !== primaryEnd) warnings.push('Datas principais e complementares divergem.');
      const record: MonthlyRecord = { os: id, unidade: text(row, 'Unidade de gestão'), base: text(row, 'Base'), voo: text(row, 'Voo'), destino: text(row, 'Destino'), atendimento: text(row, 'Atendimento'), posto, status: text(row, 'Status'), primaryStart, primaryEnd, alternateStart, alternateEnd,
        actualStart: date('Data de execução real'), actualEnd: date('Data de resolução real'), adjustedStart: date('Data de execução ajustada'), adjustedEnd: date('Data de resolução ajustada'), warnings };
      report.records.push(record);
      report.from = Math.min(report.from, primaryStart, alternateStart ?? primaryStart);
      report.to = Math.max(report.to, primaryEnd, alternateEnd ?? primaryEnd);
      const key = this.key(record.unidade, record.base, record.voo, record.destino, record.atendimento, posto);
      const entries = report.index.get(key) || []; entries.push(record); report.index.set(key, entries);
      warnings.forEach(warning => report.warnings.push(`Linha ${i + 1}, OS ${id}: ${warning}`));
    }
    if (!report.records.length) throw new Error('Nenhum registro de OS com dados válidos encontrado. O relatório anterior foi preservado.');
    return report;
  }

  public interval(row: FlightRow, service: string): { start: number; end: number } | null {
    const reference = this.parseDate(`${row._dataISO} ${row._horaISO}`);
    const offset = row[service], duration = row['_contratual_' + service];
    if (reference === null || typeof offset !== 'number' || !Number.isFinite(offset) || typeof duration !== 'number' || !Number.isFinite(duration)) return null;
    const start = reference + offset;
    return { start, end: start + Math.abs(duration) };
  }

  public match(report: MonthlyReport, row: FlightRow, service: string): MonthlyMatch[] {
    const interval = this.interval(row, service);
    if (!interval) return [];
    const flight = String(row['TÍTULO']).split('_')[1];
    const candidates = report.index.get(this.key(row['UNIDADE DE GESTÃO'], row._baseAtend, flight, row._baseDest, row._classif, service)) || [];
    const near = (start: number | null, end: number | null) => start !== null && end !== null && end >= start &&
      (Math.abs(start - interval.start) <= 60 || (interval.start < end && start < interval.end));
    return candidates.flatMap(record => {
      const exact = interval.start === record.primaryStart && interval.end === record.primaryEnd;
      const primary = near(record.primaryStart, record.primaryEnd);
      const alternative = near(record.alternateStart, record.alternateEnd);
      if (!exact && !primary && !alternative) return [];
      const cancelled = this.normalize(record.status).includes('CANCELAD');
      const level: MonthlyMatch['level'] = cancelled ? 'cancelada' : exact ? 'programacao' : 'possivel';
      const reason = exact ? 'Início e fim calculados coincidem com Data Inicio e Data Prazo.' : primary ? 'Intervalo principal sobreposto ou início a até 60 minutos do previsto.' : 'Correspondência somente no intervalo complementar Início/Fim.';
      return [{ record, level, reason }];
    });
  }
}
