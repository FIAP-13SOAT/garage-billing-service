import { AppError } from '../../../shared/errors/AppError.js';
import type { UUID } from '../../../shared/types/UUID.js';

export class QuoteNotFoundException extends AppError {
  constructor(id: UUID) {
    super(`Quote not found: ${id}`, 404);
  }
}
