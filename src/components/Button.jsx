import React from "react";

const Button = ({
  variant = "primary",
  className = "",
  disabled = false,
  children,
  ...props
}) => {
  // Base button styles, including hover scaling
  const baseStyles = "px-4 py-2 rounded-md font-semibold transition duration-300 ease-in-out hover:scale-105";

  // Styles for each variant
  const variantStyles = {
    primary: "bg-[#D25875] text-white hover:bg-[#D4365B]",
    submit:  "bg-[#83B592] text-white hover:bg-[#6DAB7F]",
    cancel:  "bg-red-500 text-white hover:bg-red-600",
    basic:   "bg-[#DFD9CF] text-black hover:bg-[#BDB8AF]",
  };

  // Styles to apply when the button is disabled
  const disabledStyles = "disabled:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100";

  return (
    <button
      disabled={disabled}
      className={`
        ${baseStyles}
        ${variantStyles[variant]}
        ${disabledStyles}
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
