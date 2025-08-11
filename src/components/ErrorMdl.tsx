"use client";

import Button from "./Button";

interface ErrorMdlProps {
  errorMessage: string;
  onClose: () => void;
}

export default function ErrorMdl({ errorMessage, onClose }: ErrorMdlProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="min-w-xs h-auto w-auto max-w-2xl rounded-lg bg-color4 p-6">
        <h2 className="mb-4 text-xl font-bold text-red-500">Error</h2>
        <p className="mb-4 whitespace-pre-wrap">{errorMessage}</p>
        <div className="flex justify-end">
          <Button variant="cancel" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
