export type ViewType = 'Actual' | 'Budgeted' | 'Variance';
export type PeriodType = 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';
export type PaymentMethod = 'Bank Transfer' | 'Cheque' | 'Facility' | 'Credit Card' | 'PDC';
export type EntryType = 'inflow' | 'outflow';

export interface Payment {
  id: string;
  amount: number;
  method: PaymentMethod;
  details?: string;
  chequeNumber?: string;
  transactionId?: string;
}

export interface CellData {
  payments: Payment[];
}

export interface DayData {
  date: string; // YYYY-MM-DD
  openingBalance: number;
  bankFacility: {
    taken: number;
    limit: number;
  };
  data: {
    [rowId: string]: CellData;
  };
}

export interface PDC {
  id: string;
  chequeNumber: string;
  supplier: string;
  date: string;
  amount: number;
  details: string;
}

export interface RowConfig {
  id: string;
  name: string;
  type: EntryType;
  isTotal?: boolean;
  children?: RowConfig[];
}

export interface DragItem {
  dayIndex: number;
  rowId: string;
  payment: Payment;
  sourceDate: string;
}