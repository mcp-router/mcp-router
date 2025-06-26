import React from "react";

export function TitleBar() {
  return (
    <div
      className="h-8 fixed top-0 left-0 right-0 z-50"
      style={{ WebkitAppRegion: "drag" } as any}
    />
  );
}
