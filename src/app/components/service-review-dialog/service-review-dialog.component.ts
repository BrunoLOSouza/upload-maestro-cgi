import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnDestroy, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ServiceReview } from '../../models/maestro.models';

@Component({
  selector: 'app-service-review-dialog',
  standalone: true,
  imports: [CommonModule],
  styleUrls: ['./service-review-dialog.component.css'],
  template: `
    <div class="review-overlay" (keydown)="onKeydown($event)">
      <section class="review-dialog" role="alertdialog" aria-modal="true"
        aria-labelledby="service-review-title" aria-describedby="service-review-description">
        <header class="review-header">
          <span class="review-eyebrow">CONFERÊNCIA DA ESCALA</span>
          <h2 id="service-review-title">Confirme os postos antes de adicionar o voo</h2>
          <p id="service-review-description">Foram encontradas diferenças em relação à programação da malha aérea. Confira com o APAC antes de clicar em OK.</p>
        </header>
        <div class="review-body">
          <article *ngIf="review.additional.length" class="review-warning review-additional">
            <h3>⚠️ POSTO NÃO PREVISTO</h3>
            <ul><li *ngFor="let name of review.additional">{{ name }}</li></ul>
            <p>Posto ADICIONAL que não consta na programação da malha aérea. É necessário confirmar com o APAC a justificativa para a inclusão de posto adicional, verificando o motivo pelo qual esse atendimento foi solicitado e se houve erro no pedido da solicitação.</p>
          </article>
          <article *ngIf="review.missing.length" class="review-warning review-missing">
            <h3>⚠️ POSTO PREVISTO AUSENTE</h3>
            <ul><li *ngFor="let name of review.missing">{{ name }}</li></ul>
            <p>O posto consta na programação da malha aérea, mas NÃO foi identificado no lançamento. É necessário confirmar com o APAC o motivo pelo qual esse atendimento não foi realizado, verificando se houve cancelamento, alteração na programação ou alguma outra justificativa para a ausência.</p>
          </article>
        </div>
        <footer class="review-actions">
          <p>O voo só será adicionado ao despacho após a confirmação.</p>
          <div>
            <button type="button" class="review-cancel" (click)="cancelled.emit()">Cancelar e revisar</button>
            <button type="button" class="review-confirm" (click)="confirmed.emit()">OK</button>
          </div>
        </footer>
      </section>
    </div>
  `
})
export class ServiceReviewDialogComponent implements AfterViewInit, OnDestroy {
  @Input() review!: ServiceReview;
  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
  private previousFocus: HTMLElement | null = null;
  constructor(private host: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    this.previousFocus = document.activeElement as HTMLElement | null;
    this.host.nativeElement.querySelector<HTMLButtonElement>('.review-cancel')?.focus();
  }

  ngOnDestroy(): void {
    // Wait for the background's inert attribute to be removed before restoring focus.
    const previous = this.previousFocus;
    setTimeout(() => { if (previous?.isConnected) previous.focus(); });
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); this.cancelled.emit();
    } else if (event.key === 'Tab') {
      const buttons = Array.from(this.host.nativeElement.querySelectorAll<HTMLButtonElement>('button'));
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }
}
