import { ChevronDown } from "lucide-react";
import { YONACurrency } from "@/utils/currencyUtils";

interface SendCurrencyDropDownProps {
  value: string;
  onChange: (value: string) => void;
  currencies: YONACurrency[];
  className?: string;
  isOpen: boolean;
  onToggle: (dropdownId: string | null) => void;
  dropdownId: string;
}

export default function SendCurrencyDropDown({ 
  value, 
  onChange, 
  currencies, 
  className = "", 
  isOpen, 
  onToggle, 
  dropdownId 
}: SendCurrencyDropDownProps) {
  const selectedCurrency = currencies.find(c => c.id === value) || currencies[0];

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => onToggle(dropdownId)}
        className="w-full bg-color3 border border-transparent rounded-lg px-4 py-3 flex items-center justify-between hover:border-gray-500 focus:border-primary outline-none"
      >
        <div className="flex items-center space-x-3">
          <img
            src={selectedCurrency.avatar}
            alt={selectedCurrency.name}
            className="w-6 h-6 rounded-full"
          />
          <span className="text-white font-medium">{selectedCurrency.id}</span>
        </div>
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-color2 border border-gray-600 rounded-lg shadow-lg overflow-y-auto">
          {currencies.map((currency) => (
            <button
              key={currency.id}
              type="button"
              onClick={() => {
                onChange(currency.id);
                onToggle(null);
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
};
