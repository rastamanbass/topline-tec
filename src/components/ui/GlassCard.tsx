import { motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { type ReactNode } from 'react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hoverEffect?: boolean;
  delay?: number;
}

export default function GlassCard({
  children,
  className,
  hoverEffect = false,
  delay = 0,
}: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: delay }}
      whileHover={
        hoverEffect
          ? {
              y: -5,
              boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
            }
          : {}
      }
      className={cn(
        'bg-white/80 backdrop-blur-md border border-white/20 shadow-lg rounded-2xl overflow-hidden',
        'dark:bg-slate-800/80 dark:border-slate-700/50',
        className
      )}
    >
      {children}
    </motion.div>
  );
}
