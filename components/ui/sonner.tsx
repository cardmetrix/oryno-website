"use client"

import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      position="top-right"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-transparent group-[.toaster]:shadow-none group-[.toaster]:border-0 group-[.toaster]:p-0",
          description: "group-[.toast]:text-slate-300",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-slate-700 group-[.toast]:text-slate-200",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
