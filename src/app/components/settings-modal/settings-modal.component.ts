import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GitHubCredentials } from '../../models/maestro.models';

@Component({
  selector: 'app-settings-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" [class.open]="isOpen">
      <div class="modal">
        <div class="modal-header">
          <h2>⚙️ Configuração do Repositório GitHub</h2>
          <button class="btn-close" (click)="close()">✕</button>
        </div>
        <p class="modal-desc">
          Aqui você pode conectar o seu próprio repositório do GitHub com os arquivos JSON de malha aérea.
          Os dados serão salvos com segurança no armazenamento local do seu navegador.
        </p>

        <div class="field">
          <label class="field-label">Usuário / Organização do GitHub</label>
          <input
            type="text"
            [(ngModel)]="creds.user"
            placeholder="Ex: seu-usuario"
            class="modal-input"
          />
        </div>

        <div class="field">
          <label class="field-label">Nome do Repositório</label>
          <input
            type="text"
            [(ngModel)]="creds.repo"
            placeholder="Ex: malha-aerea-upload"
            class="modal-input"
          />
        </div>

        <div class="field">
          <label class="field-label">Personal Access Token (GitHub PAT)</label>
          <input
            type="password"
            [(ngModel)]="creds.token"
            placeholder="github_pat_..."
            class="modal-input"
          />
          <span class="field-help">Necessário para repositórios privados ou limite de requisições.</span>
        </div>

        <div class="modal-actions">
          <button class="btn btn-ghost" (click)="onReset()">Restaurar Padrão</button>
          <button class="btn btn-primary" (click)="onSave()">Salvar e Recarregar</button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.65);
        backdrop-filter: blur(4px);
        z-index: 300;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s;
      }

      .modal-overlay.open {
        opacity: 1;
        pointer-events: all;
      }

      .modal {
        background: var(--surface);
        border: 1px solid var(--border-bright);
        border-radius: var(--radius-lg);
        padding: 24px;
        width: 480px;
        max-width: calc(100vw - 32px);
        box-shadow: var(--shadow);
        transform: scale(0.95);
        transition: transform 0.2s;
      }

      .modal-overlay.open .modal {
        transform: scale(1);
      }

      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }

      .modal-header h2 {
        font-size: 16px;
        color: var(--text);
        font-weight: 600;
      }

      .btn-close {
        background: transparent;
        border: none;
        color: var(--text-muted);
        font-size: 16px;
        cursor: pointer;
        padding: 4px;
        border-radius: var(--radius);
        transition: color var(--transition);
      }

      .btn-close:hover {
        color: var(--text);
      }

      .modal-desc {
        font-size: 12.5px;
        color: var(--text-dim);
        margin-bottom: 16px;
        line-height: 1.5;
      }

      .field {
        margin-bottom: 12px;
      }

      .field-label {
        display: block;
        font-size: 12px;
        font-weight: 500;
        color: var(--text-dim);
        margin-bottom: 4px;
      }

      .modal-input {
        width: 100%;
        padding: 8px 11px;
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        color: var(--text);
        font-family: var(--font-sans);
        font-size: 13px;
        transition: border-color var(--transition);
      }

      .modal-input:focus {
        outline: none;
        border-color: var(--accent);
      }

      .field-help {
        display: block;
        font-size: 11px;
        color: var(--text-muted);
        margin-top: 3px;
      }

      .modal-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
        margin-top: 20px;
      }

      .btn {
        padding: 8px 14px;
        border-radius: var(--radius);
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        border: none;
        transition: all var(--transition);
      }

      .btn-ghost {
        background: var(--bg);
        color: var(--text-dim);
        border: 1px solid var(--border);
      }

      .btn-ghost:hover {
        border-color: var(--border-bright);
        color: var(--text);
      }

      .btn-primary {
        background: var(--accent);
        color: var(--accent-text);
        font-weight: 600;
      }

      .btn-primary:hover {
        filter: brightness(1.1);
      }
    `
  ]
})
export class SettingsModalComponent {
  @Input() isOpen = false;
  @Input() creds: GitHubCredentials = { user: '', repo: '', token: '' };
  @Output() closeEvent = new EventEmitter<void>();
  @Output() saveEvent = new EventEmitter<GitHubCredentials>();
  @Output() resetEvent = new EventEmitter<void>();

  public close(): void {
    this.closeEvent.emit();
  }

  public onSave(): void {
    this.saveEvent.emit({ ...this.creds });
  }

  public onReset(): void {
    this.resetEvent.emit();
  }
}
