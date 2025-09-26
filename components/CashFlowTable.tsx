import React, { useState, useMemo } from 'react';
import { DayData, RowConfig, ViewType, Payment, DragItem, PaymentMethod, PeriodType } from '../types';
import { TABLE_STRUCTURE } from '../constants';
import { ChevronDownIcon } from './icons';

interface CashFlowTableProps {
  data: DayData[];
  view: ViewType;
  period: PeriodType;
  updateData: (date: string, rowId: string, newPayments: Payment[]) => void;
  movePayment: (source: DragItem, destDate: string, destRowId: string) => void;
}

interface EditingCell {
  date: string;
  rowId: string;
}

interface Tooltip {
    content: string;
    x: number;
    y: number;
}

const paymentMethodColors: Record<PaymentMethod, string> = {
    'Bank Transfer': 'text-sky-600',
    'Cheque': 'text-teal-600',
    'Facility': 'text-violet-600',
    'Credit Card': 'text-amber-600',
    'PDC': 'text-yellow-600',
};

const formatCurrency = (value: number) => {
    if (value === 0) return <span className="text-gray-400">-</span>;
    return new Intl.NumberFormat('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}).format(value);
};

const getWeekOfMonth = (date: Date) => {
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const dayOfMonth = date.getDate();
    const dayOfWeek = startOfMonth.getDay();
    return Math.ceil((dayOfMonth + dayOfWeek) / 7);
}

const formatDateHeader = (dateStr: string, period: PeriodType): string => {
    const date = new Date(dateStr);
    date.setUTCHours(12); // Avoid timezone issues
    if (period === 'Daily') {
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
    }
    if (period === 'Weekly') {
        const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
        const week = getWeekOfMonth(date);
        return `${month} WEEK ${week}`;
    }
    if (period === 'Monthly') {
        return date.toLocaleDateString('en-US', { month: 'long' }).toUpperCase();
    }
    if (period === 'Yearly') {
        return date.getFullYear().toString();
    }
    return dateStr;
}

const CashFlowTable: React.FC<CashFlowTableProps> = ({ data: displayData, view, period, updateData, movePayment }) => {
    const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
    const [editValue, setEditValue] = useState<string>('');
    const [dragOverCell, setDragOverCell] = useState<EditingCell | null>(null);
    const [tooltip, setTooltip] = useState<Tooltip | null>(null);
    const [collapsedRows, setCollapsedRows] = useState<Set<string>>(new Set(['outflow']));

    const getCollapsibleRowIds = (rows: RowConfig[]): string[] => {
        let ids: string[] = [];
        rows.forEach(row => {
            if (row.children) {
                ids.push(row.id);
                ids = ids.concat(getCollapsibleRowIds(row.children));
            }
        });
        return ids;
    };
    const allCollapsibleIds = useMemo(() => getCollapsibleRowIds(TABLE_STRUCTURE), []);

    const handleCollapseAll = () => setCollapsedRows(new Set(allCollapsibleIds));
    const handleExpandAll = () => setCollapsedRows(new Set());
    
    const toggleRowCollapse = (rowId: string) => {
        setCollapsedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(rowId)) {
                newSet.delete(rowId);
            } else {
                newSet.add(rowId);
            }
            return newSet;
        });
    };

    const getCellTotal = (day: DayData, rowId: string) => {
        return day.data[rowId]?.payments.reduce((sum, p) => sum + p.amount, 0) || 0;
    };
    
    const getCategoryTotal = useMemo(() => {
        const cache = new Map<string, number>();
        const calculate = (day: DayData, row: RowConfig): number => {
            const cacheKey = `${day.date}-${row.id}`;
            if(cache.has(cacheKey)) return cache.get(cacheKey)!;

            if (!row.children) {
                const total = getCellTotal(day, row.id);
                cache.set(cacheKey, total);
                return total;
            }
            const total = row.children.reduce((sum, child) => sum + calculate(day, child), 0);
            cache.set(cacheKey, total);
            return total;
        };
        return calculate;
    }, []);

    const handleCellDoubleClick = (date: string, rowId: string) => {
        if (view === 'Variance') return;
        const day = displayData.find(d => d.date === date);
        if(!day) return;
        
        const total = getCellTotal(day, rowId);
        setEditingCell({ date, rowId });
        setEditValue(total !== 0 ? String(total) : '');
    };

    const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEditValue(e.target.value);
    };

    const saveEdit = () => {
        if (!editingCell) return;
        const { date, rowId } = editingCell;
        const amount = parseFloat(editValue) || 0;
        
        const method = rowId.startsWith('outflow_supplier_') ? 'Credit Card' : 'Bank Transfer';

        const newPayments: Payment[] = amount > 0 ? [{
            id: crypto.randomUUID(),
            amount: amount,
            method: method
        }] : [];

        updateData(date, rowId, newPayments);
        setEditingCell(null);
    };

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            saveEdit();
        } else if (e.key === 'Escape') {
            setEditingCell(null);
        }
    };
    
    const handleDragStart = (e: React.DragEvent, sourceDate: string, rowId: string, payment: Payment, dayIndex: number) => {
        const dragItem: DragItem = { dayIndex, rowId, payment, sourceDate };
        e.dataTransfer.setData('application/json', JSON.stringify(dragItem));
    };

    const handleDragOver = (e: React.DragEvent, date: string, rowId: string) => {
        e.preventDefault();
        setDragOverCell({ date, rowId });
    };
    
    const handleDrop = (e: React.DragEvent, destDate: string, destRowId: string) => {
        e.preventDefault();
        const dragItem: DragItem = JSON.parse(e.dataTransfer.getData('application/json'));
        movePayment(dragItem, destDate, destRowId);
        setDragOverCell(null);
    };
    
    const handleMouseEnter = (e: React.MouseEvent, payment: Payment) => {
        setTooltip({
            content: `Payment: ${payment.method}`,
            x: e.clientX,
            y: e.clientY
        });
    };

    const handleMouseLeave = () => {
        setTooltip(null);
    };

    const renderRows = (rows: RowConfig[], level: number): JSX.Element[] => {
        let visibleRows: JSX.Element[] = [];
        for (const row of rows) {
            const isCollapsible = !!row.children;
            const isCollapsed = collapsedRows.has(row.id);
             const isMainCategory = level === 0;

            visibleRows.push(
                <tr key={row.id} className="border-b border-gray-200">
                    <td 
                        style={{ paddingLeft: `${0.75 + (isCollapsible ? level * 1.25 : (level * 1.25) + 0.5 )}rem` }} 
                        className={`px-3 py-2.5 whitespace-nowrap sticky left-0 z-10 w-64 min-w-[16rem] max-w-[16rem] flex items-center select-none bg-white`}
                    >
                        {isCollapsible && (
                             <ChevronDownIcon 
                                className={`h-4 w-4 mr-1.5 text-gray-500 cursor-pointer transition-transform transform shrink-0 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}
                                onClick={() => toggleRowCollapse(row.id)}
                             />
                        )}
                        <span 
                            className={`flex-grow ${isCollapsible ? 'cursor-pointer' : ''} ${isMainCategory ? 'font-semibold' : 'font-normal'}`}
                            onClick={() => isCollapsible && toggleRowCollapse(row.id)}
                        >
                            {row.name}
                        </span>
                    </td>
                    {displayData.map((day) => {
                        const isEditing = editingCell?.date === day.date && editingCell?.rowId === row.id;
                        const isDropTarget = !isCollapsible && !row.children && view !== 'Variance';
                        const isDragOver = dragOverCell?.date === day.date && dragOverCell?.rowId === row.id;
                        
                        // Main category rows display totals
                        if (isMainCategory) {
                             const total = getCategoryTotal(day, row);
                             const colorClass = row.type === 'inflow' ? 'text-emerald-600' : 'text-rose-600';
                            return (
                                <td key={`${day.date}-${row.id}`} className="px-3 py-2.5 text-right border-l border-gray-200 tabular-nums min-w-[9rem]">
                                    <span className={`font-semibold ${total !== 0 ? colorClass : 'text-gray-400'}`}>{formatCurrency(total)}</span>
                                </td>
                            );
                        }
                        
                        const cellPayments = day.data[row.id]?.payments || [];

                        return (
                            <td 
                                key={`${day.date}-${row.id}`} 
                                className={`px-3 py-2.5 text-right border-l border-gray-200 tabular-nums min-w-[9rem] transition-colors duration-150 h-[45px] ${isDragOver ? 'outline-dashed outline-2 outline-offset-[-2px] outline-blue-400 bg-blue-50' : ''}`}
                                onDoubleClick={() => !isCollapsible && !isEditing && handleCellDoubleClick(day.date, row.id)}
                                onDragOver={(e) => isDropTarget && handleDragOver(e, day.date, row.id)}
                                onDragLeave={() => setDragOverCell(null)}
                                onDrop={(e) => isDropTarget && handleDrop(e, day.date, row.id)}
                            >
                                {isEditing ? (
                                    <input
                                        type="number"
                                        value={editValue}
                                        onChange={handleEditChange}
                                        onBlur={saveEdit}
                                        onKeyDown={handleInputKeyDown}
                                        className="w-full text-right bg-white border border-blue-500 rounded px-1 font-semibold"
                                        autoFocus
                                    />
                                ) : (
                                    <div className="w-full h-full font-semibold">
                                        { cellPayments.map(p => {
                                            let amountColorClass = '';
                                            if (view === 'Variance') {
                                                amountColorClass = p.amount < 0 ? 'text-rose-600' : p.amount > 0 ? 'text-emerald-600' : 'text-gray-500';
                                            } else if (row.type === 'inflow') {
                                                amountColorClass = row.id === 'inflow_card_support' ? 'text-orange-500' : 'text-emerald-600';
                                            } else {
                                                amountColorClass = paymentMethodColors[p.method] ?? 'text-gray-800';
                                            }

                                            return (
                                                <div 
                                                    key={p.id}
                                                    draggable={!isCollapsible && view !== 'Variance'}
                                                    onDragStart={(e) => handleDragStart(e, day.date, row.id, p, 0)}
                                                    onMouseEnter={(e) => handleMouseEnter(e, p)}
                                                    onMouseLeave={handleMouseLeave}
                                                    className={`h-full ${!isCollapsible && view !== 'Variance' ? 'cursor-grab' : ''}`}
                                                >
                                                    <span className={amountColorClass}>
                                                        {formatCurrency(p.amount)}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                        { cellPayments.length === 0 && (
                                            <span className='text-gray-400 font-semibold'>-</span>
                                        )}
                                    </div>
                                )}
                            </td>
                        );
                    })}
                </tr>
            );
            
            if (isCollapsible && !isCollapsed && row.children) {
                visibleRows.push(...renderRows(row.children, level + 1));
            }
        }
        return visibleRows;
    };
    
    const endOfDayBalances = useMemo(() => {
        const inflowConfig = TABLE_STRUCTURE.find(r => r.id === 'inflow');
        const outflowConfig = TABLE_STRUCTURE.find(r => r.id === 'outflow');
        if (!inflowConfig || !outflowConfig) return [];
        
        return displayData.map(day => {
            const totalInflow = getCategoryTotal(day, inflowConfig);
            const totalOutflow = getCategoryTotal(day, outflowConfig);
            return day.openingBalance + totalInflow - totalOutflow;
        });
    }, [displayData, getCategoryTotal]);

    return (
        <>
             {tooltip && (
                <div
                    className="fixed z-50 px-3 py-1.5 text-xs font-normal text-white bg-gray-800 rounded-md shadow-lg"
                    style={{ top: tooltip.y + 15, left: tooltip.x + 15 }}
                >
                    {tooltip.content}
                </div>
            )}
            <div className="p-2 border-b border-gray-200 flex items-center gap-2 sticky left-0 z-20 bg-white">
                <button onClick={handleCollapseAll} className="px-3 py-1 text-xs bg-gray-100 border border-gray-200 rounded-md text-gray-600 hover:bg-gray-200 font-normal">Collapse All</button>
                <button onClick={handleExpandAll} className="px-3 py-1 text-xs bg-gray-100 border border-gray-200 rounded-md text-gray-600 hover:bg-gray-200 font-normal">Expand All</button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                    <thead className="text-xs text-gray-500">
                        <tr className='border-b-2 border-gray-200'>
                            <th className="px-3 py-3 sticky left-0 bg-white z-20 w-64 min-w-[16rem] max-w-[16rem] font-semibold text-left">CATEGORY</th>
                            {displayData.map(day => (
                                <th key={day.date} className="px-3 py-3 min-w-[9rem] border-l border-gray-200 font-semibold text-right">{formatDateHeader(day.date, period)}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-b border-gray-200">
                            <td className="px-3 py-2.5 font-semibold sticky left-0 bg-white z-10 w-64 min-w-[16rem] max-w-[16rem]">Opening Balance</td>
                            {displayData.map((day) => (
                                <td key={`${day.date}-ob`} className="px-3 py-2.5 text-right border-l border-gray-200 font-semibold tabular-nums min-w-[9rem]">{formatCurrency(day.openingBalance)}</td>
                            ))}
                        </tr>
                        {renderRows(TABLE_STRUCTURE, 0)}
                        <tr className="bg-gray-50 border-t-2 border-gray-300">
                            <td className="px-3 py-2.5 font-semibold sticky left-0 bg-gray-50 z-10 w-64 min-w-[16rem] max-w-[16rem]">Balance (End of Day)</td>
                            {endOfDayBalances.map((balance, index) => (
                                <td key={`${displayData[index].date}-eod`} className={`px-3 py-2.5 text-right border-l border-gray-200 font-semibold tabular-nums min-w-[9rem] ${balance < 0 ? 'text-rose-600' : ''}`}>{formatCurrency(balance)}</td>
                            ))}
                        </tr>
                    </tbody>
                </table>
            </div>
        </>
    );
};

export default CashFlowTable;