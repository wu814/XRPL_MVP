"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

interface LabelMap {
  [key: string]: string;
}

interface BreadcrumbsProps {
  customLabel?: string;
}

const labelMap: LabelMap = {
  trade: "Trade",
  amm: "Liquidity Pools",
  dex: "Order Book",
  smart: "Smart Trade",
  admin: "Wallet",
  user: "Wallet",
  profile: "Profile",
  settings: "Settings",
};

export default function Breadcrumbs({ customLabel }: BreadcrumbsProps) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean); // remove leading/trailing slashes

  const crumbs = segments.map((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/");
    const isLast = index === segments.length - 1;
    const label =
      isLast && customLabel
        ? customLabel
        : labelMap[segment] ||
          segment.charAt(0).toUpperCase() + segment.slice(1);

    return (
      <span key={href} className="flex items-center">
        {index > 0 && <span className="mx-2 text-border">{">"}</span>}
        <Link
          href={href}
          className={`hover:underline ${isLast ? "text-primary" : "text-mutedText"}`}
        >
          {label}
        </Link>
      </span>
    );
  });

  return (
    <nav className="mb-4 text-sm">
      <div className="flex items-center">
        <Link href="/" className="text-mutedText hover:underline"></Link>
        {crumbs}
      </div>
    </nav>
  );
};
