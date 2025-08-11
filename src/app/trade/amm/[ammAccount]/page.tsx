"use client";

import { useParams } from "next/navigation";
import DisplayAmmDetails from "@/components/Amm/DisplayAmmDetails";
import usePageTitle from "@/utils/usePageTitle";

export default function AmmDetails() {
  const params = useParams();
  const address = params.ammAccount as string; // Get the AMM address from the URL
  
  // Set page title
  usePageTitle("Pool Details - YONA");

  return (
    <div className="p-2 ">
      <DisplayAmmDetails ammAccount={address} />
    </div>
  );
}
