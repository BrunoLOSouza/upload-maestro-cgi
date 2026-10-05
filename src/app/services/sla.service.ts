import { Injectable } from '@angular/core';
import { SlaConfig, SlaResult } from '../models/maestro.models';

export const SLA_FALLBACK_PARTIDA = -240;

@Injectable({
  providedIn: 'root'
})
export class SlaService {
  public buildSlaKey(
    unidadeKey: string,
    baseAtend: string,
    baseDest: string,
    classif: string,
    svcLabel: string
  ): string {
    return `${unidadeKey}|${baseAtend}|${baseDest}|${classif}|${svcLabel}`;
  }

  public isChegada(baseDest: string, classif: string): boolean {
    const dest = String(baseDest || '').toUpperCase();
    const cls = String(classif || '').toUpperCase();
    return dest.includes('-') || cls.includes('CHEGADA');
  }

  public resolveSla(
    slaManual: SlaConfig | null,
    slaProgramado: SlaConfig | null,
    unidadeKey: string,
    baseAtend: string,
    baseDest: string,
    classif: string,
    svcLabel: string
  ): SlaResult {
    const key = this.buildSlaKey(unidadeKey, baseAtend, baseDest, classif, svcLabel);

    const manual = slaManual?.chaves?.[key];
    if (manual) {
      return {
        sla_upload: manual.sla_upload,
        sla_contratual: manual.sla_contratual,
        origem: 'manual',
        legend: this.buildSlaLegend(manual.sla_upload, manual.sla_contratual)
      };
    }

    const prog = slaProgramado?.chaves?.[key];
    if (prog) {
      return {
        sla_upload: prog.sla_upload,
        sla_contratual: prog.sla_contratual,
        origem: 'programado',
        legend: this.buildSlaLegend(prog.sla_upload, prog.sla_contratual)
      };
    }

    if (this.isChegada(baseDest, classif)) {
      const contr = Math.abs(SLA_FALLBACK_PARTIDA);
      return {
        sla_upload: 0,
        sla_contratual: contr,
        origem: 'fallback_chegada',
        legend: this.buildSlaLegend(0, contr)
      };
    }

    const fallbackContr = Math.abs(SLA_FALLBACK_PARTIDA);
    return {
      sla_upload: SLA_FALLBACK_PARTIDA,
      sla_contratual: fallbackContr,
      origem: 'fallback',
      legend: this.buildSlaLegend(SLA_FALLBACK_PARTIDA, fallbackContr)
    };
  }

  public minutosParaTexto(min: number): string {
    const m = Math.abs(min);
    const h = Math.floor(m / 60);
    const r = m % 60;
    if (h === 0) return `${r}min`;
    if (r === 0) return `${h}h`;
    return `${h}h${String(r).padStart(2, '0')}`;
  }

  public buildSlaLegend(slaUpload: number, slaContratual: number): string {
    if (slaUpload === 0) {
      return `Chegada · início imediato à hora informada · duração estimada ${this.minutosParaTexto(slaContratual)}`;
    }
    return `Partida · início ${this.minutosParaTexto(slaUpload)} antes da hora informada`;
  }
}
