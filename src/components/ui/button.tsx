
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 touch-target",
  {
    variants: {
      variant: {
        default: "bg-purple-600 text-white hover:bg-purple-700 active:bg-purple-800 shadow-sm hover:shadow-md",
        destructive:
          "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm hover:shadow-md",
        outline:
          "border border-medium bg-white text-gray-900 hover:bg-gray-50 hover:border-strong active:bg-gray-100",
        secondary:
          "bg-gray-100 text-gray-900 hover:bg-gray-200 active:bg-gray-300",
        ghost: "text-gray-700 hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200",
        link: "text-purple-600 underline-offset-4 hover:underline hover:text-purple-700 active:text-purple-800",
        success: "bg-green-600 text-white hover:bg-green-700 active:bg-green-800 shadow-sm hover:shadow-md",
        warning: "bg-yellow-500 text-white hover:bg-yellow-600 active:bg-yellow-700 shadow-sm hover:shadow-md",
      },
      size: {
        default: "h-11 px-6 py-3",
        sm: "h-9 rounded-lg px-4 text-xs",
        lg: "h-12 rounded-xl px-8 text-base",
        icon: "h-11 w-11",
        "icon-sm": "h-9 w-9 rounded-lg",
        "icon-lg": "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
