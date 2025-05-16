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
  { id: "XRP", name: "XRP", avatar: "/icons/xrp.svg" },
  { id: "ETH", name: "ETH", avatar: "/icons/eth.svg" },
  { id: "BTC", name: "BTC", avatar: "/icons/btc.svg" },
  { id: "USD", name: "USD", avatar: "/icons/usd.svg" },
  { id: "SOL", name: "SOL", avatar: "/icons/sol.svg" },
];

export default function CurrencyDropDown({
  value,
  onChange,
  disabledOptions = [],
}) {
  const selectedCurrency = currencies.find((c) => c.id === value);

  return (
    <Listbox value={value} onChange={onChange}>
      <div className="relative w-full">
        <ListboxButton className="flex w-full mt-1 items-center justify-between border border-[#D4D7E9] rounded bg-[#3F4359] px-3 py-2 text-white">
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
              <span className="text-gray-400">Select currency…</span>
            )}
          </div>
          <svg
            className="h-5 w-5 text-gray-400"
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
          <ListboxOptions className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-[#242639] shadow-2xl">
            {currencies.map((c) => {
              const isDisabled = disabledOptions.includes(c.id);
              return (
                <ListboxOption
                  key={c.id}
                  value={c.id}
                  disabled={isDisabled}
                  className={({ focus, selected, disabled }) =>
                    `flex items-center space-x-2 p-2 select-none ${
                      disabled
                        ? "cursor-not-allowed opacity-30"
                        : focus
                          ? "cursor-pointer bg-[#2C2E44]"
                          : selected
                            ? "cursor-pointer bg-[#33354D]"
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
