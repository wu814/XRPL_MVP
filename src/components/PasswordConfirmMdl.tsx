"use client";

import { Loader2 } from "lucide-react";
import Button from "./Button";

interface PasswordConfirmMdlProps {
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  passwordValue: string;
  setPasswordValue: (value: string) => void;
}

export default function PasswordConfirmMdl({
  onClose,
  onConfirm,
  loading,
  passwordValue,
  setPasswordValue,
}: PasswordConfirmMdlProps) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40">
      <div className="w-96 rounded-lg bg-color3 p-6">
        <h2 className="mb-4 text-2xl text-cancel font-bold">Confirm Deletion</h2>
        <p className="mb-4">
          Enter your password to confirm deletion.
        </p>
        <input
          type="password"
          value={passwordValue}
          onChange={(e) => setPasswordValue(e.target.value)}
          className="bg-color4 mb-4 w-full rounded-lg border border-transparent p-2 hover:border-gray-500 focus:border-primary focus:outline-none"
          placeholder="Enter Password"
        />
        <div className="flex space-x-2">
          <Button variant="cancel" onClick={onClose} disabled={loading} className="flex-1">
            Cancel
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={loading} className="flex-1">
            {loading ? (
              <div className="flex items-center justify-center space-x-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Deleting...</span>
              </div>
            ) : (
              "Delete"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
