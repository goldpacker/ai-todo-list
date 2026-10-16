"use client";

import clsx from "clsx";
import { LANES, LANE_INFO, type Lane } from "@/core/domain";
import { LANE_COLOR } from "@/lib/ui-meta";

/** Lanes as a row of pastel pill radios. Native radios keep it keyboard- and form-friendly. */
export function LanePicker({
  name,
  value,
  onChange,
  exclude,
  required,
  invalid,
  describedBy,
  legend,
}: {
  name: string;
  value: Lane | "";
  onChange: (lane: Lane) => void;
  exclude?: Lane | null;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
  legend: string;
}) {
  const lanes = LANES.filter((l) => l !== exclude);
  return (
    <fieldset
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      className="flex min-w-0 flex-col gap-1.5"
    >
      <legend className="mb-1.5 text-ui font-semibold text-subtext1">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {lanes.map((l) => {
          const selected = value === l;
          return (
            <label key={l} className="relative cursor-pointer">
              <input
                type="radio"
                name={name}
                value={l}
                checked={selected}
                required={required}
                onChange={() => onChange(l)}
                className="peer sr-only"
              />
              <span
                className={clsx(
                  "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-ui font-bold transition-[background-color,color,transform] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-mauve active:scale-[0.97]",
                  selected ? "text-on" : "bg-surface0 text-subtext1 hover:bg-surface1",
                  invalid && !selected && "ring-1 ring-red/60",
                )}
                style={selected ? { backgroundColor: LANE_COLOR[l] } : undefined}
              >
                {!selected && (
                  <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: LANE_COLOR[l] }} />
                )}
                {LANE_INFO[l].name}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
