"use client";

import React from "react";
import Button from "./Button";

export default function ErrorModal({ errorMessage, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/20">
      <div className="h-auto w-90 max-w-md rounded-lg bg-[#3F4359] p-6 shadow-lg">
        <h2 className="mb-4 text-xl font-bold text-red-500">Error</h2>
        <p className="mb-4">{errorMessage}</p>
        <div className="flex justify-end">
          <Button variant="cancel" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
