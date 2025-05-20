export default function CurrencyIcon({
  symbol,
  heightClass = "h-6",
  widthClass = "w-6"
}) {

  if (!symbol) {
    return null;
  }
  const logoSrc = `/icons/${symbol}.svg`;
  return (
    <div className="text-md flex items-center gap-2 rounded-lg bg-[#3F4359] px-3 py-2 font-medium">
      <img src={logoSrc} alt={symbol} className={`${heightClass} ${widthClass}`} />
      <span>{symbol}</span>
    </div>
  );
}
