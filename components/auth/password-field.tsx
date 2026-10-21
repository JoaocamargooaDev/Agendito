"use client";

import { useState } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { GlassButton, GlassInput, type GlassInputProps } from "@/components/ui";

export function PasswordField(props: Omit<GlassInputProps, "type" | "leadingIcon">) {
  const [visible, setVisible] = useState(false);
  return <div className="password-field"><GlassInput {...props} type={visible ? "text" : "password"} leadingIcon={<LockKeyhole size={16} />} trailingAction={<GlassButton type="button" variant="quiet" size="icon" className="password-toggle" onClick={() => setVisible((value) => !value)} aria-label={visible ? "Ocultar senha" : "Mostrar senha"}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</GlassButton>} /></div>;
}
