
'use client';

import React from "react";

// Figma SVG icon URLs
const imgIcon = "https://www.figma.com/api/mcp/asset/6362b316-fa35-43d2-be90-58af09deb783";
const imgIcon1 = "https://www.figma.com/api/mcp/asset/317dad3a-f15b-4a02-a0f4-5acecc0e216a";
const imgIcon2 = "https://www.figma.com/api/mcp/asset/04774804-b056-40e0-b267-fd605d60b55b";
const imgIcon3 = "https://www.figma.com/api/mcp/asset/eef795f6-90c9-4f90-b378-fd0e444a28ac";
const imgIcon4 = "https://www.figma.com/api/mcp/asset/bf746f8d-4cf7-4745-b36d-e100607675f4";
const imgIcon5 = "https://www.figma.com/api/mcp/asset/e9e3aa58-1f71-40ae-bcc4-f6d1dbc1322c";
const imgIcon6 = "https://www.figma.com/api/mcp/asset/5f99514f-1063-4cbf-b8f8-f975b546004b";

export default function CountriesTable() {
  // ...existing code...
  return (
    <div className="bg-white min-h-screen w-full px-8 pt-8 pb-0 flex flex-col gap-4" style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* Header & Controls */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-xl font-semibold text-neutral-950 leading-tight">Countries</h1>
          <p className="text-xs text-[#717182] mt-1">Manage country data with comprehensive search and filtering</p>
        </div>
        <div className="flex gap-2 items-center">
          <button className="flex items-center gap-1 bg-white border border-gray-200 rounded-md px-3 py-1 text-xs" type="button">
            <img src={imgIcon} alt="Columns" className="w-5 h-5" style={{ minWidth: 20, minHeight: 20 }} />
            Columns
          </button>
          <button className="flex items-center gap-1 bg-[#030213] rounded-md px-3 py-1 text-xs text-white" type="button">
            <img src={imgIcon1} alt="Add" className="w-5 h-5" style={{ minWidth: 20, minHeight: 20 }} />
            Add Country
          </button>
        </div>
      </div>
      {/* Search & Info */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1 w-56">
          <img src={imgIcon2} alt="Search" className="w-4 h-4" style={{ minWidth: 16, minHeight: 16 }} />
          <input className="bg-[#f3f3f5] rounded-md px-2 py-1 w-full text-xs" placeholder="Search across all fields..." />
        </div>
        <div className="text-xs text-[#717182]">
          Showing 6 of 6 countries
        </div>
      </div>
      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="bg-[rgba(236,236,240,0.3)]">
              <th className="px-2 py-1 text-left font-normal text-neutral-950 whitespace-nowrap">
                <div className="flex items-center gap-1">
                  English Name
                  <img src={imgIcon3} alt="Sort" className="w-3 h-3" style={{ minWidth: 12, minHeight: 12 }} />
                  <img src={imgIcon4} alt="Filter" className="w-5 h-5" style={{ minWidth: 20, minHeight: 20 }} />
                </div>
              </th>
              <th className="px-2 py-1 text-left font-normal text-neutral-950 whitespace-nowrap">
                <div className="flex items-center gap-1">
                  Georgian Name
                  <img src={imgIcon3} alt="Sort" className="w-3 h-3" style={{ minWidth: 12, minHeight: 12 }} />
                  <img src={imgIcon4} alt="Filter" className="w-5 h-5" style={{ minWidth: 20, minHeight: 20 }} />
                </div>
              </th>
              <th className="px-2 py-1 text-left font-normal text-neutral-950 whitespace-nowrap">
                <div className="flex items-center gap-1">
                  ISO2
                  <img src={imgIcon3} alt="Sort" className="w-3 h-3" style={{ minWidth: 12, minHeight: 12 }} />
                  <img src={imgIcon4} alt="Filter" className="w-5 h-5" style={{ minWidth: 20, minHeight: 20 }} />
                </div>
              </th>
              <th className="px-2 py-1 text-left font-normal text-neutral-950 whitespace-nowrap">
                <div className="flex items-center gap-1">
                  ISO3
                  <img src={imgIcon3} alt="Sort" className="w-3 h-3" style={{ minWidth: 12, minHeight: 12 }} />
                  <img src={imgIcon4} alt="Filter" className="w-5 h-5" style={{ minWidth: 20, minHeight: 20 }} />
                </div>
              </th>
              <th className="px-2 py-1 text-left font-normal text-neutral-950 whitespace-nowrap">
                <div className="flex items-center gap-1">
                  UN Code
                  <img src={imgIcon3} alt="Sort" className="w-3 h-3" style={{ minWidth: 12, minHeight: 12 }} />
                  <img src={imgIcon4} alt="Filter" className="w-5 h-5" style={{ minWidth: 20, minHeight: 20 }} />
                </div>
              </th>
              <th className="px-2 py-1 text-left font-normal text-neutral-950 whitespace-nowrap">
                <div className="flex items-center gap-1">
                  Status
                  <img src={imgIcon3} alt="Sort" className="w-3 h-3" style={{ minWidth: 12, minHeight: 12 }} />
                  <img src={imgIcon4} alt="Filter" className="w-5 h-5" style={{ minWidth: 20, minHeight: 20 }} />
                </div>
              </th>
              <th className="px-2 py-1 text-left font-normal text-neutral-950 whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {/* Table body rows would go here, using correct row heights and cell styles */}
          </tbody>
        </table>
      </div>
    </div>
  );
}

