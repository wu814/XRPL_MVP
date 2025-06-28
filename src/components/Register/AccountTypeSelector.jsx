"use client";

import React from "react";

export default function AccountTypeSelector({ value, onChange }) {
  const accountTypes = [
    {
      value: "USER",
      title: "Personal Account",
      description: "For individual users who want to trade and manage digital assets",
      icon: "👤"
    },
    {
      value: "BUSINESS",
      title: "Business Account",
      description: "For businesses and organizations with advanced features",
      icon: "🏢"
    }
  ];

  return (
    <div>
      <label className="mb-3 block text-mutedText text-sm">
        Account Type <span className="text-red-500">*</span>
      </label>
      <div className="space-y-3">
        {accountTypes.map((type) => (
          <div
            key={type.value}
            onClick={() => onChange(type.value)}
            className={`cursor-pointer rounded-lg border-2 p-4 transition-all duration-200 hover:border-primary ${
              value === type.value
                ? "border-primary bg-primary/10"
                : "border-color6 bg-color6"
            }`}
          >
            <div className="flex items-start space-x-3">
              <div className="text-2xl">{type.icon}</div>
              <div className="flex-1">
                <h3 className="font-semibold text-primary">{type.title}</h3>
                <p className="text-sm text-mutedText">{type.description}</p>
              </div>
              <div className="flex-shrink-0">
                <div
                  className={`h-4 w-4 rounded-full border-2 ${
                    value === type.value
                      ? "border-primary bg-primary"
                      : "border-mutedText"
                  }`}
                >
                  {value === type.value && (
                    <div className="h-full w-full rounded-full bg-white scale-50"></div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 