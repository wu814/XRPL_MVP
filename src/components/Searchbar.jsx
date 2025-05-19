"use client";

const Searchbar = () => {
  return (
    <div className="mx-4 flex-1">
      <input
        type="text"
        placeholder="Search..."
        className="w-full rounded border border-[#8E909D] p-2 focus:border-[#D8B6FF] focus:outline-none"
      />
    </div>
  );
};

export default Searchbar;
