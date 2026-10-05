import { Injectable } from '@angular/core';
import {
  AppConfig,
  Aviso,
  CiaData,
  ColunasConfig,
  GitHubCredentials,
  MalhaHistorica,
  ServicoDef,
  SlaConfig,
  Supervisor
} from '../models/maestro.models';

const STORAGE_KEY_CREDS = 'upload_maestro_github_creds';

const DEFAULT_CREDS: GitHubCredentials = {
  user: '',
  repo: '',
  token: ''
};

@Injectable({
  providedIn: 'root'
})
export class GithubService {
  private creds: GitHubCredentials = { ...DEFAULT_CREDS };

  public malhaIndex: Record<string, Map<string, Array<{ hora: string; servico: string }>> | null> = {};

  constructor() {
    this.loadSavedCredentials();
  }

  public getCredentials(): GitHubCredentials {
    return { ...this.creds };
  }

  public saveCredentials(newCreds: GitHubCredentials): void {
    this.creds = {
      user: newCreds.user.trim(),
      repo: newCreds.repo.trim(),
      token: newCreds.token.trim()
    };
    localStorage.setItem(STORAGE_KEY_CREDS, JSON.stringify(this.creds));
    this.malhaIndex = {}; // clear cache on creds change
  }

  public resetCredentials(): void {
    this.creds = { ...DEFAULT_CREDS };
    localStorage.removeItem(STORAGE_KEY_CREDS);
    this.malhaIndex = {};
  }

  private loadSavedCredentials(): void {
    const saved = localStorage.getItem(STORAGE_KEY_CREDS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.user && parsed.repo && parsed.token) {
          this.creds = parsed;
        }
      } catch (e) {
        console.warn('Erro ao ler credenciais salvas do GitHub, usando padrão.', e);
      }
    }
  }

  public isCustomCredentials(): boolean {
    return (
      this.creds.user !== DEFAULT_CREDS.user ||
      this.creds.repo !== DEFAULT_CREDS.repo ||
      this.creds.token !== DEFAULT_CREDS.token
    );
  }

  public async fetchJson<T>(filename: string): Promise<T> {
    if (this.isCustomCredentials()) {
      try {
        return await this.fetchFromGitHub<T>(filename);
      } catch (err) {
        console.warn(`Erro no GitHub personalizado, tentando carregar dados locais para ${filename}:`, err);
        return await this.fetchFromLocal<T>(filename);
      }
    } else {
      try {
        return await this.fetchFromLocal<T>(filename);
      } catch (localErr) {
        console.warn(`Arquivo local não encontrado (${filename}), tentando GitHub:`, localErr);
        return await this.fetchFromGitHub<T>(filename);
      }
    }
  }

  private async fetchFromLocal<T>(filename: string): Promise<T> {
    const res = await fetch(`assets/data/${filename}`);
    if (!res.ok) {
      throw new Error(`Arquivo local não encontrado: assets/data/${filename}`);
    }
    return res.json() as Promise<T>;
  }

  private async fetchFromGitHub<T>(filename: string): Promise<T> {
    const url = `https://api.github.com/repos/${this.creds.user}/${this.creds.repo}/contents/${filename}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Authorization': `Bearer ${this.creds.token}`,
          'Accept': 'application/vnd.github.v3.raw',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
    } catch (networkErr: any) {
      throw new Error(`Sem conexão ao buscar ${filename}. Verifique sua internet.`);
    }

    if (res.status === 401) throw new Error(`Token do GitHub inválido ou expirado (401).`);
    if (res.status === 403) throw new Error(`Acesso negado ao repositório ${this.creds.user}/${this.creds.repo} (403).`);
    if (res.status === 404) throw new Error(`Arquivo não encontrado no GitHub: ${filename} (404).`);
    if (!res.ok) throw new Error(`Erro ${res.status} ao buscar ${filename}.`);

    return res.json() as Promise<T>;
  }

  public async ensureMalhaMonth(ano: number, mes: number): Promise<Map<string, Array<{ hora: string; servico: string }>> | null> {
    const key = `${ano}_${String(mes).padStart(2, '0')}`;
    if (this.malhaIndex[key] !== undefined) {
      return this.malhaIndex[key];
    }

    try {
      const data = await this.fetchJson<MalhaHistorica>(`malha_lancada_${key}.json`);
      const map = new Map<string, Array<{ hora: string; servico: string }>>();
      (data.registros || []).forEach(r => {
        const k = `${(r.unidade || '').trim().toUpperCase()}|${r.base_atend}|${r.base_dest}|${r.tipo_atend}|${r.data}`;
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push({ hora: r.hora, servico: r.servico });
      });
      this.malhaIndex[key] = map;
      return map;
    } catch (e) {
      this.malhaIndex[key] = null;
      return null;
    }
  }

  public getMonthPair(): { ano: number; mes: number; anoAnt: number; mesAnt: number } {
    const now = new Date();
    const ano = now.getFullYear();
    const mes = now.getMonth() + 1;
    let anoAnt = ano;
    let mesAnt = mes - 1;
    if (mesAnt === 0) {
      mesAnt = 12;
      anoAnt = ano - 1;
    }
    return { ano, mes, anoAnt, mesAnt };
  }
}
