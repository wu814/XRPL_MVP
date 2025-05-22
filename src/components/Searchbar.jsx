"use client";

const Searchbar = () => {
  return (
    <div className="mx-4 flex-1">
      <input
        type="text"
        placeholder="Search..."
        className="w-full rounded border border-border bg-color1 p-2 focus:border-primary focus:outline-none"
      />
    </div>
  );
};

export default Searchbar;
