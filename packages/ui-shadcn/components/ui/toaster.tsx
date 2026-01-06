"use client";

import * as React from "react";
import { Toaster as Sonner } from "sonner";

export type ToasterProps = React.ComponentProps<typeof Sonner>;

export function Toaster({ ...props }: ToasterProps) {
  return <Sonner position="top-right" richColors expand {...props} />;
}
