"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";

// A form's submit button that reacts the moment it's clicked: it sets
// data-pending (style it with group-data-[pending=true]:…) and blocks double clicks.
export default function SubmitButton({ className = "", confirm, onClick, ...props }: ComponentProps<"button"> & { confirm?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      {...props}
      type="submit"
      aria-busy={pending}
      data-pending={pending}
      className={`group ${pending ? "pointer-events-none" : ""} ${className}`}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
        onClick?.(e);
      }}
    />
  );
}
