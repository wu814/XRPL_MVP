"use client";

import React from "react";
import Button from "./Button";

export default function ErrorPopup({ errorMessage, onClose }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
                <h2 className="text-xl font-bold mb-4 text-red-500">Error</h2>
                <p className="mb-4">{errorMessage}</p>
                <div className="flex justify-end">
                    <Button
                        variant="cancel"
                        onClick={onClose}                    >
                        Close
                    </Button>
                </div>
            </div>
        </div>
    );
}
