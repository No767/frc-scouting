import { type ChangeEvent, useCallback } from "react";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
}

export function TextField({
  id,
  label,
  value,
  onChange,
  error,
  placeholder,
}: Readonly<TextFieldProps>) {
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange(event.target.value);
    },
    [onChange],
  );

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={handleChange}
        aria-invalid={error !== undefined && error !== ""}
      />
      <FieldError>{error}</FieldError>
    </Field>
  );
}
