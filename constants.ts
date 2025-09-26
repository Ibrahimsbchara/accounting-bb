import { RowConfig } from './types';

export const TABLE_STRUCTURE: RowConfig[] = [
  { id: 'inflow', name: 'Cash Inflow', type: 'inflow', children: [
    { id: 'inflow_direct', name: 'Direct', type: 'inflow' },
    { id: 'inflow_third_party', name: 'Third-Party', type: 'inflow' },
    { id: 'inflow_corporate', name: 'Corporate', type: 'inflow' },
    { id: 'inflow_bank_facility', name: 'Bank Facility Drawdown', type: 'inflow' },
    { id: 'inflow_card_support', name: 'Card Support (Delayed)', type: 'inflow' },
  ]},
  { id: 'outflow', name: 'Cash Outflow (Expenses)', type: 'outflow', children: [
    { id: 'outflow_loan', name: 'Loan & Credit Card', type: 'outflow', children: [
      { id: 'outflow_loan_bankA', name: 'Bank A Loan', type: 'outflow' },
      { id: 'outflow_loan_cc_repay', name: 'Credit Card Repayment', type: 'outflow' },
    ]},
    { id: 'outflow_supplier', name: 'Supplier Payments', type: 'outflow', children: [
      { id: 'outflow_supplier_1', name: 'Supplier A', type: 'outflow' },
      { id: 'outflow_supplier_2', name: 'Supplier B', type: 'outflow' },
    ]},
    { id: 'outflow_office', name: 'Office Expenses', type: 'outflow', children: [
        { id: 'outflow_office_rent', name: 'Rent', type: 'outflow' },
        { id: 'outflow_office_utilities', name: 'Utilities', type: 'outflow' },
    ]},
    { id: 'outflow_payroll', name: 'Payroll', type: 'outflow', children: [
        { id: 'outflow_payroll_salaries', name: 'Salaries', type: 'outflow' },
    ]},
    { id: 'outflow_gov', name: 'Government Expenses', type: 'outflow', children: [
        { id: 'outflow_gov_taxes', name: 'Taxes', type: 'outflow' },
    ]},
    { id: 'outflow_marketing', name: 'Marketing Expenses', type: 'outflow', children: [
        { id: 'outflow_marketing_ads', name: 'Online Ads', type: 'outflow' },
    ]},
  ]},
];