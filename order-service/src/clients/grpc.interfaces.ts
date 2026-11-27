import { Observable } from 'rxjs';

export interface InventoryGrpcService {
  reserveStock(data: {
    orderId: string;
    productId: string;
    quantity: number;
  }): Observable<{
    success: boolean;
    reservationId: string;
    remainingStock: number;
  }>;

  releaseStock(data: {
    reservationId: string;
  }): Observable<{
    success: boolean;
    remainingStock?: number;
    message?: string;
  }>;
}

export interface PaymentResponse {
  id: string;
  orderId: string;
  amount: number;
  status: 'COMPLETED' | 'FAILED' | 'REFUNDED';
}

export interface PaymentGrpcService {
  charge(data: {
    orderId: string;
    amount: number;
  }): Observable<PaymentResponse>;

  refund(data: {
    orderId: string;
  }): Observable<PaymentResponse>;
}