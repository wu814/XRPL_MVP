"use client";

const Searchbar = () => {
    return (
        <div className="flex-1 mx-4">    
            <input
                type="text"
                placeholder="Search..."
                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
            />
        </div>
    );
};

export default Searchbar;