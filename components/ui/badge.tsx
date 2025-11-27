import * as React from "react"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'error';
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variantStyles = {
    default: 'border-transparent bg-blue-600 text-white',
    secondary: 'border-transparent bg-gray-200 text-gray-900',
    destructive: 'border-transparent bg-red-600 text-white',
    outline: 'text-gray-900',
    success: 'border-transparent bg-green-600 text-white',
    error: 'border-transparent bg-orange-600 text-white',
  };

  return (
    <div
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${variantStyles[variant]} ${className || ''}`}
      {...props}
    />
  )
}

export { Badge }
