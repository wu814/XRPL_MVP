"use client";

const Searchbar = () => {
  return (
    <div className="mx-4 flex-1">
      <input
        type="text"
        placeholder="Search..."
        className="w-full rounded border border-[#D4D7E9] p-2 focus:border-[#F8FFA7] focus:outline-none"
      />
    </div>
  );
};

export default Searchbar;
