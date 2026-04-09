import { AppError } from '../../../shared/errors/AppError.js';
import { PaymentStatus } from '../PaymentStatus.js';

export class PaymentCannotBeCancelledException extends AppError {
  constructor(currentStatus: PaymentStatus) {
    super(`Payment cannot be cancelled: current status is ${currentStatus}`, 409);
  }
}
