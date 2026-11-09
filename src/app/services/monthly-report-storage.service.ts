import { Injectable } from '@angular/core';

export interface StoredMonthlyReport {
  version: 1;
  filename: string;
  importedAt: string;
  buffer: ArrayBuffer;
}

@Injectable({ providedIn: 'root' })
export class MonthlyReportStorageService {
  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') { reject(new Error('Armazenamento local indisponível.')); return; }
      const request = indexedDB.open('upload-maestro-monthly', 1);
      request.onupgradeneeded = () => { request.result.createObjectStore('reports'); };
      request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Armazenamento bloqueado por outra aba.'));
    });
  }

  private async transact<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('reports', mode);
      let result: T;
      const request = action(transaction.objectStore('reports'));
      request.onsuccess = () => { result = request.result; };
      transaction.oncomplete = () => { db.close(); resolve(result); };
      transaction.onabort = transaction.onerror = () => { db.close(); reject(transaction.error || request.error || new Error('Falha no armazenamento local.')); };
    });
  }

  public load(): Promise<StoredMonthlyReport | undefined> {
    return this.transact('readonly', store => store.get('current'));
  }

  public async save(report: StoredMonthlyReport): Promise<void> {
    await this.transact('readwrite', store => store.put(report, 'current'));
  }

  public async clear(): Promise<void> {
    await this.transact('readwrite', store => store.delete('current'));
  }
}
