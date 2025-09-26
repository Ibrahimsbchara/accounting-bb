import React from 'react';
import { PDC } from '../types';

interface PdcModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdcs: PDC[];
}

const PdcModal: React.FC<PdcModalProps> = ({ isOpen, onClose, pdcs }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold">Post-Dated Cheques (PDCs)</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl leading-none">&times;</button>
        </div>
        <div className="p-4 overflow-y-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-xs text-gray-700 uppercase">
              <tr>
                <th scope="col" className="px-4 py-2 font-semibold">Cheque No.</th>
                <th scope="col" className="px-4 py-2 font-semibold">Supplier</th>
                <th scope="col" className="px-4 py-2 font-semibold">Date</th>
                <th scope="col" className="px-4 py-2 font-semibold">Amount</th>
                <th scope="col" className="px-4 py-2 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody>
              {pdcs.length > 0 ? pdcs.map(pdc => (
                <tr key={pdc.id} className="bg-white border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-4 py-2 font-normal">{pdc.chequeNumber}</td>
                  <td className="px-4 py-2 font-normal">{pdc.supplier}</td>
                  <td className="px-4 py-2 font-normal">{pdc.date}</td>
                  <td className="px-4 py-2 text-right font-normal tabular-nums">{new Intl.NumberFormat('en-US').format(pdc.amount)}</td>
                  <td className="px-4 py-2 font-normal">{pdc.details}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="text-center py-4 text-gray-500">No PDCs issued.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 text-sm font-normal"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PdcModal;