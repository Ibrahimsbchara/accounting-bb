import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { DayData, ViewType, PeriodType, PDC, Payment, DragItem, RowConfig, CellData } from './types';
import { TABLE_STRUCTURE } from './constants';
import CashFlowTable from './components/CashFlowTable';
import SummaryCard from './components/SummaryCard';
import PdcModal from './components/PdcModal';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from './components/icons';

const generateInitialData = (baseDate: Date, numDays: number): DayData[] => {
    const data: DayData[] = [];
    let openingBalance = 50000;
    const bankFacilityLimit = 200000;
    let bankFacilityTaken = 50000;

    for (let i = 0; i < numDays; i++) {
        const date = new Date(baseDate);
        date.setDate(baseDate.getDate() + i);
        const dateString = date.toISOString().split('T')[0];
        
        const dayData: DayData = {
            date: dateString,
            openingBalance,
            bankFacility: { limit: bankFacilityLimit, taken: bankFacilityTaken },
            data: {},
        };
        
        const initializeCells = (rows: RowConfig[]) => {
            rows.forEach(r => {
                if (r.children) initializeCells(r.children);
                else if (!r.isTotal) dayData.data[r.id] = { payments: [] };
            });
        }
        initializeCells(TABLE_STRUCTURE);

        data.push(dayData);
    }
    
    // Recalculate opening balances for the whole set
    for (let i = 1; i < data.length; i++) {
        const prevDay = data[i - 1];
        const prevInflow = Object.keys(prevDay.data).filter(k => k.startsWith('inflow_')).reduce((sum, key) => sum + (prevDay.data[key]?.payments.reduce((s, p) => s + p.amount, 0) || 0), 0);
        const prevOutflow = Object.keys(prevDay.data).filter(k => k.startsWith('outflow_')).reduce((sum, key) => sum + (prevDay.data[key]?.payments.reduce((s, p) => s + p.amount, 0) || 0), 0);
        data[i].openingBalance = prevDay.openingBalance + prevInflow - prevOutflow;
    }
    return data;
};

const App: React.FC = () => {
    const [view, setView] = useState<ViewType>('Actual');
    const [period, setPeriod] = useState<PeriodType>('Daily');
    const [startDate, setStartDate] = useState(new Date());
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [isPdcModalOpen, setIsPdcModalOpen] = useState(false);
    
    const [actualData, setActualData] = useState<DayData[]>(() => {
        try {
            const savedData = localStorage.getItem('cashflow_actualData');
            return savedData ? JSON.parse(savedData) : generateInitialData(new Date(), 365);
        } catch (error) {
            console.error("Failed to load actual data from localStorage", error);
            return generateInitialData(new Date(), 365);
        }
    });
    const [budgetedData, setBudgetedData] = useState<DayData[]>(() => {
         try {
            const savedData = localStorage.getItem('cashflow_budgetedData');
            return savedData ? JSON.parse(savedData) : generateInitialData(new Date(), 365);
        } catch (error) {
            console.error("Failed to load budgeted data from localStorage", error);
            return generateInitialData(new Date(), 365);
        }
    });

    useEffect(() => {
        try {
             localStorage.setItem('cashflow_actualData', JSON.stringify(actualData));
        } catch (error) {
            console.error("Failed to save actual data to localStorage", error);
        }
    }, [actualData]);

     useEffect(() => {
        try {
            localStorage.setItem('cashflow_budgetedData', JSON.stringify(budgetedData));
        } catch (error) {
            console.error("Failed to save budgeted data to localStorage", error);
        }
    }, [budgetedData]);


    const mockPDCs: PDC[] = [
        { id: '1', chequeNumber: '00123', supplier: 'Supplier A', date: '2024-08-15', amount: 5000, details: 'Invoice #INV-101' },
        { id: '2', chequeNumber: '00124', supplier: 'Supplier B', date: '2024-09-01', amount: 12500, details: 'Invoice #INV-205' },
    ];
    
    const setData = view === 'Budgeted' ? setBudgetedData : setActualData;

    const updateData = useCallback((dateStr: string, rowId: string, newPayments: Payment[]) => {
        const payment = newPayments.length > 0 ? newPayments[0] : null;
        const isSupplierCCPayment = rowId.startsWith('outflow_supplier_') && payment?.method === 'Credit Card';
        const transactionId = payment?.id;

        setData(currentData => {
            // FIX: Explicitly type `newData` as DayData[] to prevent type inference issues with JSON.parse.
            const newData: DayData[] = JSON.parse(JSON.stringify(currentData)); // Deep copy to avoid mutation issues

            const findOrCreateDay = (targetDateStr: string) => {
                let dayIndex = newData.findIndex(d => d.date === targetDateStr);
                if (dayIndex !== -1) {
                    return { day: newData[dayIndex], index: dayIndex };
                }
                
                const newDay: DayData = {
                    date: targetDateStr,
                    openingBalance: 0,
                    bankFacility: { limit: 200000, taken: 50000 },
                    data: {},
                };
                 const initializeCells = (rows: RowConfig[]) => {
                    rows.forEach(r => {
                        if (r.children) initializeCells(r.children);
                        else if (!r.isTotal) newDay.data[r.id] = { payments: [] };
                    });
                }
                initializeCells(TABLE_STRUCTURE);
                newData.push(newDay);
                newData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                dayIndex = newData.findIndex(d => d.date === targetDateStr);
                return { day: newData[dayIndex], index: dayIndex };
            };
            
            // First, remove any old linked payments related to this transaction ID
            if (transactionId) {
                newData.forEach(day => {
                   Object.values(day.data).forEach(cell => {
                       cell.payments = cell.payments.filter(p => p.transactionId !== transactionId);
                   });
                });
            }
            
            const { day: targetDay, index: targetIndex } = findOrCreateDay(dateStr);
            targetDay.data[rowId] = { payments: newPayments.map(p => ({...p, transactionId: isSupplierCCPayment ? transactionId : undefined })) };
            
            if (isSupplierCCPayment && payment && transactionId) {
                // Add Card Support Inflow on the same day
                const { day: supportDay } = findOrCreateDay(dateStr);
                const supportCell = supportDay.data['inflow_card_support'] || { payments: [] };
                supportDay.data['inflow_card_support'] = {
                    payments: [...supportCell.payments, { ...payment, id: crypto.randomUUID(), transactionId }]
                };

                // Add future Credit Card Repayment
                const repaymentDate = new Date(dateStr);
                repaymentDate.setDate(repaymentDate.getDate() + 60);
                const repaymentDateStr = repaymentDate.toISOString().split('T')[0];
                const repaymentAmount = payment.amount * 1.018;

                const { day: repaymentDay } = findOrCreateDay(repaymentDateStr);
                const repaymentCell = repaymentDay.data['outflow_loan_cc_repay'] || { payments: [] };
                repaymentDay.data['outflow_loan_cc_repay'] = {
                    payments: [...repaymentCell.payments, {
                        id: crypto.randomUUID(), amount: repaymentAmount, method: 'Credit Card', transactionId
                    }]
                };
            }
            
            // Recalculate all opening balances from the start
            if (newData.length > 0) {
                 const firstDayBalance = newData[0].openingBalance; // Preserve the very first opening balance
                 for (let i = 1; i < newData.length; i++) {
                    const prevDay = newData[i - 1];
                    // FIX: Removed unused and buggy calculations for prevInflow and prevOutflow.
                    // The correct logic is already present in the subsequent inflowTotal/outflowTotal calculations.
                    
                    const inflowTotal = Object.entries(prevDay.data)
                        .filter(([key]) => key.startsWith('inflow_'))
                        .reduce((sum, [, cell]) => sum + cell.payments.reduce((s, p) => s + p.amount, 0), 0);

                    const outflowTotal = Object.entries(prevDay.data)
                        .filter(([key]) => key.startsWith('outflow_'))
                        .reduce((sum, [, cell]) => sum + cell.payments.reduce((s, p) => s + p.amount, 0), 0);

                    newData[i].openingBalance = prevDay.openingBalance + inflowTotal - outflowTotal;
                }
            }
           
            return newData;
        });
        setLastUpdated(new Date());
    }, [setData]);
    
    const movePayment = useCallback((source: DragItem, destDate: string, destRowId: string) => {
       setData(currentData => {
           // FIX: Explicitly type `newData` as DayData[] to prevent type inference issues with JSON.parse.
           const newData: DayData[] = JSON.parse(JSON.stringify(currentData));
           const sourceDayIndex = newData.findIndex(d => d.date === source.sourceDate);
           const destDayIndex = newData.findIndex(d => d.date === destDate);

           if(sourceDayIndex === -1 || destDayIndex === -1) return newData;

            if (source.payment.transactionId) {
                alert("Moving credit card payments with linked transactions is not fully supported and may cause inconsistencies.");
            }

           const sourceDay = newData[sourceDayIndex];
           sourceDay.data[source.rowId].payments = sourceDay.data[source.rowId].payments.filter(p => p.id !== source.payment.id);

           const destDay = newData[destDayIndex];
           const destCell = destDay.data[destRowId] ? destDay.data[destRowId] : { payments: [] };
           destCell.payments.push(source.payment);
           destDay.data[destRowId] = destCell;
           
            for (let i = 1; i < newData.length; i++) {
                const prevDay = newData[i - 1];
                 const inflowTotal = Object.entries(prevDay.data)
                    .filter(([key]) => key.startsWith('inflow_'))
                    .reduce((sum, [, cell]) => sum + cell.payments.reduce((s, p) => s + p.amount, 0), 0);
                const outflowTotal = Object.entries(prevDay.data)
                    .filter(([key]) => key.startsWith('outflow_'))
                    .reduce((sum, [, cell]) => sum + cell.payments.reduce((s, p) => s + p.amount, 0), 0);
                newData[i].openingBalance = prevDay.openingBalance + inflowTotal - outflowTotal;
            }
           return newData;
       });
       setLastUpdated(new Date());
    }, [setData]);

    const periodData = useMemo(() => {
        const sourceData = view === 'Budgeted' ? budgetedData : actualData;
        if (!sourceData || sourceData.length === 0) return [];
        
        // FIX: Explicitly type `periods` as DayData[] to ensure correct type inference downstream.
        const periods: DayData[] = [];
        let currentDate = new Date(startDate);
        currentDate.setHours(0, 0, 0, 0);

        for (let i = 0; i < 7; i++) {
            let periodStart, periodEnd;
            if (period === 'Daily') {
                periodStart = new Date(currentDate);
                periodStart.setDate(currentDate.getDate() + i);
                periodEnd = new Date(periodStart);
            } else if (period === 'Weekly') {
                const dayOfWeek = currentDate.getDay();
                const weekStartOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust to make Monday the start of the week
                periodStart = new Date(currentDate);
                periodStart.setDate(currentDate.getDate() + weekStartOffset + (i * 7));
                periodEnd = new Date(periodStart);
                periodEnd.setDate(periodStart.getDate() + 6);
            } else { // Monthly & Yearly
                 periodStart = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
                 periodEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + i + 1, 0);
            }
            
            const daysInPeriod = sourceData.filter(d => {
                const dayDate = new Date(d.date);
                dayDate.setUTCHours(12); // Normalize to avoid timezone issues
                return dayDate >= periodStart && dayDate <= periodEnd;
            });
            
            const firstDayOfPeriod = sourceData.find(d => {
                const dayDate = new Date(d.date);
                dayDate.setUTCHours(12);
                return dayDate >= periodStart;
            });

            const openingBalance = firstDayOfPeriod?.openingBalance ?? 0;
            const aggregatedData: { [rowId: string]: CellData } = {};

            const initializeCells = (rows: RowConfig[]) => {
                rows.forEach(r => {
                    if (r.children) initializeCells(r.children);
                    else if (!r.isTotal) aggregatedData[r.id] = { payments: [] };
                });
            }
            initializeCells(TABLE_STRUCTURE);

            daysInPeriod.forEach(day => {
                for (const rowId in day.data) {
                    if (aggregatedData[rowId]) {
                         aggregatedData[rowId].payments.push(...day.data[rowId].payments);
                    }
                }
            });

            periods.push({
                date: periodStart.toISOString().split('T')[0],
                openingBalance: openingBalance,
                bankFacility: daysInPeriod[0]?.bankFacility || { limit: 200000, taken: 50000 },
                data: aggregatedData
            });
        }
        return periods;

    }, [view, period, startDate, actualData, budgetedData]);

    const { totalInflow, totalOutflow, endOfDayBalance, facilityRemaining } = useMemo(() => {
        const firstPeriod = periodData[0];
        if (!firstPeriod) return { totalInflow: 0, totalOutflow: 0, endOfDayBalance: 0, facilityRemaining: 0 };

        const totalInflow = Object.keys(firstPeriod.data).filter(k => k.startsWith('inflow_')).reduce((sum, key) => sum + (firstPeriod.data[key]?.payments.reduce((s, p) => s + p.amount, 0) || 0), 0);
        const totalOutflow = Object.keys(firstPeriod.data).filter(k => k.startsWith('outflow_')).reduce((sum, key) => sum + (firstPeriod.data[key]?.payments.reduce((s, p) => s + p.amount, 0) || 0), 0);
        const endOfDayBalance = firstPeriod.openingBalance + totalInflow - totalOutflow;
        const facilityRemaining = firstPeriod.bankFacility.limit - firstPeriod.bankFacility.taken;
        
        return { totalInflow, totalOutflow, endOfDayBalance, facilityRemaining };

    }, [periodData]);
    
    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newStartDate = new Date(e.target.value);
        newStartDate.setUTCHours(12); // Normalize
        setStartDate(newStartDate);
    };

    const changePeriod = (amount: number) => {
        const newDate = new Date(startDate);
        if (period === 'Daily') newDate.setDate(startDate.getDate() + amount);
        else if (period === 'Weekly') newDate.setDate(startDate.getDate() + (amount * 7));
        else if (period === 'Monthly') newDate.setMonth(startDate.getMonth() + amount);
        else newDate.setFullYear(startDate.getFullYear() + amount);
        setStartDate(newDate);
    };

    return (
        <div className="max-w-screen-2xl mx-auto p-4 sm:p-6 lg:p-8 text-slate-800 text-[0.9rem]">
            <PdcModal isOpen={isPdcModalOpen} onClose={() => setIsPdcModalOpen(false)} pdcs={mockPDCs} />

            <header className="mb-6">
                <div className="flex flex-col md:flex-row justify-between md:items-center">
                    <h1 className="text-2xl font-semibold text-gray-900 capitalize">{`${period} Cash Flow`}</h1>
                    <div className="text-xs text-gray-500 mt-1 md:mt-0 font-normal">
                        Last updated: {lastUpdated.toLocaleString()}
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-4">
                    <div className="flex items-center bg-white shadow-sm rounded-lg border border-gray-200">
                         <button onClick={() => changePeriod(-1)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-l-lg"><ChevronLeftIcon className="h-5 w-5" /></button>
                         <div className="relative">
                            <input 
                                type="date"
                                value={startDate.toISOString().split('T')[0]}
                                onChange={handleDateChange}
                                className="pl-3 pr-8 py-1.5 text-sm border-l border-r border-gray-200 focus:ring-blue-500 focus:border-blue-500 font-normal"
                            />
                            <CalendarIcon className="h-5 w-5 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                        <button onClick={() => changePeriod(1)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-r-lg"><ChevronRightIcon className="h-5 w-5" /></button>
                    </div>

                    <div className="flex items-center bg-gray-100 p-1 rounded-lg">
                        {(['Daily', 'Weekly', 'Monthly', 'Yearly'] as PeriodType[]).map(p => (
                            <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1 text-sm rounded-md font-normal ${period === p ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}>{p}</button>
                        ))}
                    </div>
                    
                     <div className="flex items-center bg-gray-100 p-1 rounded-lg">
                        {(['Actual', 'Budgeted', 'Variance'] as ViewType[]).map(v => (
                            <button key={v} onClick={() => setView(v)} className={`px-3 py-1 text-sm rounded-md font-normal ${view === v ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}>{v}</button>
                        ))}
                    </div>
                    
                    <button onClick={() => setIsPdcModalOpen(true)} className="px-3 py-1.5 text-sm bg-white border border-gray-200 shadow-sm rounded-lg text-gray-700 hover:bg-gray-100 font-normal">
                        View PDCs
                    </button>
                </div>
            </header>

            <main>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                    <SummaryCard title="Total Inflow" amount={totalInflow} colorClass="text-emerald-500" />
                    <SummaryCard title="Total Outflow" amount={totalOutflow} colorClass="text-rose-500" />
                    <SummaryCard title="Balance (End of Period)" amount={endOfDayBalance} colorClass={endOfDayBalance >= 0 ? "text-sky-500" : "text-rose-500"} />
                    <SummaryCard title="Bank Facility Remaining" amount={facilityRemaining} colorClass="text-violet-500" />
                </div>
                
                <div className="bg-white rounded-2xl shadow overflow-hidden">
                    <CashFlowTable
                        data={periodData}
                        view={view}
                        period={period}
                        updateData={updateData}
                        movePayment={movePayment}
                    />
                </div>
            </main>
        </div>
    );
};

export default App;