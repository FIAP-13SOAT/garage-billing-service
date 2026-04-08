import { AppError } from '../../../shared/errors/AppError.js';
import { PaymentStatus } from '../PaymentStatus.js';

export class PaymentAlreadyProcessedException extends AppError {
  constructor(currentStatus: PaymentStatus) {
    super(`Payment cannot be modified: current status is ${currentStatus}`, 409);
  }
}
