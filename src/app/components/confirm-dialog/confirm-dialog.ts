import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Модальное окно подтверждения опасного действия.
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialog {
  readonly message = input.required<string>();

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();
}
