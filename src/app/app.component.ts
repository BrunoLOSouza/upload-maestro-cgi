import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AppConfig,
  Aviso,
  CiaData,
  FlightRow,
  GitHubCredentials,
  RowDuplicateInfo,
  SelectedService,
  ServicoDef,
  SlaConfig,
  Supervisor
} from './models/maestro.models';
import { GithubService } from './services/github.service';
import { SLA_FALLBACK_PARTIDA, SlaService } from './services/sla.service';
import { DuplicateService } from './services/duplicate.service';
import { ExcelService } from './services/excel.service';
import { ApacSelectComponent } from './components/apac-select/apac-select.component';
import { SettingsModalComponent } from './components/settings-modal/settings-modal.component';

export interface FilteredRowItem {
  row: FlightRow;
  index: number;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ApacSelectComponent,
    SettingsModalComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {
  // ── ESTADO DA APLICAÇÃO ──
  public isLoading = true;
  public loadingText = 'INICIALIZANDO CGI FLIGHT DISPATCH...';
  public isDark = true;
  public statusDotClass = 'status-dot loading';
  public statusText = 'Conectando ao sistema...';
  public avisosText = '';

  // ── RELÓGIO OPERACIONAL AO VIVO ──
  public liveClock = '--:--:--';
  public liveDate = '---';
  private clockInterval: any = null;

  // ── BANCO EM MEMÓRIA ──
  public config: AppConfig | null = null;
  public colaboradores: string[] = [];
  public supervisores: Supervisor[] = [];
  public servicos: ServicoDef[] = [];
  public cias: Record<string, CiaData> = {};
  public slaProgramado: SlaConfig | null = null;
  public slaManual: SlaConfig | null = null;

  // ── COLUNAS EXCEL ──
  public fixedCols: string[] = [];
  public svcCols: string[] = [];
  public allCols: string[] = [];
  public slaCols: string[] = [];

  // ── FORMULÁRIO (SIDEBAR) ──
  public selCiaId = '';
  public currentCiaData: {
    unidade: string;
    rotas: any[];
    _isOndemand: boolean;
  } | null = null;

  public availableSupervisores: Supervisor[] = [];
  public selSupervisorName = '';
  public autoSetorText = '—';

  public isBaseAtendInput = false;
  public availableBases: string[] = [];
  public selBaseVal = '';
  public inputBaseAtendVal = '';
  public errBaseAtend = false;

  public inputNumberVal = '';
  public errNumber = false;

  public isBaseDestInput = false;
  public availableDestinos: string[] = [];
  public selBaseDestVal = '';
  public inputBaseDestVal = '';
  public errBaseDest = false;

  public availableClassifs: Array<{ value: string; text: string }> = [];
  public selClassifVal = '';

  public tituloCalculado = 'Preencha os campos acima...';
  public isTituloEmpty = true;

  public inputDataVal = '';
  public inputHoraVal = '';

  public selectedServices: SelectedService[] = [];

  // ── PREVIEW & FILTROS ──
  public rows: FlightRow[] = [];
  public duplicates: RowDuplicateInfo[] = [];
  public searchTerm = '';
  public activeFilter: 'all' | 'partidas' | 'chegadas' | 'alertas' = 'all';

  // ── MODAIS & TOAST ──
  public isModalClearOpen = false;
  public isSettingsModalOpen = false;
  public githubCreds: GitHubCredentials = { user: '', repo: '', token: '' };

  public toastMsg = '';
  public toastType = '';
  public isToastShow = false;
  private toastTimer: any = null;

  constructor(
    private githubService: GithubService,
    private slaService: SlaService,
    private duplicateService: DuplicateService,
    private excelService: ExcelService
  ) {}

  public ngOnInit(): void {
    this.startClock();
    this.githubCreds = this.githubService.getCredentials();
    this.loadAllData();
  }

  public ngOnDestroy(): void {
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
    }
  }

  // ── RELÓGIO OPERACIONAL ──
  private startClock(): void {
    const update = () => {
      const now = new Date();
      this.liveClock = now.toLocaleTimeString('pt-BR', { hour12: false });
      this.liveDate = now.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short'
      }).toUpperCase();
    };
    update();
    this.clockInterval = setInterval(update, 1000);
  }

  // ── KPIS & MÉTRICAS EXECUTIVAS ──
  public get totalVoos(): number {
    return this.rows.length;
  }

  public get totalServicosAlocados(): number {
    let count = 0;
    this.rows.forEach(r => {
      this.getActiveServiceCols(r).forEach(() => count++);
    });
    return count;
  }

  public get totalHorasEstimadas(): string {
    let totalMinutos = 0;
    this.rows.forEach(r => {
      this.getActiveServiceCols(r).forEach(col => {
        const contratual = r['_contratual_' + col];
        if (typeof contratual === 'number') {
          totalMinutos += Math.abs(contratual);
        } else {
          totalMinutos += 180; // default médio
        }
      });
    });
    const horas = Math.floor(totalMinutos / 60);
    const min = totalMinutos % 60;
    return `${horas}h ${min > 0 ? min + 'm' : ''}`;
  }

  public get totalAlertasDuplicidade(): number {
    return this.duplicates.filter(d => d.hasAny).length;
  }

  // ── CARREGAMENTO DE DADOS ──
  public async loadAllData(): Promise<void> {
    this.isLoading = true;
    this.statusDotClass = 'status-dot loading';
    this.statusText = 'Carregando malha operacional...';

    try {
      const { ano, mes, anoAnt, mesAnt } = this.githubService.getMonthPair();

      const [
        config,
        colaboradores,
        supervisores,
        servicos,
        avisos,
        colunas,
        slaProgramado,
        slaManual
      ] = await Promise.all([
        this.githubService.fetchJson<AppConfig>('config.json'),
        this.githubService.fetchJson<string[]>('colaboradores.json'),
        this.githubService.fetchJson<Supervisor[]>('supervisores.json'),
        this.githubService.fetchJson<ServicoDef[]>('servicos.json'),
        this.githubService.fetchJson<Aviso[]>('avisos.json').catch(() => []),
        this.githubService.fetchJson<{ fixed_cols: string[] }>('colunas.json'),
        this.githubService.fetchJson<SlaConfig>('sla_malha_programada.json').catch(() => null),
        this.githubService.fetchJson<SlaConfig>('sla_malha_manual.json').catch(() => null),
        this.githubService.ensureMalhaMonth(ano, mes),
        this.githubService.ensureMalhaMonth(anoAnt, mesAnt)
      ]);

      this.config = config;
      this.colaboradores = colaboradores || [];
      this.supervisores = supervisores || [];
      this.servicos = servicos || [];
      this.slaProgramado = slaProgramado;
      this.slaManual = slaManual;
      this.fixedCols = colunas.fixed_cols || [];

      // Carregar rotas das CIAs
      const allArquivos = [...new Set(config.unidades.flatMap(u => u.arquivos))];
      const results = await Promise.all(
        allArquivos.map(a =>
          this.githubService
            .fetchJson<CiaData>(a)
            .then(d => ({ a, d }))
            .catch(() => ({ a, d: { rotas: [] } as CiaData }))
        )
      );

      this.cias = {};
      results.forEach(({ a, d }) => {
        this.cias[a] = d;
      });

      this.buildCols();
      this.buildAvisos(avisos);

      this.statusDotClass = 'status-dot';
      this.statusText = 'CGI DISPATCH PRONTO · OPERAÇÃO NORMAL';
      this.isLoading = false;
      this.showToast('✓ Base operacional CGI carregada com sucesso', 'success');
    } catch (err: any) {
      this.isLoading = false;
      this.statusDotClass = 'status-dot error';
      this.statusText = 'Erro ao inicializar base de dados';
      this.showToast(`⚠ Erro ao carregar dados: ${err.message}`, 'error');
    }
  }

  private buildCols(): void {
    this.svcCols = [];
    this.servicos.forEach(s => {
      this.svcCols.push(s.label);
      this.svcCols.push('Responsavel ' + s.label);
    });
    this.allCols = [...this.fixedCols, ...this.svcCols];
    this.slaCols = ['TÍTULO', ...this.svcCols.filter(c => !c.startsWith('Responsavel'))];
  }

  private buildAvisos(avisos: Aviso[]): void {
    if (avisos && avisos.length > 0) {
      this.avisosText = avisos
        .map(a => {
          const txt = a.texto || a.text || String(a);
          const d = a.data || a.date || '';
          return d ? `✈ ${txt} [${d}]` : `✈ ${txt}`;
        })
        .join('      ·      ');
    } else {
      this.avisosText = '✈ SISTEMA CGI DISPATCH · PRONTO PARA IMPORTAÇÃO NO MAESTRO';
    }
  }

  // ── SELEÇÃO EM CASCATA ──
  public onCiaChange(): void {
    this.resetFrom('cia');
    if (!this.selCiaId || !this.config) return;

    const unidadeCfg = this.config.unidades.find(u => u.id === this.selCiaId);
    if (!unidadeCfg) return;

    const todasRotas = unidadeCfg.arquivos.flatMap(arq => {
      const d = this.cias[arq];
      return d ? d.rotas.map(r => ({ ...r, _destino_tipo: d.destino_tipo })) : [];
    });

    this.currentCiaData = {
      unidade: unidadeCfg.label,
      rotas: todasRotas,
      _isOndemand: unidadeCfg.id === 'ondemand'
    };

    // Supervisores
    this.availableSupervisores = this.currentCiaData._isOndemand
      ? this.supervisores
      : this.supervisores.filter(s => s.unidades.some(u => u.unidade === unidadeCfg.label));

    if (unidadeCfg.id === 'ondemand') {
      this.isBaseAtendInput = true;
      this.inputBaseAtendVal = '';
      this.isBaseDestInput = true;
      this.inputBaseDestVal = '';

      const ciaFile = unidadeCfg.arquivos[0];
      const ciaObj = this.cias[ciaFile];
      const subs = ciaObj?.subtipos || [];
      this.availableClassifs = subs.map(s => ({
        value: s.classificacao,
        text: s.label
      }));
    } else {
      this.isBaseAtendInput = false;
      this.inputBaseAtendVal = '';
      this.availableBases = [...new Set(todasRotas.map(r => r.base_atend))].sort();
    }

    this.updateTitulo();
  }

  public onSupervisorChange(): void {
    if (!this.selSupervisorName) {
      this.autoSetorText = '—';
    } else if (this.currentCiaData?._isOndemand) {
      const sup = this.supervisores.find(s => s.responsavel === this.selSupervisorName);
      this.autoSetorText = sup?.setor_ondemand || 'Setor Virtual';
    } else {
      const sup = this.supervisores.find(s => s.responsavel === this.selSupervisorName);
      const unidadeEntry = sup?.unidades.find(u => u.unidade === this.currentCiaData?.unidade);
      this.autoSetorText = unidadeEntry?.setor || '—';
    }
    this.updateTitulo();
  }

  public onBaseChange(): void {
    this.resetFrom('base');
    if (!this.selBaseVal || !this.currentCiaData) return;

    const rotasFiltradas = this.currentCiaData.rotas.filter(r => r.base_atend === this.selBaseVal);
    const tipoDestino = rotasFiltradas.every(r => r._destino_tipo === 'select') ? 'select' : 'input';

    if (tipoDestino === 'select') {
      this.isBaseDestInput = false;
      this.availableDestinos = [
        ...new Set(rotasFiltradas.map(r => r.base_dest).filter(Boolean))
      ].sort() as string[];
    } else {
      this.isBaseDestInput = true;
      this.inputBaseDestVal = '';
    }

    this.updateTitulo();
  }

  public onInputBaseAtend(): void {
    let val = this.inputBaseAtendVal.toUpperCase().replace(/[^A-Z\-]/g, '');
    if (val.length > 7) val = val.slice(0, 7);
    this.inputBaseAtendVal = val;
    this.errBaseAtend = !/^[A-Z]{3}(-[A-Z]{3})?$/.test(val) && val.length > 0;
    this.updateTitulo();
  }

  public onInputNumber(): void {
    let val = this.inputNumberVal.toUpperCase().replace(/[^A-Z0-9\-]/g, '');
    this.inputNumberVal = val;
    this.errNumber = !/^[A-Z0-9][A-Z0-9\-]*$/.test(val) && val.length > 0;
    this.updateTitulo();
  }

  public onBaseDestChange(): void {
    const base = this.isBaseAtendInput ? this.inputBaseAtendVal.trim() : this.selBaseVal;
    const dest = this.selBaseDestVal;
    this.resetFrom('destino');

    if (!dest || !this.currentCiaData) return;
    if (this.currentCiaData._isOndemand) {
      this.updateTitulo();
      return;
    }

    const classifs = [
      ...new Set(
        this.currentCiaData.rotas
          .filter(r => r.base_atend === base && r.base_dest === dest)
          .map(r => r.classificacao)
      )
    ].sort();

    this.availableClassifs = classifs.map(c => ({ value: c, text: c }));
    this.highlightMatchingClassifs(dest);
    this.updateTitulo();
  }

  public onInputBaseDest(): void {
    let val = this.inputBaseDestVal.toUpperCase().replace(/[^A-Z\-]/g, '');
    if (val.length > 7) val = val.slice(0, 7);
    this.inputBaseDestVal = val;
    const valid = /^[A-Z]{3}(-[A-Z]{3})?$/.test(val) || val.length === 0;
    this.errBaseDest = !valid && val.length > 0;

    if (valid && val.length >= 3 && this.currentCiaData && !this.currentCiaData._isOndemand) {
      const base = this.isBaseAtendInput ? this.inputBaseAtendVal.trim() : this.selBaseVal;
      const classifs = [
        ...new Set(
          this.currentCiaData.rotas
            .filter(r => r.base_atend === base)
            .map(r => r.classificacao)
        )
      ].sort();
      this.availableClassifs = classifs.map(c => ({ value: c, text: c }));
      this.highlightMatchingClassifs(val);
    }

    this.updateTitulo();
  }

  public onClassifChange(): void {
    this.recalculateAllServicesSla();
    this.updateTitulo();
  }

  private highlightMatchingClassifs(dest: string): void {
    if (!dest || dest.length < 3 || !this.currentCiaData) return;
    const destUpper = dest.toUpperCase();
    const matched = new Set(
      this.currentCiaData.rotas
        .filter(r => {
          const bd = (r.base_dest || '').toUpperCase();
          return bd === destUpper || bd.includes(destUpper) || destUpper.includes(bd.replace('-', ''));
        })
        .map(r => r.classificacao)
    );

    this.availableClassifs.forEach(opt => {
      let rawText = opt.text.startsWith('🟡 ') ? opt.text.slice(3) : opt.text;
      if (matched.has(opt.value)) {
        opt.text = '🟡 ' + rawText;
      } else {
        opt.text = rawText;
      }
    });
  }

  // ── SERVIÇOS ──
  public addServicoItem(label = '', apac = '', locked = false): void {
    const ctx = this.getCurrentRouteContext();
    const slaRes = this.slaService.resolveSla(
      this.slaManual,
      this.slaProgramado,
      ctx.unidadeKey,
      ctx.base,
      ctx.dest,
      ctx.classif,
      label
    );

    this.selectedServices.push({
      label,
      apac,
      slaUpload: label ? slaRes.sla_upload : SLA_FALLBACK_PARTIDA,
      slaContratual: label ? slaRes.sla_contratual : Math.abs(SLA_FALLBACK_PARTIDA),
      legend: label ? slaRes.legend : 'Selecione o serviço',
      locked
    });
  }

  public onServiceSelectChange(svc: SelectedService): void {
    if (!svc.label) {
      svc.slaUpload = SLA_FALLBACK_PARTIDA;
      svc.slaContratual = Math.abs(SLA_FALLBACK_PARTIDA);
      svc.legend = 'Selecione o serviço';
      return;
    }

    const ctx = this.getCurrentRouteContext();
    const res = this.slaService.resolveSla(
      this.slaManual,
      this.slaProgramado,
      ctx.unidadeKey,
      ctx.base,
      ctx.dest,
      ctx.classif,
      svc.label
    );
    svc.slaUpload = res.sla_upload;
    svc.slaContratual = res.sla_contratual;
    svc.legend = res.legend;
  }

  public recalculateAllServicesSla(): void {
    const ctx = this.getCurrentRouteContext();
    this.selectedServices.forEach(s => {
      if (s.label) {
        const res = this.slaService.resolveSla(
          this.slaManual,
          this.slaProgramado,
          ctx.unidadeKey,
          ctx.base,
          ctx.dest,
          ctx.classif,
          s.label
        );
        s.slaUpload = res.sla_upload;
        s.slaContratual = res.sla_contratual;
        s.legend = res.legend;
      }
    });
  }

  public removeServicoItem(index: number): void {
    this.selectedServices.splice(index, 1);
  }

  // ── TÍTULO & VALIDAÇÃO ──
  public getCurrentRouteContext(): {
    unidadeKey: string;
    base: string;
    dest: string;
    classif: string;
  } {
    const unidade = this.currentCiaData
      ? this.currentCiaData._isOndemand
        ? 'Administração'
        : this.currentCiaData.unidade
      : '';
    const base = this.isBaseAtendInput ? this.inputBaseAtendVal.trim() : this.selBaseVal;
    const dest = this.isBaseDestInput ? this.inputBaseDestVal.trim() : this.selBaseDestVal;
    const classif = this.selClassifVal;
    return { unidadeKey: unidade.trim().toUpperCase(), base, dest, classif };
  }

  public updateTitulo(): void {
    const ctx = this.getCurrentRouteContext();
    const number = this.inputNumberVal.trim();
    if (!ctx.base || !ctx.dest || !ctx.classif) {
      this.tituloCalculado = 'Preencha os campos da rota acima...';
      this.isTituloEmpty = true;
    } else {
      const num = number || 'XXXXX';
      this.tituloCalculado = `${ctx.base}_${num}_${ctx.dest}_${ctx.classif}`;
      this.isTituloEmpty = false;
    }
  }

  public get isAddRowValid(): boolean {
    const ctx = this.getCurrentRouteContext();
    const number = this.inputNumberVal.trim();
    const numberValid = number.length > 0 && /^[A-Z0-9][A-Z0-9\-]*$/.test(number);
    const destValid = ctx.dest.length >= 3;
    const baseValid = ctx.base.length >= 3;

    return !!(
      this.selCiaId &&
      baseValid &&
      numberValid &&
      destValid &&
      ctx.classif &&
      this.selSupervisorName &&
      this.inputDataVal &&
      this.inputHoraVal
    );
  }

  // ── ADICIONAR VOO AO PREVIEW ──
  public async addRow(): Promise<void> {
    if (!this.isAddRowValid || !this.config || !this.currentCiaData) return;

    const unidade = this.currentCiaData._isOndemand
      ? 'Administração'
      : this.currentCiaData.unidade;
    const supervisor = this.selSupervisorName;
    const setor = this.autoSetorText === '—' ? '' : this.autoSetorText;
    const ctx = this.getCurrentRouteContext();
    const number = this.inputNumberVal.trim();
    const titulo = `${ctx.base}_${number}_${ctx.dest}_${ctx.classif}`;
    const dataBR = this.excelService.formatDateBR(this.inputDataVal);
    const horaAMPM = this.excelService.formatHoraAMPM(this.inputHoraVal);

    // Carregar índice histórico
    const [anoRow, mesRow] = this.inputDataVal.split('-').map(Number);
    await this.githubService.ensureMalhaMonth(anoRow, mesRow);

    const row: FlightRow = {
      EMPRESA: this.config.campos_fixos.EMPRESA,
      'UNIDADE DE GESTÃO': unidade,
      EXECUTOR: this.config.campos_fixos.EXECUTOR,
      'SETOR RESPONSÁVEL': setor,
      RESPONSÁVEL: supervisor,
      'CATEGORIA ': this.config.campos_fixos.CATEGORIA,
      PRIORIDADE: this.config.campos_fixos.PRIORIDADE,
      TÍTULO: titulo,
      DESCRIÇÃO: titulo,
      DISCIPLINA: this.config.campos_fixos.DISCIPLINA,
      'GRUPO DE SERVIÇO': this.config.campos_fixos.GRUPO_SERVICO,
      SERVIÇO: this.config.campos_fixos.SERVICO,
      SITE: '',
      'SLA DATA': dataBR,
      'SLA HORA': horaAMPM,
      _dataISO: this.inputDataVal,
      _horaISO: this.inputHoraVal,
      _unidadeKey: unidade.trim().toUpperCase(),
      _baseAtend: ctx.base,
      _baseDest: ctx.dest,
      _classif: ctx.classif,
      _ciaId: this.selCiaId
    };

    // Preenche colunas de serviço
    this.svcCols.forEach(col => {
      row[col] = '';
    });

    this.selectedServices.forEach(s => {
      if (s.label && row.hasOwnProperty(s.label)) {
        row[s.label] = s.slaUpload;
        row['Responsavel ' + s.label] = s.apac;
        row['_contratual_' + s.label] = s.slaContratual;
      }
    });

    this.rows.push(row);
    this.recomputeDuplicates();
    this.showToast(`✈ Voo ${number} (${ctx.base} → ${ctx.dest}) adicionado!`, 'success');
    this.resetForNext();
  }

  public recomputeDuplicates(): void {
    this.duplicates = this.duplicateService.computeDuplicates(
      this.rows,
      this.svcCols,
      this.githubService.malhaIndex
    );
  }

  public getActiveServiceCols(row: FlightRow): string[] {
    return this.svcCols.filter(
      c => !c.startsWith('Responsavel') && row[c] !== '' && row[c] !== undefined
    );
  }

  public isRowDup(i: number): boolean {
    return !!(this.duplicates[i] && this.duplicates[i].hasAny);
  }

  public isServiceDup(i: number, col: string): boolean {
    return !!(this.duplicates[i] && this.duplicates[i].services && this.duplicates[i].services[col]);
  }

  public getServiceTip(i: number, col: string): string | null {
    const sd = this.duplicates[i]?.services?.[col];
    return sd ? this.duplicateService.buildTooltip(sd) : null;
  }

  // ── INICIAIS DO COLABORADOR ──
  public getInitials(name: string): string {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/).filter(p => p.length > 2);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  // ── PARSER DE ROTA ──
  public isArrival(row: FlightRow): boolean {
    const dest = String(row._baseDest || '').toUpperCase();
    const classif = String(row._classif || '').toUpperCase();
    return dest.includes('-') || classif.includes('CHEGADA');
  }

  public getFlightNumber(row: FlightRow): string {
    const t = row['TÍTULO'] || '';
    const parts = t.split('_');
    return parts.length > 1 ? parts[1] : '---';
  }

  public getRowTitle(row: FlightRow): string {
    return row['TÍTULO'] || '';
  }

  // ── FILTROS & BUSCA ──
  public get filteredRows(): FilteredRowItem[] {
    const q = this.searchTerm.trim().toLowerCase();
    return this.rows
      .map((row, index) => ({ row, index }))
      .filter(item => {
        // Filtro por tipo
        if (this.activeFilter === 'partidas' && this.isArrival(item.row)) return false;
        if (this.activeFilter === 'chegadas' && !this.isArrival(item.row)) return false;
        if (this.activeFilter === 'alertas' && !this.isRowDup(item.index)) return false;

        // Filtro por busca
        if (!q) return true;
        const searchStr = `${item.row.TÍTULO} ${item.row['RESPONSÁVEL']} ${item.row['UNIDADE DE GESTÃO']} ${item.row._baseAtend} ${item.row._baseDest}`.toLowerCase();
        if (searchStr.includes(q)) return true;

        // Busca nos colaboradores
        return this.getActiveServiceCols(item.row).some(col => {
          const resp = (item.row['Responsavel ' + col] || '').toLowerCase();
          return resp.includes(q) || col.toLowerCase().includes(q);
        });
      });
  }

  // ── CLONAR / DUPLICAR VOO PARA ACELERAR DIGITAÇÃO ──
  public cloneRow(index: number): void {
    const row = this.rows[index];
    if (!row) return;

    this.inputDataVal = row._dataISO || '';
    this.inputHoraVal = row._horaISO || '';

    this.selectedServices = [];
    this.svcCols.forEach(col => {
      if (!col.startsWith('Responsavel') && row[col] !== undefined && row[col] !== '') {
        const resp = row['Responsavel ' + col] || '';
        this.addServicoItem(col, resp, false);
      }
    });

    this.showToast(`⎘ Dados do voo copiados para o formulário!`, 'info');
  }

  // ── COPIAR TÍTULO ──
  public copyTitle(title: string, event: MouseEvent): void {
    event.stopPropagation();
    navigator.clipboard.writeText(title);
    this.showToast(`Copiado: ${title}`, 'success');
  }

  // ── RESET ──
  public resetFrom(level: 'cia' | 'base' | 'destino'): void {
    if (level === 'cia') {
      this.selSupervisorName = '';
      this.autoSetorText = '—';
      this.availableBases = [];
      this.selBaseVal = '';
      this.inputBaseAtendVal = '';
      this.inputNumberVal = '';
      this.availableDestinos = [];
      this.selBaseDestVal = '';
      this.inputBaseDestVal = '';
      this.availableClassifs = [];
      this.selClassifVal = '';
      this.selectedServices = [];
    } else if (level === 'base') {
      this.inputNumberVal = '';
      this.availableDestinos = [];
      this.selBaseDestVal = '';
      this.inputBaseDestVal = '';
      this.availableClassifs = [];
      this.selClassifVal = '';
      this.selectedServices = [];
    } else if (level === 'destino') {
      if (!this.currentCiaData?._isOndemand) {
        this.availableClassifs = [];
        this.selClassifVal = '';
      }
      this.selectedServices = [];
    }
    this.updateTitulo();
  }

  public resetForNext(): void {
    if (this.currentCiaData?._isOndemand) {
      this.inputBaseAtendVal = '';
    } else {
      this.selBaseVal = '';
    }
    this.inputNumberVal = '';
    this.isBaseDestInput = false;
    this.selBaseDestVal = '';
    this.inputBaseDestVal = '';
    this.availableClassifs = [];
    this.selClassifVal = '';
    this.inputDataVal = '';
    this.inputHoraVal = '';
    this.selectedServices = [];
    this.updateTitulo();
  }

  // ── EDIÇÃO & EXCLUSÃO ──
  public editRow(index: number): void {
    const row = this.rows[index];
    if (!row) return;

    this.rows.splice(index, 1);
    this.recomputeDuplicates();

    const titulo = row.TÍTULO || '';
    const parts = titulo.split('_');
    if (parts.length < 4) {
      this.showToast('Não foi possível restaurar esta linha', 'error');
      return;
    }

    const base = parts[0];
    const number = parts[1];
    const dest = parts[2];
    const classif = parts.slice(3).join('_');

    const unidadeCfg = row._ciaId
      ? this.config?.unidades.find(u => u.id === row._ciaId)
      : this.config?.unidades.find(u => u.label === row['UNIDADE DE GESTÃO']);

    if (!unidadeCfg) {
      this.showToast('CIA não encontrada para edição', 'error');
      return;
    }

    this.selCiaId = unidadeCfg.id;
    this.onCiaChange();

    setTimeout(() => {
      this.selSupervisorName = row['RESPONSÁVEL'] || '';
      this.onSupervisorChange();

      if (this.isBaseAtendInput) {
        this.inputBaseAtendVal = base;
        this.onInputBaseAtend();
      } else {
        this.selBaseVal = base;
        this.onBaseChange();
      }

      setTimeout(() => {
        this.inputNumberVal = number;
        this.onInputNumber();

        if (this.isBaseDestInput) {
          this.inputBaseDestVal = dest;
          this.onInputBaseDest();
        } else {
          this.selBaseDestVal = dest;
          this.onBaseDestChange();
        }

        setTimeout(() => {
          this.selClassifVal = classif;
          this.onClassifChange();

          this.inputDataVal = row._dataISO || '';
          this.inputHoraVal = row._horaISO || '';

          this.selectedServices = [];
          this.svcCols.forEach(col => {
            if (!col.startsWith('Responsavel') && row[col] !== undefined && row[col] !== '') {
              const resp = row['Responsavel ' + col] || '';
              this.addServicoItem(col, resp, false);
            }
          });

          this.updateTitulo();
          this.showToast(`✎ Editando voo ${number}...`, 'info');
        }, 120);
      }, 120);
    }, 150);
  }

  public deleteRow(index: number): void {
    this.rows.splice(index, 1);
    this.recomputeDuplicates();
    this.showToast('Voo removido do lote', '');
  }

  public clearAll(): void {
    this.rows = [];
    this.recomputeDuplicates();
    this.isModalClearOpen = false;
    this.showToast('Lote de voos limpo com sucesso', '');
  }

  // ── EXPORTAÇÃO EXCEL ──
  public exportExcel(): void {
    try {
      const res = this.excelService.exportExcel(this.rows, this.allCols, this.slaCols);
      this.showToast(
        `✓ ${res.filename} gerado! ${res.rowsCount} voos prontos para carga no Maestro.`,
        'success'
      );
    } catch (e: any) {
      this.showToast(`Erro ao exportar: ${e.message}`, 'error');
    }
  }

  // ── TEMA ──
  public toggleTheme(): void {
    this.isDark = !this.isDark;
    document.documentElement.setAttribute('data-theme', this.isDark ? 'dark' : 'light');
  }

  // ── CONFIGURAÇÕES GITHUB ──
  public openSettings(): void {
    this.githubCreds = this.githubService.getCredentials();
    this.isSettingsModalOpen = true;
  }

  public onSaveSettings(newCreds: GitHubCredentials): void {
    this.githubService.saveCredentials(newCreds);
    this.githubCreds = newCreds;
    this.isSettingsModalOpen = false;
    this.showToast('Configurações salvas! Atualizando base...', 'success');
    this.loadAllData();
  }

  public onResetSettings(): void {
    this.githubService.resetCredentials();
    this.githubCreds = this.githubService.getCredentials();
    this.isSettingsModalOpen = false;
    this.showToast('Configurações padrão restauradas.', '');
    this.loadAllData();
  }

  // ── TOAST ──
  public showToast(msg: string, type = ''): void {
    this.toastMsg = msg;
    this.toastType = type;
    this.isToastShow = true;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.isToastShow = false;
    }, 3500);
  }

  // ── ALERTA DE SAÍDA ──
  @HostListener('window:beforeunload', ['$event'])
  public onBeforeUnload(e: BeforeUnloadEvent): void {
    if (this.rows.length > 0) {
      e.preventDefault();
      e.returnValue = '';
    }
  }
}
