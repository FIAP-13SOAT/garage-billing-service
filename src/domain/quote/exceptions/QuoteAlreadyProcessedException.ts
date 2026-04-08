import { AppError } from '../../../shared/errors/AppError.js';
import { QuoteStatus } from '../QuoteStatus.js';

export class QuoteAlreadyProcessedException extends AppError {
  constructor(currentStatus: QuoteStatus) {
    super(`Quote cannot be modified: current status is ${currentStatus}`, 409);
  }
}
