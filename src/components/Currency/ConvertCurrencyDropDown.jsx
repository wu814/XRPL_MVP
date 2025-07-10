import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { availableCurrencies } from "@/utils/xrpl/assets";

// Asset Selection Component for Convert Tab
export default function ConvertCurrencyDropDown({ asset, onSelect, label, availableAmount, currencies }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-color4 rounded-lg p-4 mb-3 relative">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`w-10 h-10 ${asset.color} rounded-full flex items-center justify-center text-white font-bold`}>
            <img
              src={asset.avatar}
              alt={asset.name}
              className="w-10 h-10 rounded-full"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'block';
              }}
            />
            <span style={{ display: 'none' }}>{asset.icon}</span>
          </div>
          <div>
            <div className="font-medium text-lg">{label}</div>
            <div className="">{asset.id}</div>
          </div>
        </div>
        {availableAmount && (
          <div className="text-right">
            <div className="font-medium text-lg">${availableAmount}</div>
            <div className="text-sm text-gray-400">Available</div>
          </div>
        )}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 hover:bg-color5 rounded transition-colors"
        >
          <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>
      
      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-3 left-0 right-0 bg-color2 border border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {currencies.map((currency) => (
            <button
              key={currency.id}
              type="button"
              onClick={() => {
                onSelect(currency.id);
                setIsOpen(false);
              }}
              className="w-full px-4 py-3 flex items-center space-x-3 hover:bg-color3 text-left transition-colors"
            >
              <img
                src={currency.avatar}
                alt={currency.name}
                className="w-6 h-6 rounded-full"
              />
              <span className="text-white font-medium">{currency.id}</span>
              <span className="text-gray-400 text-sm">- {currency.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
