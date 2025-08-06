import * as React from "react"
// import * as React from "react" // Removed because jsxInject in vite.config.js handles this
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { triggerButtonPress } from "@/utils/haptics"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-text-primary shadow-md hover:bg-primary-hover active:bg-primary-hover",
        secondary:
          "bg-secondary text-text-primary shadow-md hover:bg-secondary-hover active:bg-secondary-hover",
        success:
          "bg-success text-text-primary shadow-md hover:opacity-90 active:opacity-80 border border-text-primary/20",
        warning:
          "bg-warning text-text-primary shadow-md hover:opacity-90 active:opacity-80",
        error:
          "bg-error text-text-primary shadow-md hover:opacity-90 active:opacity-80",
        bitcoin:
          "bg-bitcoin text-text-primary shadow-md hover:opacity-90 active:opacity-80",
        outline:
          "border border-border-primary bg-transparent shadow-sm hover:bg-bg-tertiary hover:text-text-primary",
        ghost: 
          "hover:bg-bg-tertiary hover:text-text-primary",
        link: 
          "text-primary underline-offset-4 hover:underline hover:text-primary-hover",
        "start-run":
          "bg-bg-secondary hover:bg-bg-tertiary text-text-primary border-2 border-border-secondary shadow-lg font-semibold",
      },
      size: {
        default: "h-10 px-4 py-2 min-w-[44px]", // Mobile-friendly touch target
        sm: "h-9 rounded-md px-3 text-xs min-w-[36px]",
        lg: "h-12 rounded-md px-8 text-base min-w-[48px]", // Large touch target for runners
        icon: "h-10 w-10", // Square touch target
        "icon-sm": "h-8 w-8",
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
  enableHaptics?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, enableHaptics = true, onClick, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (enableHaptics) {
        triggerButtonPress()
      }
      if (onClick) {
        onClick(event)
      }
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        onClick={handleClick}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
