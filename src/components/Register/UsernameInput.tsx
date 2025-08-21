"use client";

import { useState, useEffect, useRef } from "react";

interface UsernameInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  setError: (error: string | null) => void;
}

interface CheckUsernameResponse {
  available: boolean;
  error?: string;
}

export default function UsernameInput({ value, onChange, error, setError }: UsernameInputProps) {
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const prevValueRef = useRef<string>("");

  useEffect(() => {
    // Only check if the value actually changed
    if (prevValueRef.current === value) {
      return;
    }

    // Update the previous value reference
    prevValueRef.current = value;

    const checkUsername = async () => {
      if (!value || value.length < 3) {
        setIsAvailable(null);
        return;
      }

      setIsChecking(true);
      setError(null);

      try {
        const response = await fetch("/api/user/checkUsername", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: value })
        });

        const data: CheckUsernameResponse = await response.json();

        if (!response.ok) {
          setError(data.error || "Error checking username");
          setIsAvailable(null);
        } else {
          setIsAvailable(data.available);
          if (!data.available) {
            setError("This username is already taken.");
          }
        }
      } catch (err) {
        setError("Error checking username availability.");
        setIsAvailable(null);
      } finally {
        setIsChecking(false);
      }
    };

    const debounceTimer = setTimeout(checkUsername, 500);
    return () => clearTimeout(debounceTimer);
  }, [value, setError]);

  return (
    <div>
      <label className="mb-1 block text-mutedText text-sm">
        Username <span className="text-red-500">*</span>
      </label>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter your username (no spaces)"
          className={`bg-color4 w-full rounded-lg border p-2 pr-10 hover:border-gray-500 focus:border-primary focus:outline-none ${
            error ? "border-red-500" : isAvailable === false ? "border-red-500" : isAvailable === true ? "border-green-500" : "border-transparent"
          }`}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isChecking && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
          )}
          {!isChecking && isAvailable === true && (
            <div className="text-green-500">✓</div>
          )}
          {!isChecking && isAvailable === false && (
            <div className="text-red-500">✗</div>
          )}
        </div>
      </div>
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
      {!error && value.length >= 3 && !isChecking && isAvailable === true && (
        <p className="mt-1 text-sm text-green-500">Username is available!</p>
      )}
    </div>
  );
};
