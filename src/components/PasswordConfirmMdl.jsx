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
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/10">
      <div className="w-96 rounded-lg bg-[#3F4359] p-6 shadow-lg">
        <h2 className="mb-4 text-center text-xl font-bold">Confirm Deletion</h2>
        <p className="mb-4 text-center">
          Please enter your password to confirm deletion.
        </p>
        <input
          type="password"
          value={passwordValue}
          onChange={(e) => setPasswordValue(e.target.value)}
          className="mb-4 w-full rounded border border-[#8E909D] p-2"
          placeholder="Enter Password"
        />
        <div className="flex justify-end space-x-2">
          <Button variant="cancel" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={loading}>
            {loading ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>
    </div>
  );
}
