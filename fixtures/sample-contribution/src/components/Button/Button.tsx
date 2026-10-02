import type { ButtonHTMLAttributes } from "react";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

export function Button({ variant = "primary", style, ...rest }: ButtonProps) {
  const background = variant === "primary" ? "#2563EB" : "var(--color-action-secondary)";
  return (
    <button
      type="button"
      style={{ background, padding: "8px 16px", borderRadius: 6, ...style }}
      {...rest}
    />
  );
}
