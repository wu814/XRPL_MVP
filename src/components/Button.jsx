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
      "border-2 border-transparent bg-[#F8FFA7] text-black hover:text-[#F8FFA7] hover:bg-transparent hover:border-[#F8FFA7]",
    cancel:
      "border-2 border-transparent bg-[#E65A5A] text-black hover:text-[#E65A5A] hover:bg-transparent hover:border-[#E65A5A]",
    login: "border-2 border-[#F8FFA7] text-[#F8FFA7] bg-transparent hover:text-black hover:bg-[#F8FFA7] hover:border-transparent",
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
