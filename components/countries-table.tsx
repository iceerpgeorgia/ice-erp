"use client";

import React, { useState } from "react";

// Country type matches Figma table columns
type Country = {
  id: number;
  englishName: string;
  georgianName: string;
  iso2: string;
  iso3: string;
  unCode: number;
  status: string;
};

// Example data, expand as needed
const countries: Country[] = [
  {
    id: 1,
    englishName: "Georgia",
    georgianName: "საქართველო",
    iso2: "GE",
    iso3: "GEO",
    unCode: 268,
    status: "Active",
  },
  {
    id: 2,
    englishName: "Afghanistan",
    georgianName: "ავღანეთი",
    iso2: "AF",
    iso3: "AFG",
    unCode: 4,
    status: "Active",
  },
  // Add more countries as needed
];

export const CountriesTable: React.FC = () => {
  const [search, setSearch] = useState("");
  const filteredCountries = countries.filter((country) => {
    const searchLower = search.toLowerCase();
    return (
      country.englishName.toLowerCase().includes(searchLower) ||
      country.georgianName.toLowerCase().includes(searchLower) ||
      country.iso2.toLowerCase().includes(searchLower) ||
      country.iso3.toLowerCase().includes(searchLower) ||
      String(country.unCode).includes(searchLower)
    );
  });

  const handleAddCountry = () => {
    alert("Add Country clicked");
  };

  const handleEdit = (country: Country) => {
    alert(`Edit ${country.englishName}`);
  };

  return (
    <div className="max-w-5xl mx-auto mt-8 p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-2">Countries</h2>
      <div className="text-gray-600 mb-4">
        Records loaded:{" "}
        <span className="font-semibold">
          {countries.length} / {countries.length}
        </span>
      </div>
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={handleAddCountry}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition font-medium"
        >
          + Add Country
        </button>
        <input
          type="text"
          placeholder="Search countries or ISO code"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 w-64 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>
      <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 font-semibold text-left border-b">
              English name{" "}
              <button className="ml-2 p-1 rounded hover:bg-gray-200">
                <svg
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                >
                  <circle cx="8" cy="8" r="7" strokeWidth="2" />
                  <path d="M8 4v4l3 3" strokeWidth="2" />
                </svg>
              </button>
            </th>
            <th className="px-4 py-2 font-semibold text-left border-b">
              Georgian name{" "}
              <button className="ml-2 p-1 rounded hover:bg-gray-200">
                <svg
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                >
                  <circle cx="8" cy="8" r="7" strokeWidth="2" />
                  <path d="M8 4v4l3 3" strokeWidth="2" />
                </svg>
              </button>
            </th>
            <th className="px-4 py-2 font-semibold text-left border-b">
              ISO2{" "}
              <button className="ml-2 p-1 rounded hover:bg-gray-200">
                <svg
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                >
                  <circle cx="8" cy="8" r="7" strokeWidth="2" />
                  <path d="M8 4v4l3 3" strokeWidth="2" />
                </svg>
              </button>
            </th>
            <th className="px-4 py-2 font-semibold text-left border-b">
              ISO3{" "}
              <button className="ml-2 p-1 rounded hover:bg-gray-200">
                <svg
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                >
                  <circle cx="8" cy="8" r="7" strokeWidth="2" />
                  <path d="M8 4v4l3 3" strokeWidth="2" />
                </svg>
              </button>
            </th>
            <th className="px-4 py-2 font-semibold text-left border-b">
              UN code{" "}
              <button className="ml-2 p-1 rounded hover:bg-gray-200">
                <svg
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                >
                  <circle cx="8" cy="8" r="7" strokeWidth="2" />
                  <path d="M8 4v4l3 3" strokeWidth="2" />
                </svg>
              </button>
            </th>
            <th className="px-4 py-2 font-semibold text-left border-b">
              Status{" "}
              <button className="ml-2 p-1 rounded hover:bg-gray-200">
                <svg
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                >
                  <circle cx="8" cy="8" r="7" strokeWidth="2" />
                  <path d="M8 4v4l3 3" strokeWidth="2" />
                </svg>
              </button>
            </th>
            <th className="px-4 py-2 font-semibold text-left border-b">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredCountries.map((country) => (
            <tr key={country.id} className="hover:bg-gray-50">
              <td className="px-4 py-2 border-b">{country.englishName}</td>
              <td className="px-4 py-2 border-b">{country.georgianName}</td>
              <td className="px-4 py-2 border-b">{country.iso2}</td>
              <td className="px-4 py-2 border-b">{country.iso3}</td>
              <td className="px-4 py-2 border-b">{country.unCode}</td>
              <td className="px-4 py-2 border-b">{country.status}</td>
              <td className="px-4 py-2 border-b">
                <button
                  onClick={() => handleEdit(country)}
                  className="flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-lg hover:bg-blue-100 text-blue-700 font-medium shadow-sm transition"
                >
                  <svg
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path d="M2 12.5V14h1.5l8.1-8.1-1.5-1.5L2 12.5z" />
                  </svg>
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
