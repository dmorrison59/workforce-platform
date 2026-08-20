import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";

export function FormField({ label, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <div className="field">
      <label htmlFor={props.id ?? props.name}>{label}</label>
      <input id={props.id ?? props.name} {...props} />
      {hint ? <span className="help">{hint}</span> : null}
    </div>
  );
}

export function SelectField({
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={props.id ?? props.name}>{label}</label>
      <select id={props.id ?? props.name} {...props}>{children}</select>
    </div>
  );
}
