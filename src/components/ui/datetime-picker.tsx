import * as React from "react";
import { CalendarClock, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const pad = (n: number) => String(n).padStart(2, "0");

/** Format a Date as a local "YYYY-MM-DDTHH:mm" string (no timezone shift). */
const toLocalValue = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

const pretty = (d: Date) =>
  d.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export interface DateTimePickerProps {
  /** Local "YYYY-MM-DDTHH:mm" string, or "" when empty. */
  value: string;
  onChange: (value: string) => void;
  /** Earliest selectable moment, same local format. */
  min?: string;
  placeholder?: string;
  "aria-label"?: string;
}

/**
 * Friendly date & time picker: a full-width button that opens a calendar
 * with a time field underneath. Replaces the native datetime-local input,
 * whose tiny calendar icon is hard to find and click.
 */
export function DateTimePicker({ value, onChange, min, placeholder = "Pick a date & time", "aria-label": ariaLabel }: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const date = value ? new Date(value) : undefined;
  const minDate = min ? new Date(min) : undefined;
  const time = value ? value.slice(11, 16) : "12:00";

  const pickDay = (day: Date | undefined) => {
    if (!day) return;
    const [h, m] = time.split(":").map(Number);
    const next = new Date(day);
    next.setHours(h || 0, m || 0, 0, 0);
    onChange(toLocalValue(next));
  };

  const pickTime = (t: string) => {
    if (!t) return;
    const [h, m] = t.split(":").map(Number);
    const base = date ? new Date(date) : new Date();
    base.setSeconds(0, 0);
    base.setHours(h || 0, m || 0);
    onChange(toLocalValue(base));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label={ariaLabel ?? placeholder}
          className={cn("w-full justify-start gap-2 text-left font-normal", !date && "text-muted-foreground")}
        >
          <CalendarClock className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate">{date ? pretty(date) : placeholder}</span>
          {date && (
            <X
              className="ml-auto h-4 w-4 shrink-0 opacity-60 hover:opacity-100"
              aria-label="Clear date"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={pickDay}
          disabled={minDate ? { before: new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate()) } : undefined}
          initialFocus
          className="pointer-events-auto p-3"
        />
        <div className="flex items-center gap-2 border-t border-border p-3">
          <span className="text-xs font-semibold text-muted-foreground">Time</span>
          <Input type="time" value={time} onChange={(e) => pickTime(e.target.value)} className="h-8 w-auto" aria-label="Time" />
          <Button type="button" size="sm" className="ml-auto" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
