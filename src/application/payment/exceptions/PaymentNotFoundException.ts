import { AppError } from '../../../shared/errors/AppError.js';
import type { UUID } from '../../../shared/types/UUID.js';

export class PaymentNotFoundException extends AppError {
  constructor(id: UUID) {
    super(`Payment not found: ${id}`, 404);
  }
}
