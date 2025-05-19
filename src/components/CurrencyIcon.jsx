export default function CurrencyIcon({ symbol }) {
  const logoSrc = `/icons/${symbol}.svg`;
  return (
    <div className="text-md flex items-center gap-2 rounded-xl bg-[#3F4359] px-4 py-2 font-medium">
      <img src={logoSrc} alt={symbol} className="h-6 w-6" />
      <span>{symbol}</span>
    </div>
  );
}
