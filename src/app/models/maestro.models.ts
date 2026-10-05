export interface UnidadeConfig {
  id: string;
  label: string;
  arquivos: string[];
}

export interface AppConfig {
  unidades: UnidadeConfig[];
  campos_fixos: {
    EMPRESA: string;
    EXECUTOR: string;
    CATEGORIA: string;
    PRIORIDADE: string;
    DISCIPLINA: string;
    GRUPO_SERVICO: string;
    SERVICO: string;
  };
}

export interface SupervisorUnidade {
  unidade: string;
  setor: string;
}

export interface Supervisor {
  responsavel: string;
  unidades: SupervisorUnidade[];
  setor_ondemand?: string;
}

export interface ServicoDef {
  label: string;
}

export interface Aviso {
  texto?: string;
  text?: string;
  data?: string;
  date?: string;
}

export interface ColunasConfig {
  fixed_cols: string[];
}

export interface SlaChave {
  sla_upload: number;
  sla_contratual: number;
}

export interface SlaConfig {
  chaves: Record<string, SlaChave>;
}

export interface Rota {
  base_atend: string;
  base_dest?: string;
  classificacao: string;
  _destino_tipo?: string;
}

export interface Subtipo {
  classificacao: string;
  label: string;
}

export interface CiaData {
  rotas: Rota[];
  destino_tipo?: string;
  subtipos?: Subtipo[];
}

export interface MalhaRegistro {
  unidade: string;
  base_atend: string;
  base_dest: string;
  tipo_atend: string;
  data: string;
  hora: string;
  servico: string;
}

export interface MalhaHistorica {
  registros: MalhaRegistro[];
}

export interface SlaResult {
  sla_upload: number;
  sla_contratual: number;
  origem: 'manual' | 'programado' | 'fallback_chegada' | 'fallback';
  legend: string;
}

export interface SelectedService {
  label: string;
  apac: string;
  slaUpload: number;
  slaContratual: number;
  legend: string;
  locked?: boolean;
}

export interface ServiceDuplicateDetail {
  external: boolean;
  sessionWith: Array<{ idx: number; titulo: string }>;
}

export interface RowDuplicateInfo {
  hasAny: boolean;
  services: Record<string, ServiceDuplicateDetail>;
}

export interface FlightRow {
  EMPRESA: string;
  'UNIDADE DE GESTÃO': string;
  EXECUTOR: string;
  'SETOR RESPONSÁVEL': string;
  RESPONSÁVEL: string;
  'CATEGORIA ': string;
  PRIORIDADE: string;
  TÍTULO: string;
  DESCRIÇÃO: string;
  DISCIPLINA: string;
  'GRUPO DE SERVIÇO': string;
  SERVIÇO: string;
  SITE: string;
  'SLA DATA': string;
  'SLA HORA': string;
  _dataISO: string;
  _horaISO: string;
  _unidadeKey: string;
  _baseAtend: string;
  _baseDest: string;
  _classif: string;
  _ciaId: string;
  [key: string]: any;
}

export interface GitHubCredentials {
  user: string;
  repo: string;
  token: string;
}
