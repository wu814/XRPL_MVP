"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Navbar from "@/components/Navbar";

export default function ProfilePage() {
  const params = useParams();
  const userID = params.userID; // Get the userID from the URL
  const [userData, setUserData] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const [pendingRequests, setPendingRequests] = useState([]);
  const [pendingError, setPendingError] = useState("");

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

  const fetchPendingFriendRequests = async () => {
    try {
      const res = await fetch("/api/friends/getPendingFriendRequests");
      if (!res.ok) throw new Error("Failed to fetch pending requests");
      const result = await res.json();
      setPendingRequests(result.data);
    } catch (error) {
      setPendingError(error.message || "Failed to fetch pending requests");
    }
  };

  useEffect(() => {
    fetchUserData();
    fetchPendingFriendRequests();
  }, [userID]);

  return (
    <div className="min-h-screen">
      <Navbar username={userData?.username} />
      <div className="flex justify-center p-4">
        {errorMessage && <p className="text-red-500">{errorMessage}</p>}
        {userData ? (
          <div>
            <h1 className="mb-4 text-2xl font-bold">{userData.username}</h1>
            <p>Email Address: {userData.email_address}</p>
            <p>Joined at: {userData.created_at}</p>
            {/* Add more user details as needed */}
          </div>
        ) : (
          <p>Loading user data...</p>
        )}
      </div>
      <div className="flex flex-row justify-around p-4 space-x-4">
        <div>
          <h2>Friends</h2>
        </div>
        <div className="">
          <h2 className="mb-2 text-xl font-semibold">Pending Friend Requests</h2>
          {pendingError && <p className="text-red-500">{pendingError}</p>}
          {pendingRequests.length === 0 ? (
            <p className="text-gray-400">No pending requests.</p>
          ) : (
            <ul className="space-y-4">
              {pendingRequests.map((req) => (
                <li key={req.id} className="rounded-md bg-color2 p-4 shadow">
                  <p className="font-medium">
                    From: {req.users?.username || "Unknown"}
                  </p>
                  <p>Email: {req.users?.email}</p>
                  <p>Sent at: {new Date(req.sent_at).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
