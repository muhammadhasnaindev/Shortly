/**
 * PasswordInput — controlled password field with show/hide toggle
 *
 * Summary:
 * - Renders a labeled password input with visibility toggle and helper/error text.
 * - Keeps styles aligned with your input classes.
 */

import React, { useState } from "react";

/**
 * @param {{
 *  label?: string,
 *  name?: string,
 *  value: string,
 *  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
 *  placeholder?: string,
 *  required?: boolean,
 *  error?: string,
 *  helperText?: string,
 *  autoComplete?: string,
 *  disabled?: boolean
 * }} props
 */
export default function PasswordInput({
  label = "Password",
  name = "password",
  value,
  onChange,
  placeholder = "••••••••",
  required = false,
  error = "",
  helperText = "",
  autoComplete = "current-password",
  disabled = false,
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={name} className="block text-sm font-medium mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={name}
          name={name}
          type={show ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          disabled={disabled}
          className={`input pr-10 ${error ? "!border-[var(--error)] focus:!border-[var(--error)]" : ""}`}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute inset-y-0 right-2 my-auto h-8 w-8 grid place-items-center rounded-md hover:bg-black/5 dark:hover:bg-white/10"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeWidth="1.8" d="M3 3l18 18M10.58 10.58A3 3 0 0113.42 13.4M9.88 5.09A9.78 9.78 0 0112 5c7 0 10 7 10 7a13.35 13.35 0 01-3.24 4.31m-2.07 1.42A9.67 9.67 0 0112 19C5 19 2 12 2 12a13.35 13.35 0 013.24-4.31" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeWidth="1.8" d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12z" />
              <circle cx="12" cy="12" r="3" strokeWidth="1.8" />
            </svg>
          )}
        </button>
      </div>
      {(error || helperText) && (
        <p className={`mt-1 text-xs ${error ? "text-[var(--error)]" : "text-muted"}`}>{error || helperText}</p>
      )}
    </div>
  );
}
