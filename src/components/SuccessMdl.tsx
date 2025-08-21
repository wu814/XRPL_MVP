"use client";
import Button from "./Button";

interface SuccessMdlProps {
  successMessage: string;
  onClose: () => void;
}

export default function SuccessMdl({ successMessage, onClose }: SuccessMdlProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="min-w-xs h-auto w-auto max-w-2xl rounded-lg bg-color4 p-6">
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
