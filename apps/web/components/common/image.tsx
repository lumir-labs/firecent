"use client";

import { ImageProps } from "next/image";
import NextImage from "next/image";
import { useState, type ReactNode } from "react";

type ImageWithFallbackProps = ImageProps & {
  fallback?: ReactNode; // ← Your React element goes here
};

export default function Image({
  fallback,
  onError,
  ...props
}: ImageWithFallbackProps) {
  const [hasError, setHasError] = useState(false);

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setHasError(true);
    onError?.(e); // In case you want to keep the original onError
  };

  if (hasError) {
    return <>{fallback}</>; // ← Renders any React element
  }

  return <NextImage {...props} alt={props.alt || ""} onError={handleError} />;
}
