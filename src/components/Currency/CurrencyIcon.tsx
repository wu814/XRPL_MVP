
interface CurrencyIconProps {
  symbol?: string;
  heightClass?: string;
  widthClass?: string;
  iconBg?: string;
}

export default function CurrencyIcon({
  symbol,
  heightClass = "h-6",
  widthClass = "w-6",
  iconBg = "bg-color4",
}: CurrencyIconProps) {
  if (!symbol) {
    return (
      <div className="text-md flex animate-pulse items-center gap-2 rounded-lg bg-color4 px-3 py-2 font-medium">
        <div className={`${heightClass} ${widthClass} rounded-full bg-pulse`} />
        <div className="h-4 w-8 rounded-lg bg-pulse" />
      </div>
    );
  }
  
  const logoSrc = `/icons/${symbol}.png`;
  
  return (
    <div className={`text-md flex items-center gap-2 rounded-lg px-3 py-2 font-medium ${iconBg}`}>
      <img
        src={logoSrc}
        alt={symbol}
        className={`${heightClass} ${widthClass}`}
      />
      <span>{symbol}</span>
    </div>
  );
};
