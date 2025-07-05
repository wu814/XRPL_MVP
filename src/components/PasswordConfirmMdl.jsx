"use client";

import React from "react";
import Button from "./Button";

export default function PasswordConfirmMdl({
  onClose,
  onConfirm,
  loading,
  passwordValue,
  setPasswordValue,
}) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40">
      <div className="w-96 rounded-lg bg-color4 p-6">
        <h2 className="mb-4 text-2xl text-cancel font-bold">Confirm Deletion</h2>
        <p className="mb-4">
          Enter your password to confirm deletion.
        </p>
        <input
          type="password"
          value={passwordValue}
          onChange={(e) => setPasswordValue(e.target.value)}
          className="bg-color6 mb-4 w-full rounded-lg border border-transparent p-2 hover:border-primary focus:border-primary focus:outline-none"
          placeholder="Enter Password"
        />
        <div className="flex space-x-2">
          <Button variant="cancel" onClick={onClose} disabled={loading} className="flex-1">
            Cancel
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={loading} className="flex-1">
            {loading ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>
    </div>
  );
}
