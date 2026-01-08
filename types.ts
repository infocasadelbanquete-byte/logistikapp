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
  // Added properties for security and locking
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

// Added PresentationType enum
export enum PresentationType {
  UNIT = 'UNIT',
  BOX = 'BOX'
}

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
  // Added properties for inventory management
  presentationType?: PresentationType | 'UNIT' | 'BOX';
  quantityPerBox?: number;
}

export enum EventStatus {
  QUOTE = 'QUOTE',
  CONFIRMED = 'CONFIRMADO',
  DISPATCHED = 'DESPACHADO',
  DELIVERED = 'ENTREGADO',
  PARTIAL_RETURN = 'RETIRO PARCIAL',
  FINISHED = 'FINALIZADO',
  CANCELLED = 'CANCELLED',
  // Added RETURNED as used in ClientView.tsx
  RETURNED = 'RETORNADO'
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
  // Added properties for payment management
  isVoid?: boolean;
  voidReason?: string;
  bankName?: string;
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
  transactions?: PaymentTransaction[];
  // Added properties for accounting and invoicing
  withheldAmount?: number;
  invoiceGenerated?: boolean;
  invoiceNumber?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

// Added missing interfaces used in storageService and other views

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

export interface Provider {
  id: string;
  name: string;
  documentId: string;
  phone?: string;
  mobile?: string;
  email?: string;
}

export enum PurchaseDocType {
  INVOICE = 'FACTURA',
  RECEIPT = 'NOTA DE VENTA',
  LIQUIDATION = 'LIQUIDACION DE COMPRA'
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
  relatedOrderId: string;
  relatedDocNumber: string;
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