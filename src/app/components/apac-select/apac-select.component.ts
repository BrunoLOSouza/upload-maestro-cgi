import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-apac-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="apac-wrap" [class.open]="isOpen">
      <input
        #inputRef
        type="text"
        class="apac-input"
        [class.selected]="!!value"
        placeholder="Selecione o colaborador..."
        [value]="searchText"
        (focus)="openDropdown()"
        (input)="onInput($event)"
        (keydown)="onKeydown($event)"
        autocomplete="off"
        spellcheck="false"
      />
      <span class="apac-arrow" (click)="toggleDropdown()">▾</span>

      <div class="apac-dropdown" [class.open]="isOpen" #dropdownRef>
        <div
          *ngFor="let name of filteredOptions; let i = index"
          class="apac-option"
          [class.selected-opt]="name === value"
          [class.focused]="i === focusedIdx"
          (mousedown)="selectOption(name, $event)"
        >
          {{ name }}
        </div>
        <div *ngIf="filteredOptions.length === 0" class="apac-empty">
          Nenhum colaborador encontrado
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .apac-wrap {
        position: relative;
        width: 100%;
      }

      .apac-input {
        width: 100%;
        padding: 7px 28px 7px 9px;
        font-size: 13px;
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        color: var(--text);
        font-family: var(--font-sans);
        cursor: pointer;
        transition: border-color var(--transition), box-shadow var(--transition);
      }

      .apac-input:focus {
        outline: none;
        border-color: var(--accent);
        box-shadow: 0 0 0 2px var(--accent-dim);
      }

      .apac-input.selected {
        border-color: var(--accent);
        color: var(--text);
      }

      .apac-arrow {
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--text-muted);
        font-size: 10px;
        cursor: pointer;
        transition: transform var(--transition);
        user-select: none;
      }

      .apac-wrap.open .apac-arrow {
        transform: translateY(-50%) rotate(180deg);
      }

      .apac-dropdown {
        position: absolute;
        top: calc(100% + 3px);
        left: 0;
        right: 0;
        background: var(--surface-elevated);
        border: 1px solid var(--border-bright);
        border-radius: var(--radius);
        box-shadow: var(--shadow);
        z-index: 150;
        max-height: 200px;
        overflow-y: auto;
        display: none;
      }

      .apac-dropdown.open {
        display: block;
      }

      .apac-dropdown::-webkit-scrollbar {
        width: 4px;
      }

      .apac-dropdown::-webkit-scrollbar-thumb {
        background: var(--border-bright);
        border-radius: 2px;
      }

      .apac-option {
        padding: 7px 10px;
        font-size: 13px;
        color: var(--text);
        cursor: pointer;
        transition: background var(--transition);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .apac-option:hover,
      .apac-option.focused {
        background: var(--accent-dim);
        color: var(--accent);
      }

      .apac-option.selected-opt {
        color: var(--accent);
        font-weight: 600;
      }

      .apac-empty {
        padding: 8px 10px;
        font-size: 13px;
        color: var(--text-muted);
        font-style: italic;
      }
    `
  ]
})
export class ApacSelectComponent {
  @Input() options: string[] = [];
  @Input() set value(val: string) {
    this._value = val || '';
    this.searchText = val || '';
  }
  get value(): string {
    return this._value;
  }
  @Output() valueChange = new EventEmitter<string>();

  @ViewChild('inputRef') inputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('dropdownRef') dropdownRef!: ElementRef<HTMLDivElement>;

  private _value = '';
  public searchText = '';
  public isOpen = false;
  public focusedIdx = -1;

  public get filteredOptions(): string[] {
    if (!this.searchText) {
      return this.options;
    }
    const q = this.searchText.toLowerCase();
    return this.options.filter(o => o.toLowerCase().includes(q));
  }

  public openDropdown(): void {
    this.isOpen = true;
    this.focusedIdx = -1;
  }

  public toggleDropdown(): void {
    if (this.isOpen) {
      this.closeDropdown();
    } else {
      this.openDropdown();
      this.inputRef.nativeElement.focus();
    }
  }

  public closeDropdown(): void {
    this.isOpen = false;
    this.focusedIdx = -1;
    if (!this.options.includes(this.searchText)) {
      this.searchText = this.value;
    }
  }

  public onInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.searchText = val;
    this.isOpen = true;
    this.focusedIdx = -1;
  }

  public selectOption(name: string, event?: MouseEvent): void {
    if (event) {
      event.preventDefault();
    }
    this._value = name;
    this.searchText = name;
    this.valueChange.emit(name);
    this.closeDropdown();
  }

  public onKeydown(e: KeyboardEvent): void {
    const opts = this.filteredOptions;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.focusedIdx = Math.min(this.focusedIdx + 1, opts.length - 1);
      this.scrollFocusedIntoView();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.focusedIdx = Math.max(this.focusedIdx - 1, 0);
      this.scrollFocusedIntoView();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (this.focusedIdx >= 0 && opts[this.focusedIdx]) {
        this.selectOption(opts[this.focusedIdx]);
      }
    } else if (e.key === 'Escape') {
      this.closeDropdown();
    }
  }

  private scrollFocusedIntoView(): void {
    setTimeout(() => {
      const el = this.dropdownRef?.nativeElement?.querySelector('.apac-option.focused');
      if (el) {
        (el as HTMLElement).scrollIntoView({ block: 'nearest' });
      }
    }, 10);
  }

  @HostListener('document:click', ['$event'])
  public onDocumentClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (!target.closest('.apac-wrap')) {
      this.closeDropdown();
    }
  }
}
