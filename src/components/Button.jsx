import React from "react";

const Button = ({
  variant = "primary",
  className = "",
  disabled = false,
  children,
  ...props
}) => {
  // Base button styles, including hover scaling
  const baseStyles =
    "px-4 py-2 rounded-lg font-semibold text-sm transition duration-100 ease-in-out hover:scale-100";

  //
  // tyles for each variant
  const variantStyles = {
    primary:
      "border-2 border-transparent bg-[#D8B6FF] text-black hover:text-[#D8B6FF] hover:bg-transparent hover:border-[#D8B6FF]",
    cancel:
      "border-2 border-transparent bg-[#FAFDB8] text-black hover:text-[#FAFDB8] hover:bg-transparent hover:border-[#FAFDB8]",
    login:
      "border-2 border-[#D8B6FF] text-[#D8B6FF] bg-transparent hover:text-black hover:bg-[#D8B6FF] hover:border-transparent",
  };

  // Styles to apply when the button is disabled
  const disabledStyles =
    "disabled:bg-gray-400 disabled:border-transparent disabled:text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100";

  return (
    <button
      disabled={disabled}
      className={` ${baseStyles} ${variantStyles[variant]} ${disabledStyles} ${className} `}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
