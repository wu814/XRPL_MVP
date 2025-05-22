"use client";

import { useParams } from "next/navigation";
import DisplayAmmDetails from "@/components/Amm/DisplayAmmDetails";

export default function AmmDetails() {
  const params = useParams();
  const address = params.ammAddress; // Get the AMM address from the URL

  return (
    <div>
      <DisplayAmmDetails ammAddress={address} />
    </div>
  );
}
