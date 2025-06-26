import React from "react";
import { Outlet } from "react-router-dom";

/**
 * PageLayout component provides consistent padding and styling across all pages
 */
const PageLayout: React.FC = () => {
  return (
    <div className={`flex flex-col min-h-full w-full p-6`}>
      <Outlet />
    </div>
  );
};

export default PageLayout;
