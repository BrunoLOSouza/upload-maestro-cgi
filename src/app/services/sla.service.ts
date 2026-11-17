import { Injectable } from '@angular/core';
import { SlaConfig, SlaResult } from '../models/maestro.models';

@Injectable({
  providedIn: 'root'
})
export class SlaService {
  public isFiveMinuteTime(value: string): boolean {
    return /^(?:[01]\d|2[0-3]):[0-5]\d(?::00)?$/.test(value) && Number(value.slice(3, 5)) % 5 === 0;
  }

  public isBeforeNoon(value: string): boolean {
    return this.isFiveMinuteTime(value) && Number(value.slice(0, 2)) < 12;
  }

  public isTps3Scope(unidadeKey: string, baseAtend: string, classif: string): boolean {
    return unidadeKey.trim().toUpperCase() === 'GOL LINHAS AÉREAS - VARREDURA BR' &&
      baseAtend.trim().toUpperCase() === 'GRU' && classif.trim().toUpperCase() === 'INTERNACIONAL';
  }

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

    // Operational exception: the asterisk does not make TPS 3 editable in this scope.
    if (svcLabel === 'TPS 3' && this.isTps3Scope(unidadeKey, baseAtend, classif)) {
      return {
        sla_upload: -240,
        sla_contratual: 240,
        origem: 'programado',
        manual_input: false,
        observation: 'TPS 3 apenas em voos internacionais decolando antes das 12:00. Avisar comercial do GOL MELI PARTIDA.',
        legend: `${this.buildSlaLegend(-240, 240)} · TPS 3: 240 minutos fixos, somente antes das 12:00. Avisar comercial do GOL MELI PARTIDA.`
      };
    }

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
      manual_input: true,
      legend: 'Sem SLA nesta linha da planilha. Informe manualmente o valor de upload com sinal, conforme orientação operacional.'
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
      return `Início à hora informada · duração estimada ${this.minutosParaTexto(slaContratual)}`;
    }
    return `Partida · início ${this.minutosParaTexto(slaUpload)} antes da hora informada`;
  }
}
