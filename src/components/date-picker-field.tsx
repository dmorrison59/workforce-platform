"use client";

import { useId, useRef, type InputHTMLAttributes } from "react";

type DatePickerFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  hint?: string;
};

export function DatePickerField({ label, hint, id, name, ...props }: DatePickerFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const generatedHintId = useId();
  const inputId = id ?? name;

  function openPicker() {
    const input = inputRef.current;
    if (!input) return;

    input.focus();
    try {
      input.showPicker?.();
    } catch {
      // Focusing the native date input keeps the keyboard fallback available.
    }
  }

  return (
    <div className="field">
      <label htmlFor={inputId}>{label}</label>
      <div className="date-picker-control">
        <input
          ref={inputRef}
          id={inputId}
          name={name}
          type="date"
          aria-describedby={hint ? generatedHintId : undefined}
          {...props}
        />
        <button type="button" onClick={openPicker} aria-label={`Open ${label} calendar`}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 2v3M17 2v3M3.5 9h17M5.5 4h13a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
          </svg>
        </button>
      </div>
      {hint ? <span className="help" id={generatedHintId}>{hint}</span> : null}
    </div>
  );
}
