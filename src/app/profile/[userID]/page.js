"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Navbar from "@/components/Navbar";

export default function ProfilePage() {
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
    <div className="min-h-screen bg-color1 text-white">
      <Navbar />
      <div className="container mx-auto p-4">
        {errorMessage && <p className="text-red-500">{errorMessage}</p>}
        {userData ? (
          <div>
            <h1 className="text-2xl font-bold mb-4">{userData.username}</h1>
            <p>Email Address: {userData.email_address}</p>
            <p>Joined at: {userData.created_at}</p>
            {/* Add more user details as needed */}
          </div>
        ) : (
          <p>Loading user data...</p>
        )}
      </div>
    </div>
  );
}