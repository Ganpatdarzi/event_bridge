export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  _disabled?: boolean;
  _placeholder?: string;
  _className?: string;
}

export function Select({
  options,
  value,
  onChange,
  _disabled = false,
  _placeholder = 'Select...',
  _className,
}: SelectProps) {
  return (
    <div
      className={`relative w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:bg-white focus:ring-2 focus:ring-inset focus:ring-brand sm:text-sm ${_className}`}
    >
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={_disabled}
        className="block w-full py-1.5 px-10 rounded-md border-0 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-brand sm:text-sm"
      >
        <option disabled>{_placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
