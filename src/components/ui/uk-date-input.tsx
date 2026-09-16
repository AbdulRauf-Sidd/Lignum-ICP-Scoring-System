"use client";

import * as React from "react";
import { format, isValid, parse } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

const DISPLAY_FORMAT = "dd/MM/yyyy";
const ISO_FORMAT = "yyyy-MM-dd";

function isoToDisplay(iso: string): string {
  if (!iso) return "";
  const parsed = parse(iso, ISO_FORMAT, new Date());
  return isValid(parsed) ? format(parsed, DISPLAY_FORMAT) : "";
}

function isoToDate(iso: string): Date | undefined {
  if (!iso) return undefined;
  const parsed = parse(iso, ISO_FORMAT, new Date());
  return isValid(parsed) ? parsed : undefined;
}

// Auto-inserts "/" as digits are typed, so "01092026" becomes "01/09/2026"
// without the separators having to be typed by hand.
function maskInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
  return parts.join("/");
}

// A native <input type="date"> renders its on-screen text (and its picker's
// month/week layout) in the visitor's own browser/OS locale — there's no
// CSS/JS override for that. This is a drop-in replacement with the same
// value contract (an ISO yyyy-mm-dd string, or "" for empty) but always
// displayed, typed, and picked as dd/mm/yyyy with a Monday-first calendar,
// regardless of the visitor's locale — either type the date directly or
// click the calendar icon to pick it.
export function UkDateInput({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const [text, setText] = React.useState(() => isoToDisplay(value));
  const [open, setOpen] = React.useState(false);

  // Stay in sync with external value changes (e.g. a preset picked
  // elsewhere resetting this field) without clobbering active typing.
  const [prevValue, setPrevValue] = React.useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setText(isoToDisplay(value));
  }

  function commit(raw: string) {
    if (raw === "") {
      onChange("");
      return;
    }
    const parsed = parse(raw, DISPLAY_FORMAT, new Date());
    if (isValid(parsed) && raw.length === 10) {
      onChange(format(parsed, ISO_FORMAT));
    } else {
      // Invalid or incomplete — revert to the last accepted value rather
      // than silently keeping unparseable text on screen.
      setText(isoToDisplay(value));
    }
  }

  return (
    <div className="relative">
      <Input
        type="text"
        inputMode="numeric"
        placeholder="dd/mm/yyyy"
        value={text}
        onChange={(e) => setText(maskInput(e.target.value))}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className={cn(className, "pr-7")}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Choose date"
            className="absolute top-1/2 right-0.5 -translate-y-1/2 text-muted-foreground"
          >
            <CalendarIcon className="size-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={isoToDate(value)}
            defaultMonth={isoToDate(value)}
            onSelect={(date) => {
              if (!date) return;
              const iso = format(date, ISO_FORMAT);
              setText(isoToDisplay(iso));
              onChange(iso);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
