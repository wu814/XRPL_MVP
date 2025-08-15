"use client";

import { useParams } from "next/navigation";
import DisplayAMMDetails from "@/components/amm/DisplayAMMDetails";
import usePageTitle from "@/utils/usePageTitle";

export default function AMMDetails() {
  const params = useParams();
  const address = params.ammAccount as string; // Get the AMM address from the URL
  
  // Set page title
  usePageTitle("Pool Details - YONA");

  return (
    <div className="p-2 ">
      <DisplayAMMDetails account={address} />
    </div>
  );
}
