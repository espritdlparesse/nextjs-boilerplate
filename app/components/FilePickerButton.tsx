"use client";
import { useRef, type CSSProperties } from "react";

// Инпут и кнопка живут вместе, поэтому реф не покидает компонент: хук,
// который возвращает реф наружу, «заражает» им каждое чтение своего объекта
// в рендере, и react-hooks/refs ругается на все такие чтения.
export function FilePickerButton({
  label,
  accept,
  multiple = false,
  disabled = false,
  className = "btn btn-outline",
  style,
  onPick,
}: {
  label: string;
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  onPick: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        style={{ display: "none" }}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length > 0) onPick(files);
        }}
      />
      <button type="button" className={className} style={style} disabled={disabled} onClick={() => inputRef.current?.click()}>
        {label}
      </button>
    </>
  );
}
