"use client";

import React from "react";
import Button from "./Button";

export default function SuccessMdl({ successMessage, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10">
      <div className="min-w-xs h-auto w-auto max-w-2xl rounded-lg bg-modal p-6">
        <h2 className="mb-4 text-xl font-bold text-green-500">Success</h2>
        <p className="mb-4 whitespace-pre-wrap">{successMessage}</p>
        <div className="flex justify-end">
          <Button variant="cancel" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
