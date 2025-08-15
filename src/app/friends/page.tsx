"use client";
import DisplayPendingFriendRequests from "@/components/friend/DisplayPendingFriendRequests";
import DisplayFriends from "@/components/friend/DisplayFriends";
import ErrorMdl from "@/components/ErrorMdl";
import { useState } from "react";
import usePageTitle from "@/utils/usePageTitle";

export default function FriendsPage() {
  const [errorMessage, setErrorMessage] = useState("");

  // Set page title
  usePageTitle("Friends - YONA");

  return (
    <div className="p-2 min-h-screen bg-color1">
      {/* Friends Sections */}
      <div className="grid max-w-full grid-cols-1 gap-2 xl:grid-cols-2">
        <DisplayFriends />
        <DisplayPendingFriendRequests />
      </div>

      {errorMessage && (
        <ErrorMdl
          errorMessage={errorMessage}
          onClose={() => setErrorMessage("")}
        />
      )}
    </div>
  );
}
