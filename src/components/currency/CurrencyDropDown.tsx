"use client";

import {
  Listbox,
  ListboxButton,
  ListboxOptions,
  ListboxOption,
  Transition,
} from "@headlessui/react";
import { Fragment } from "react";
import { ChevronDown } from "lucide-react";
import { availableCurrencies } from "@/utils/currencyUtils";

interface CurrencyDropDownProps {
  value: string;
  onChange: (value: string) => void;
  disabledOptions?: string[];
  dropdownBg?: string;
  className?: string;
}

export default function CurrencyDropDown({
  value,
  onChange,
  disabledOptions = [],
  dropdownBg = "bg-color4",
  className = "",
}: CurrencyDropDownProps) {
  const selectedCurrency = availableCurrencies.find((c) => c.id === value);

  return (
    <Listbox value={value} onChange={onChange}>
      <div className={`relative ${className || "w-full"}`}>
        <ListboxButton
          className={`mt-1 flex w-full gap-7 items-center justify-between rounded-lg border border-transparent px-2 py-2 focus:border-primary hover:border-gray-500 outline-none ${dropdownBg}`}
        >
          <div className="flex items-center space-x-2">
            {selectedCurrency ? (
              <>
                <img
                  src={selectedCurrency.avatar}
                  alt={selectedCurrency.name}
                  className="h-6 w-6 rounded-full"
                />
                <span>{selectedCurrency.id}</span>
              </>
            ) : (
              <span className="text-mutedText">Select</span>
            )}
          </div>
          <ChevronDown className="h-4 w-4 text-mutedText" />
        </ListboxButton>

        <Transition
          as={Fragment}
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <ListboxOptions className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-color2">
            {availableCurrencies.map((c) => {
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
                  <span>{c.id}</span>
                  <span className="text-gray-400 text-sm">- {c.name}</span>
                </ListboxOption>
              );
            })}
          </ListboxOptions>
        </Transition>
      </div>
    </Listbox>
  );
};
