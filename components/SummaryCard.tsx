import React from 'react';

interface SummaryCardProps {
  title: string;
  amount: number;
  colorClass: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ title, amount, colorClass }) => {
  return (
    <div className="bg-white p-6 rounded-2xl shadow flex-1 text-center">
      <h3 className="text-sm font-normal text-gray-500">{title}</h3>
      <p className={`text-2xl font-semibold mt-2 ${colorClass}`}>
        {new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED' }).format(amount)}
      </p>
    </div>
  );
};

export default SummaryCard;