"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Button from "@/components/Button";
import ChangePasswordBtn from "@/components/setting/ChangePasswordBtn";
import usePageTitle from "@/utils/usePageTitle";

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const [username, setUsername] = useState("");
  
  // Set page title
  usePageTitle("Settings - YONA");

  useEffect(() => {
    if (status === "authenticated") {
      setUsername(session?.user?.username || "");
    }
  }, [session, status]);

  return (
    <div className="p-8">
      <div className="container mx-auto max-w-4xl">        
        <div className="grid gap-6">
          {/* User Information */}
          <div className="rounded-lg bg-color2 p-6">
            <h2 className="text-2xl font-semibold mb-4">User Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Username</label>
                <p className="text-lg">{username || "Not set"}</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <p className="text-lg">{session?.user?.email || "Not available"}</p>
              </div>
            </div>
          </div>

          {/* Account Settings */}
          <div className="rounded-lg bg-color2 p-6">
            <h2 className="text-2xl font-semibold mb-4">Account Settings</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded bg-color3">
                <div>
                  <h3 className="font-medium">Two-Factor Authentication</h3>
                  <p className="text-sm text-gray-300">Add an extra layer of security to your account</p>
                </div>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  Enable
                </Button>
              </div>
              
              <div className="flex items-center justify-between p-4 rounded bg-color3">
                <div>
                  <h3 className="font-medium">Email Notifications</h3>
                  <p className="text-sm text-gray-300">Receive updates about your transactions</p>
                </div>
                <Button className="bg-gray-600 hover:bg-gray-700">
                  Configure
                </Button>
              </div>
            </div>
          </div>

          {/* Security */}
          <div className="rounded-lg bg-color2 p-6">
            <h2 className="text-2xl font-semibold mb-4">Security</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded bg-color3">
                <div>
                  <h3 className="font-medium">Change Password</h3>
                  <p className="text-sm text-gray-300">Update your trading password</p>
                </div>
                <ChangePasswordBtn />
              </div>
              
              <div className="flex items-center justify-between p-4 rounded bg-color3">
                <div>
                  <h3 className="font-medium">Active Sessions</h3>
                  <p className="text-sm text-gray-300">Manage your active login sessions</p>
                </div>
                <Button className="bg-gray-600 hover:bg-gray-700">
                  View Sessions
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
