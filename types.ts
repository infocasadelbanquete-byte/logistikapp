export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  STAFF = 'STAFF'
}

export type UserStatus = 'ACTIVE' | 'PENDING';

export interface User {
  id: string;
  name: string;
  username: string;
  password?: string;
  role: UserRole;
  status?: UserStatus;
  lastActive?: string;
  // Added security fields
  isLocked?: boolean;
  failedLoginAttempts?: number;
}

export interface Client {
  id: string;
  name: string;
  documentId: string;
  email: string;
  phone: string;
  mobilePhone?: string;
  contactPerson?: string;
  address: string;
}

export type InventoryType = 'PRODUCT' | 'SERVICE';
// Added PresentationType for inventory management
export type PresentationType = 'UNIT' | 'BOX';

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  replacementPrice?: number;
  stock: number;
  type: InventoryType;
  images: string[];
  code?: string;
  // Added extended inventory fields
  brand?: string;
  model?: string;
  presentationType?: PresentationType;
  quantityPerBox?: number;
  extraNotes?: string;
}

export enum EventStatus {
  QUOTE = 'QUOTE',
  CONFIRMED = 'CONFIRMADO',
  DISPATCHED = 'DESPACHADO',
  DELIVERED = 'ENTREGADO',
  PARTIAL_RETURN = 'RETIRO PARCIAL',
  FINISHED = 'FINALIZADO',
  CANCELLED = 'CANCELLED',
  // Added RETURNED status for backward compatibility or specific flows
  RETURNED = 'RETURNED'
}

export enum PaymentStatus {
  PAID = 'PAID',
  CREDIT = 'CREDIT',
  PARTIAL = 'PARTIAL'
}

export enum PaymentMethod {
  CASH = 'EFECTIVO',
  TRANSFER = 'TRANSFERENCIA',
  DEPOSIT = 'DEPOSITO',
  CHECK = 'CHEQUE'
}

export interface PaymentTransaction {
  id: string;
  receiptCode?: string;
  date: string;
  amount: number;
  method: PaymentMethod;
  recordedBy: string;
  orderNumber: number;
  // Added transaction metadata
  bankName?: string;
  isVoid?: boolean;
  voidReason?: string;
}

export interface EventOrder {
  id: string;
  orderNumber: number;
  clientId: string;
  clientName: string;
  orderDate: string;
  executionDate: string; 
  status: EventStatus;
  paymentStatus: PaymentStatus;
  paidAmount: number;
  total: number;
  items: Array<{ itemId: string; quantity: number; priceAtBooking: number }>;
  requiresDelivery?: boolean;
  deliveryCost?: number;
  deliveryAddress?: string;
  hasInvoice?: boolean;
  rentalDays?: number;
  discountPercentage?: number;
  discountType?: 'PERCENT' | 'VALUE';
  notes?: string;
  returnNotes?: string;
  // Added missing order properties
  transactions?: PaymentTransaction[];
  withheldAmount?: number;
  invoiceGenerated?: boolean;
  invoiceNumber?: string;
}

// Added missing global types used across services
export interface AppNotification {
  id: string;
  message: string;
  date: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING';
  isRead: boolean;
}

export interface CompanySettings {
  name: string;
  slogan: string;
  logoUrl: string;
}

export enum PurchaseDocType {
  INVOICE = 'FACTURA',
  RECEIPT = 'RECIBO',
  RISE = 'RISE'
}

export interface Provider {
  id: string;
  name: string;
  documentId: string;
  phone?: string;
  mobile?: string;
  email?: string;
}

export interface PurchaseTransaction {
  id: string;
  date: string;
  provider: Provider;
  details: string;
  docType: PurchaseDocType;
  docNumber: string;
  values: {
    subtotal15: number;
    subtotal0: number;
    subtotalRise: number;
    exemptVat: number;
    vat15: number;
    total: number;
  };
  payment: {
    method: string;
    bank?: string;
    institution?: string;
    accountNumber?: string;
    otherDetails?: string;
  };
}

export interface Withholding {
  id: string;
  date: string;
  docNumber: string;
  type: 'IVA' | 'RENTA';
  percentage: number;
  amount: number;
  clientId: string;
  beneficiary: string;
  relatedOrderId?: string;
  relatedDocNumber?: string;
}

export interface PayrollEntry {
  id: string;
  date: string;
  period: string;
  salaries: number;
  overtime: number;
  iess: number;
  bonuses: number;
  extraPay: number;
  totalDeductions: number;
  netPaid: number;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}
