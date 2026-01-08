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
  failedLoginAttempts?: number;
  isLocked?: boolean;
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

export interface Provider {
  id: string;
  name: string;
  documentId: string;
  email?: string;
  phone?: string;
  mobile?: string;
  address?: string;
}

export type InventoryType = 'PRODUCT' | 'SERVICE';
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
  brand?: string;
  model?: string;
  presentationType?: PresentationType;
  quantityPerBox?: number;
  uses?: string;
  extraNotes?: string;
}

export enum EventStatus {
  QUOTE = 'QUOTE',
  RESERVED = 'RESERVED',
  DELIVERED = 'DELIVERED',
  IN_PROGRESS = 'IN_PROGRESS',
  FINISHED = 'FINISHED',
  WITH_ISSUES = 'WITH_ISSUES',
  RETURNED = 'RETURNED',
  CANCELLED = 'CANCELLED'
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
  bankName?: string;
  recordedBy: string;
  orderNumber: number;
  isVoid?: boolean;
  voidReason?: string;
  notes?: string;
}

export interface MissingItem {
  itemId: string;
  itemName: string;
  missingQuantity: number;
  replacementCost: number;
}

export interface ReturnReport {
  date: string;
  observations: string;
  missingItems: MissingItem[];
  totalReplacementCost: number;
  reportedBy: string;
}

export interface EventOrder {
  id: string;
  orderNumber: number;
  clientId: string;
  clientName: string;
  title: string;
  orderDate: string;
  executionDate: string; 
  executionDates?: string[]; 
  status: EventStatus;
  cancelReason?: string;
  paymentStatus: PaymentStatus;
  paidAmount: number;
  withheldAmount?: number;
  transactions?: PaymentTransaction[];
  requiresDelivery?: boolean;
  deliveryCost?: number;
  deliveryAddress?: string;
  requiresWaiters?: boolean; 
  waitersCount?: number;
  waitersPrice?: number;
  hasInvoice?: boolean;
  invoiceGenerated?: boolean;
  invoiceNumber?: string;
  taxAmount?: number;
  rentalDays?: number;
  discountPercentage?: number; 
  discountType?: 'PERCENT' | 'VALUE'; 
  warehouseExitId?: string;
  originQuoteNumber?: number;
  dispatchedBy?: string;
  dispatchNotes?: string;
  items: Array<{ itemId: string; quantity: number; priceAtBooking: number }>;
  total: number;
  notes?: string;
  returnReport?: ReturnReport;
}

export enum PurchaseDocType {
  INVOICE = 'FACTURA',
  RECEIPT = 'NOTA DE VENTA',
  RISE = 'RISE',
  OTHER = 'OTRO'
}

export interface PurchaseTransaction {
  id: string;
  date: string;
  provider: {
    name: string;
    documentId: string;
    phone?: string;
    mobile?: string;
    email?: string;
  };
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
  relatedDocNumber: string; 
  relatedOrderId?: string;  
  beneficiary: string;      
  clientId: string;
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

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}