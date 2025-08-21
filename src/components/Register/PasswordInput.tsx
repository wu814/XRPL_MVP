"use client";

import { useState } from "react";

interface PasswordStrength {
  strength: number;
  text: string;
  color: string;
}

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export default function PasswordInput({ value, onChange, error }: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const getPasswordStrength = (password: string): PasswordStrength => {
    if (!password) return { strength: 0, text: "", color: "" };
    
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    if (strength <= 2) return { strength, text: "Weak", color: "text-red-500" };
    if (strength <= 4) return { strength, text: "Medium", color: "text-yellow-500" };
    return { strength, text: "Strong", color: "text-green-500" };
  };

  const passwordStrength = getPasswordStrength(value);

  return (
    <div>
      <label className="mb-1 block text-mutedText text-sm">
        Password <span className="text-red-500">*</span>
      </label>
      <div className="relative">
        <input
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter your password"
          className={`bg-color4 w-full rounded-lg border p-2 pr-10 hover:border-gray-500 focus:border-primary focus:outline-none ${
            error ? "border-red-500" : "border-transparent"
          }`}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-mutedText hover:text-primary"
        >
          {showPassword ? "👁️" : "👁️‍🗨️"}
        </button>
      </div>
      {value && (
        <div className="mt-1">
          <div className="flex items-center space-x-2">
            <div className="flex-1 bg-gray-200 rounded-full h-1">
              <div
                className={`h-1 rounded-full transition-all duration-300 ${
                  passwordStrength.strength <= 2 ? "bg-red-500" :
                  passwordStrength.strength <= 4 ? "bg-yellow-500" : "bg-green-500"
                }`}
                style={{ width: `${(passwordStrength.strength / 6) * 100}%` }}
              ></div>
            </div>
            <span className={`text-xs ${passwordStrength.color}`}>
              {passwordStrength.text}
            </span>
          </div>
        </div>
      )}
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
      <p className="mt-1 text-xs text-mutedText">
        Password must be at least 5 characters long
      </p>
    </div>
  );
};
