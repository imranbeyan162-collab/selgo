import React from "react";

export function SelgoLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const iconSize = size === "lg" ? "w-14 h-14" : size === "sm" ? "w-8 h-8" : "w-10 h-10";
  const textSize = size === "lg" ? "text-5xl" : size === "sm" ? "text-lg" : "text-2xl";

  return (
    <div className="flex items-center gap-3 select-none">
      <svg className={iconSize} viewBox="0 0 100 100" fill="none">
        <path
          d="M84 12 C52 22, 16 28, 16 48 C16 60, 34 65, 48 60 L38 52 C29 52, 28 46, 36 42 C48 36, 74 30, 84 12 Z"
          fill="#0066FF"
        />
        <path
          d="M16 88 C48 78, 84 72, 84 52 C84 40, 66 35, 52 40 L62 48 C71 48, 72 54, 64 58 C52 64, 26 70, 16 88 Z"
          fill="#1D4ED8"
        />
      </svg>
      <div className="h-6 w-[1px] bg-slate-800" />
      <div>
        <div className={`font-extrabold tracking-tight text-white leading-none ${textSize}`}>
          Selgo
        </div>
        <div className="text-[9px] tracking-[0.16em] uppercase text-blue-400 font-medium mt-0.5">
          AI Agents • Automated for You
        </div>
      </div>
    </div>
  );
}