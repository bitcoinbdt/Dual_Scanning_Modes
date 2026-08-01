/**
 * Types for Manual Credit Purchase System
 */

export interface PaymentMethod {
  id: string;
  name: string;
  network: string | null;
  address: string;
  qr_code_url: string | null;
  instructions: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreditPurchaseRequest {
  id: string;
  user_id: string;
  credit_package_id: string;
  credits_amount: number;
  price_usd?: number | null;  // Not stored in DB — kept for UI display only
  payment_method_id: string;
  transaction_hash: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreditPurchaseRequestWithDetails extends CreditPurchaseRequest {
  user_email?: string;
  payment_method_name?: string;
  payment_network?: string;
}

export interface CreatePaymentMethodInput {
  name: string;
  network?: string;
  address: string;
  qr_code_url?: string;
  instructions?: string;
  is_active?: boolean;
  display_order?: number;
}

export interface UpdatePaymentMethodInput extends Partial<CreatePaymentMethodInput> {
  id: string;
}

export interface CreateCreditRequestInput {
  credit_package_id: string;
  credits_amount: number;
  price_usd?: number;  // Not stored in DB
  payment_method_id: string;
  transaction_hash: string;
}

export interface ReviewCreditRequestInput {
  id: string;
  status: 'approved' | 'rejected';
  admin_notes?: string;
}
