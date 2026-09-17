"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, type DayPickerProps } from "react-day-picker";
import { enGB } from "react-day-picker/locale";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Monday-first, dd/mm/yyyy-locale calendar grid — always en-GB regardless of
// the visitor's own browser/OS locale, same reasoning as UkDateInput.
export function Calendar({ className, classNames, ...props }: DayPickerProps) {
  return (
    <DayPicker
      locale={enGB}
      weekStartsOn={1}
      showOutsideDays
      className={cn("p-2", className)}
      classNames={{
        months: "flex flex-col gap-3",
        month: "flex flex-col gap-3",
        // relative (for the nav's absolute positioning to anchor against) but
        // pointer-events-none — otherwise this spans the full row width and,
        // being a later/positioned sibling of `nav`, sits on top of and
        // swallows clicks on the prev/next month buttons underneath it.
        month_caption: "flex items-center justify-center pt-1 relative pointer-events-none",
        caption_label: "text-sm font-medium",
        nav: "flex items-center justify-between absolute inset-x-0 top-0.5",
        button_previous: cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "text-muted-foreground"),
        button_next: cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "text-muted-foreground"),
        month_grid: "w-full border-collapse mt-2",
        weekdays: "flex",
        weekday: "text-muted-foreground w-8 text-[0.75rem] font-normal",
        week: "flex w-full mt-1",
        day: "size-8 p-0 text-center text-sm",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "size-8 p-0 font-normal aria-selected:opacity-100 rounded-md",
        ),
        today: "text-primary font-semibold",
        selected: "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground",
        outside: "text-muted-foreground/40",
        disabled: "text-muted-foreground/40 opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClassName }) =>
          orientation === "left" ? (
            <ChevronLeft className={cn("size-4", chevronClassName)} />
          ) : (
            <ChevronRight className={cn("size-4", chevronClassName)} />
          ),
      }}
      {...props}
    />
  );
}
