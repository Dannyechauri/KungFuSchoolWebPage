import type { SelectHTMLAttributes } from 'react'

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  wrapperClassName?: string
}

export function SelectField({ children, className = '', wrapperClassName = '', ...props }: SelectFieldProps) {
  return (
    <span className={`relative block ${wrapperClassName}`}>
      <select
        {...props}
        className={`min-h-11 w-full appearance-none rounded-soft border border-line bg-white px-3 pr-10 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      >
        {children}
      </select>
      <svg className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}