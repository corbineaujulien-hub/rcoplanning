import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

/**
 * Champ texte avec état local : affichage fluide, sauvegarde différée (800 ms)
 * et sauvegarde forcée à la perte de focus.
 */
function useDebouncedField(value: string, onCommit: (v: string) => void, delay: number) {
  const [local, setLocal] = React.useState(value ?? '');
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const focused = React.useRef(false);
  const lastCommitted = React.useRef(value ?? '');
  const commitRef = React.useRef(onCommit);
  commitRef.current = onCommit;

  // Sync depuis l'extérieur (realtime) uniquement quand on n'édite pas
  React.useEffect(() => {
    if (!focused.current && !timer.current) {
      setLocal(value ?? '');
      lastCommitted.current = value ?? '';
    }
  }, [value]);

  const flush = React.useCallback((v: string) => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (v !== lastCommitted.current) {
      lastCommitted.current = v;
      commitRef.current(v);
    }
  }, []);

  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return {
    value: local,
    onFocus: () => { focused.current = true; },
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const v = e.target.value;
      setLocal(v);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => flush(v), delay);
    },
    onBlur: () => { focused.current = false; flush(local); },
  };
}

type BaseProps = { value: string; onCommit: (v: string) => void; delay?: number };

export function DebouncedInput({ value, onCommit, delay = 800, onBlur, onFocus, ...rest }:
  BaseProps & Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange'>) {
  const f = useDebouncedField(value, onCommit, delay);
  return (
    <Input
      {...rest}
      value={f.value}
      onChange={f.onChange}
      onFocus={(e) => { f.onFocus(); onFocus?.(e); }}
      onBlur={(e) => { f.onBlur(); onBlur?.(e); }}
    />
  );
}

export function DebouncedTextarea({ value, onCommit, delay = 800, onBlur, onFocus, ...rest }:
  BaseProps & Omit<React.ComponentProps<typeof Textarea>, 'value' | 'onChange'>) {
  const f = useDebouncedField(value, onCommit, delay);
  return (
    <Textarea
      {...rest}
      value={f.value}
      onChange={f.onChange}
      onFocus={(e) => { f.onFocus(); onFocus?.(e); }}
      onBlur={(e) => { f.onBlur(); onBlur?.(e); }}
    />
  );
}
