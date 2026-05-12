"use client";

export type AdminChartRange = "7d" | "30d" | "ytd";

type AdminTimeRangeToggleProps = {
  value: AdminChartRange;
  onChange: (value: AdminChartRange) => void;
  label?: string;
};

const options: Array<{ value: AdminChartRange; label: string }> = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "ytd", label: "YTD" },
];

export default function AdminTimeRangeToggle({
  value,
  onChange,
  label = "Chart range",
}: AdminTimeRangeToggleProps) {
  return (
    <div className="inline-flex rounded-md border border-neutral-800 bg-neutral-950/70 p-0.5" aria-label={label}>
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={isSelected}
            className={[
              "min-h-8 rounded px-2.5 text-[11px] font-semibold transition sm:min-h-0 sm:px-2 sm:py-1",
              isSelected
                ? "bg-[#6e34ff]/20 text-[#ddd6fe]"
                : "text-neutral-500 hover:bg-white/[0.04] hover:text-neutral-300",
            ].join(" ")}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
