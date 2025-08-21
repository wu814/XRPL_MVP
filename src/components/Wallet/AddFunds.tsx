import { useState } from "react";
import Button from "../Button";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";

interface AddFundsProps {
  onFundsAdded?: () => void;
}

export default function AddFunds({ onFundsAdded }: AddFundsProps) {
  const [showMdl, setShowMdl] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  return (
    <div>
      <Button
        variant="primary"
        onClick={() => setShowMdl(true)}
        className="hover:scale-none mt-4 w-full"
      >
        + Add Funds
      </Button>

      {showMdl && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40">
          <div className="w-96 rounded-lg bg-color4 p-6">
            <h2 className="mb-4 text-xl font-bold">Add Funds</h2>
            <p className="mb-4 text-sm text-mutedText">
              This feature is not yet implemented.
            </p>
            <Button
              variant="primary"
              onClick={() => setShowMdl(false)}
              className="w-full"
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {errorMessage && (
        <ErrorMdl
          errorMessage={errorMessage}
          onClose={() => setErrorMessage(null)}
        />
      )}
      {successMessage && (
        <SuccessMdl
          successMessage={successMessage}
          onClose={() => {
            setSuccessMessage(null);
            setShowMdl(false);
          }}
        />
      )}
    </div>
  );
}
