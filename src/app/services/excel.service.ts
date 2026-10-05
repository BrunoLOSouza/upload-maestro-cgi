import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { FlightRow } from '../models/maestro.models';

@Injectable({
  providedIn: 'root'
})
export class ExcelService {
  public isoToExcelDate(isoDate: string): number | string {
    if (!isoDate) return '';
    const [y, m, d] = isoDate.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const serial = Math.round((date.getTime() - excelEpoch.getTime()) / 86400000);
    return serial;
  }

  public isoToExcelTime(horaISO: string): number | string {
    if (!horaISO) return '';
    const [hStr, mStr] = horaISO.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr || '0', 10);
    return (h * 60 + m) / 1440;
  }

  public formatDateBR(isoDate: string): string {
    if (!isoDate) return '';
    const [y, m, d] = isoDate.split('-');
    return `${d}/${m}/${y}`;
  }

  public formatHoraAMPM(horaISO: string): string {
    if (!horaISO) return '';
    const [hStr, mStr] = horaISO.split(':');
    let h = parseInt(hStr, 10);
    const m = mStr || '00';
    const period = h >= 12 ? 'PM' : 'AM';
    if (h === 0) h = 12;
    else if (h > 12) h = h - 12;
    return `${h}:${m}:00 ${period}`;
  }

  public exportExcel(
    rows: FlightRow[],
    allCols: string[],
    slaCols: string[]
  ): { filename: string; rowsCount: number; uniqueSlaCount: number } {
    if (!rows.length) {
      throw new Error('Nenhuma linha para exportar.');
    }

    const wb = XLSX.utils.book_new();

    // ── ABA 1: UPLOAD MAESTRO ──
    const ws1Data: any[][] = [allCols];

    rows.forEach(row => {
      const rowData = allCols.map(c => {
        if (c === 'SLA DATA') return this.isoToExcelDate(row._dataISO);
        if (c === 'SLA HORA') return this.isoToExcelTime(row._horaISO);
        return row[c] !== undefined ? row[c] : '';
      });
      ws1Data.push(rowData);
    });

    const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);

    ws1['!cols'] = allCols.map(c => {
      if (c === 'TÍTULO' || c === 'DESCRIÇÃO') return { wch: 40 };
      if (c.startsWith('Responsavel') || c === 'RESPONSÁVEL') return { wch: 32 };
      if (c === 'UNIDADE DE GESTÃO') return { wch: 36 };
      return { wch: 20 };
    });

    const dateColIdx = allCols.indexOf('SLA DATA');
    const timeColIdx = allCols.indexOf('SLA HORA');
    const dateColLetter = XLSX.utils.encode_col(dateColIdx);
    const timeColLetter = XLSX.utils.encode_col(timeColIdx);

    rows.forEach((_, i) => {
      const rowNum = i + 2;
      const dateCell = (ws1 as any)[`${dateColLetter}${rowNum}`];
      if (dateCell) {
        dateCell.t = 'n';
        dateCell.z = 'DD/MM/YYYY';
      }
      const timeCell = (ws1 as any)[`${timeColLetter}${rowNum}`];
      if (timeCell) {
        timeCell.t = 'n';
        timeCell.z = 'h:mm:ss AM/PM';
      }
    });

    XLSX.utils.book_append_sheet(wb, ws1, 'UPLOAD MAESTRO');

    // ── ABA 2: SLA contratual ──
    const titulosVistos = new Set<string>();
    const slaRows: FlightRow[] = [];

    rows.forEach(row => {
      const titulo = row['TÍTULO'];
      if (!titulosVistos.has(titulo)) {
        titulosVistos.add(titulo);
        slaRows.push(row);
      }
    });

    const ws2Data: any[][] = [
      [],
      [],
      ['', ...slaCols],
      ...slaRows.map(row => [
        '',
        ...slaCols.map(c => {
          if (c === 'TÍTULO') return row[c] || '';
          const contratual = row['_contratual_' + c];
          return typeof contratual === 'number' ? contratual : '';
        })
      ])
    ];

    const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);
    ws2['!cols'] = [{ wch: 2 }, { wch: 40 }, ...slaCols.slice(1).map(() => ({ wch: 22 }))];

    XLSX.utils.book_append_sheet(wb, ws2, 'SLA contratual');

    // Download do arquivo
    const date = new Date();
    const ds = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(
      date.getDate()
    ).padStart(2, '0')}`;
    const ts = `${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(
      2,
      '0'
    )}${String(date.getSeconds()).padStart(2, '0')}`;
    const filename = `UPLOAD_MAESTRO_${ds}_${ts}.xlsx`;

    XLSX.writeFile(wb, filename);

    return {
      filename,
      rowsCount: rows.length,
      uniqueSlaCount: titulosVistos.size
    };
  }
}
