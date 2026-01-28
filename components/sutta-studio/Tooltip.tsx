import { motion } from 'framer-motion';

export function Tooltip({ text }: { text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 5 }}
      className="absolute -top-14 left-1/2 -translate-x-1/2 bg-slate-900/90 border border-slate-700 text-slate-200 text-xs px-3 py-2 rounded shadow-xl whitespace-nowrap z-50 pointer-events-none select-none"
    >
      {text}
    </motion.div>
  );
}
