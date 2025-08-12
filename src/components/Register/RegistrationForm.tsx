"use client";

import { useState, useEffect, FormEvent } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Button from "../Button";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";
import UsernameInput from "./UsernameInput";
import PasswordInput from "./PasswordInput";
import AccountTypeSelector, { AccountType } from "./AccountTypeSelector";

interface FormData {
  username: string;
  password: string;
  confirmPassword: string;
  accountType: AccountType; // Now properly typed
}

interface Errors {
  [key: string]: string;
}

interface CreateUserResponse {
  error?: string;
}


export default function RegistrationForm() {
  const { data: session } = useSession();
  const router = useRouter();
  
  const [formData, setFormData] = useState<FormData>({
    username: "",
    password: "",
    confirmPassword: "",
    accountType: "USER" // Default to USER
  });
  
  const [errors, setErrors] = useState<Errors>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isFormSubmitted, setIsFormSubmitted] = useState<boolean>(false);

  // Navigation blocking logic
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isFormSubmitted) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave without completing your registration?";
        return e.returnValue;
      }
    };

    const handlePopState = (e: PopStateEvent) => {
      if (!isFormSubmitted) {
        const confirmed = window.confirm(
          "You haven't completed your registration yet. Are you sure you want to leave this page? Your progress will be lost."
        );
        if (!confirmed) {
          e.preventDefault();
          window.history.pushState(null, '', window.location.pathname);
        }
      }
    };

    // Add beforeunload event listener for page refresh/close
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);

    // Push current state to prevent immediate back navigation
    window.history.pushState(null, '', window.location.pathname);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isFormSubmitted, router]);

  const setError = (field: string, message: string) => {
    setErrors(prev => ({ ...prev, [field]: message }));
  };

  const clearError = (field: string) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  };

  const validateForm = (): boolean => {
    const newErrors: Errors = {};

    if (!formData.username.trim()) {
      newErrors.username = "Username is required.";
    } else if (formData.username.length < 3) {
      newErrors.username = "Username must be at least 3 characters long.";
    } else if (/\s/.test(formData.username)) {
      newErrors.username = "Username cannot contain spaces.";
    }

    if (!formData.password) {
      newErrors.password = "Password is required.";
    } else if (formData.password.length < 5) {
      newErrors.password = "Password must be at least 5 characters long.";
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password.";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match.";
    }

    if (!formData.accountType) {
      newErrors.accountType = "Please select an account type.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    const sessionUser = session?.user;
    if (!sessionUser?.email) {
      setErrorMessage("No session found. Please try logging in again.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/user/createUser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.username.trim(),
          password: formData.password,
          email: sessionUser.email,
          role: formData.accountType
        })
      });

      const data: CreateUserResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create account");
      }

      // Mark form as submitted to allow navigation
      setIsFormSubmitted(true);
      
      setSuccessMessage("Account created successfully! Refreshing your session...");
      
      // Force session refresh by signing in again
      await signIn("google", { 
        callbackUrl: "/home",
        redirect: false 
      });
      
      // Small delay then redirect
      setTimeout(() => {
        router.push("/home");
      }, 1000);

    } catch (error: any) {
      setErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="mx-auto max-w-md rounded-lg bg-color3 p-6">
        <div className="mb-6 text-center">
          <h1 className="mb-2 text-2xl font-bold">Complete Your Registration</h1>
          <p className="text-mutedText">
            Welcome! Please complete your account setup to continue.
          </p>
          {session?.user?.email && (
            <p className="mt-2 text-sm text-mutedText">
              Email: <span>{session.user.email}</span>
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <UsernameInput
            value={formData.username}
            onChange={(value: string) => {
              setFormData(prev => ({ ...prev, username: value }));
              clearError("username");
            }}
            error={errors.username}
            setError={(message: string) => setError("username", message)}
          />

          <PasswordInput
            value={formData.password}
            onChange={(value: string) => {
              setFormData(prev => ({ ...prev, password: value }));
              clearError("password");
            }}
            error={errors.password}
          />

          <div>
            <label className="mb-1 block text-mutedText text-sm">
              Confirm Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => {
                setFormData(prev => ({ ...prev, confirmPassword: e.target.value }));
                clearError("confirmPassword");
              }}
              placeholder="Confirm your password"
              className={`bg-color4 w-full rounded-lg border p-2 hover:border-gray-500 focus:border-primary focus:outline-none ${
                errors.confirmPassword ? "border-red-500" : "border-transparent"
              }`}
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-sm text-red-500">{errors.confirmPassword}</p>
            )}
          </div>

          <AccountTypeSelector
            value={formData.accountType}
            onChange={(value: AccountType) => {
              setFormData(prev => ({ ...prev, accountType: value }));
              clearError("accountType");
            }}
          />
          {errors.accountType && (
            <p className="text-sm text-red-500">{errors.accountType}</p>
          )}

          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            className="w-full mt-6"
          >
            {isSubmitting ? "Creating Account..." : "Create Account"}
          </Button>
        </form>
      </div>

      {errorMessage && (
        <ErrorMdl
          errorMessage={errorMessage}
          onClose={() => setErrorMessage(null)}
        />
      )}

      {successMessage && (
        <SuccessMdl
          successMessage={successMessage}
          onClose={() => setSuccessMessage(null)}
        />
      )}
    </>
  );
};
