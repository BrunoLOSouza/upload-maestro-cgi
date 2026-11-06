import { Injectable } from '@angular/core';
import { SlaConfig, SlaResult } from '../models/maestro.models';

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

    const wildcardKey = this.buildSlaKey(unidadeKey, baseAtend, '*', classif, svcLabel);
    const prog = slaProgramado?.chaves?.[key] || slaProgramado?.chaves?.[wildcardKey];
    if (prog) {
      return {
        sla_upload: prog.sla_upload,
        sla_contratual: prog.sla_contratual,
        origem: 'programado',
        manual_input: prog.manual_input,
        observation: prog.observation,
        legend: prog.manual_input ? `SLA manual obrigatório. ${prog.observation || ''}` : this.buildSlaLegend(prog.sla_upload, prog.sla_contratual)
      };
    }

    return {
      sla_upload: 0,
      sla_contratual: 0,
      origem: 'ausente',
      legend: 'Posto sem SLA cadastrado para esta unidade, base e atendimento. Não pode ser lançado.'
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
    if (slaUpload > 0) return `Início ${this.minutosParaTexto(slaUpload)} após a hora informada`;
    if (slaUpload === 0) {
      return `Chegada · início imediato à hora informada · duração estimada ${this.minutosParaTexto(slaContratual)}`;
    }
    return `Partida · início ${this.minutosParaTexto(slaUpload)} antes da hora informada`;
  }
}
