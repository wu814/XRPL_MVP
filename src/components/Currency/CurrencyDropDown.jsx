"use client";

import {
  Listbox,
  ListboxButton,
  ListboxOptions,
  ListboxOption,
  Transition,
} from "@headlessui/react";
import { Fragment } from "react";

const currencies = [
  { id: "XRP", name: "XRP", avatar: "/icons/XRP.svg" },
  { id: "ETH", name: "ETH", avatar: "/icons/ETH.svg" },
  { id: "BTC", name: "BTC", avatar: "/icons/BTC.svg" },
  { id: "USD", name: "USD", avatar: "/icons/USD.svg" },
  { id: "SOL", name: "SOL", avatar: "/icons/SOL.svg" },
];

export default function CurrencyDropDown({
  value,
  onChange,
  disabledOptions = [],
  dropdownBg = "bg-color4",
  className = "",
}) {
  const selectedCurrency = currencies.find((c) => c.id === value);

  return (
    <Listbox value={value} onChange={onChange}>
      <div className={`relative ${className || "w-full"}`}>
        <ListboxButton
          className={`mt-1 flex w-full gap-7 items-center justify-between rounded-lg border border-transparent px-2 py-2 focus:border-primary hover:border-primary ${dropdownBg}`}
        >
          <div className="flex items-center space-x-2">
            {selectedCurrency ? (
              <>
                <img
                  src={selectedCurrency.avatar}
                  alt={selectedCurrency.name}
                  className="h-6 w-6 rounded-full"
                />
                <span>{selectedCurrency.name}</span>
              </>
            ) : (
              <span className="text-mutedText">Select</span>
            )}
          </div>
          <svg
            className="h-4 w-4 text-mutedText"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </ListboxButton>

        <Transition
          as={Fragment}
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <ListboxOptions className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-color2">
            {currencies.map((c) => {
              const isDisabled = disabledOptions.includes(c.id);
              return (
                <ListboxOption
                  key={c.id}
                  value={c.id}
                  disabled={isDisabled}
                  className={({ focus, selected, disabled }) =>
                    `flex select-none items-center space-x-2 p-2 ${
                      disabled
                        ? "cursor-not-allowed opacity-30"
                        : focus
                          ? "cursor-pointer bg-color4"
                          : selected
                            ? "cursor-pointer bg-color3"
                            : ""
                    }`
                  }
                >
                  <img
                    src={c.avatar}
                    alt={c.name}
                    className="h-6 w-6 rounded-full"
                  />
                  <span>{c.name}</span>
                </ListboxOption>
              );
            })}
          </ListboxOptions>
        </Transition>
      </div>
    </Listbox>
  );
}
