"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Navbar from "@/components/Navigation/Navbar";
import DisplayPendingFriendRequests from "@/components/Friend/DisplayPendingFriendRequests";
import DisplayFriends from "@/components/Friend/DisplayFriends";
import ErrorMdl from "@/components/ErrorMdl";

export default function ProfilePage() {
  const [username, setUsername] = useState("");
  
  const params = useParams();
  const userID = params.userID; // Get the userID from the URL

  const [userData, setUserData] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchUserData = async () => {
    try {
      const res = await fetch("/api/users/getUserByUserID");
      if (!res.ok) throw new Error("Failed to fetch user data");
      const result = await res.json();
      setUserData(result.data);
    } catch (error) {
      setErrorMessage(error.message || "Failed to fetch user data");
    }
  };

  useEffect(() => {
    fetchUserData();
  }, [userID]);

  return (
    <div className="min-h-screen">
      <Navbar username={userData?.username} />
      <div className="mb-4 flex justify-center p-4 text-center">
        {userData ? (
          <div>
            <h1 className="mb-4 text-2xl font-bold">{userData.username}</h1>
            <p>Email Address: {userData.email_address}</p>
            <p>Joined at: {userData.created_at}</p>
          </div>
        ) : (
          <p>Loading user data...</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-8 px-6">
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
