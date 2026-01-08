
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  STAFF = 'STAFF'
}

export type UserStatus = 'ACTIVO' | 'PENDIENTE';

export interface User {
  id: string;
  name: string;
  username: string;
  password?: string;
  role: UserRole;
  status?: UserStatus;
  lastActive?: string;
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
  presentationType?: PresentationType;
  quantityPerBox?: number;
}

export enum EventStatus {
  QUOTE = 'PROFORMA',
  CONFIRMED = 'CONFIRMADO',
  DISPATCHED = 'DESPACHADO',
  DELIVERED = 'ENTREGADO',
  IN_PROGRESS = 'EN DESARROLLO',
  TO_PICKUP = 'POR RETIRAR',
  PARTIAL_RETURN = 'INGRESO PARCIAL',
  FINISHED = 'FINALIZADO',
  CANCELLED = 'CANCELADO',
  RETURNED = 'RETORNADO'
}

export enum PaymentStatus {
  PAID = 'PAGADO',
  CREDIT = 'CRÉDITO',
  PARTIAL = 'PARCIAL'
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
  checkNumber?: string;
  accountNumber?: string;
  recordedBy: string;
  orderNumber: number;
  isVoid?: boolean;
}

export interface EventOrder {
  id: string;
  orderNumber: number;
  warehouseExitNumber?: number;
  clientId: string;
  clientName: string;
  orderDate: string;
  executionDate: string;
  endDate?: string;
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
  discountValue?: number;
  discountType?: 'PERCENT' | 'VALUE';
  notes?: string;
  returnNotes?: string;
  withheldAmount?: number;
  transactions?: PaymentTransaction[];
  invoiceNumber?: string;
  invoiceGenerated?: boolean;
}

export enum PurchaseDocType {
  INVOICE = 'FACTURA',
  RECEIPT = 'NOTA DE VENTA',
  LIQUIDATION = 'LIQUIDACION'
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
  providerName: string;
  providerId: string;
  docNumber: string;
  total: number;
  details: string;
  provider: Provider;
  docType: PurchaseDocType;
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

export interface WithholdingLine {
  type: 'IVA' | 'RENTA';
  percentage: number;
  amount: number;
}

export interface Withholding {
  id: string;
  date: string;
  docNumber: string;
  clientId: string;
  beneficiary: string;
  relatedOrderId: string;
  lines: WithholdingLine[];
  amount: number;
}

export interface PayrollEntry {
  id: string;
  month: string;
  date: string;
  employeeName: string;
  salaries: number;
  suplementaryHours: number;
  extraHours: number;
  netPaid: number;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}
