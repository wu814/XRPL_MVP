"use client";

import { useParams } from "next/navigation";
import DisplayAmmDetails from "@/components/Amm/DisplayAmmDetails";

export default function AmmDetails() {
  const params = useParams();
  const address = params.ammAccount; // Get the AMM address from the URL

  return (
    <div className="p-2 ">
      <DisplayAmmDetails ammAccount={address} />
    </div>
  );
}
