import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown } from 'lucide-react';

export default function CautionMultiFilter({ label, options, selected, onChange }: {
  label: string; options: { value: string; label: string }[]; selected: string[]; onChange: (v: string[]) => void;
}) {
  const visible = [...options, ...selected.filter(v => !options.some(o => o.value === v)).map(value => ({ value, label: value }))];
  return <Popover><PopoverTrigger asChild><Button size="sm" variant={selected.length ? 'default' : 'outline'}>
    {label}{selected.length ? ` (${selected.length})` : ''}<ChevronDown className="ml-2 h-4 w-4" />
  </Button></PopoverTrigger><PopoverContent className="w-fit max-w-[90vw] space-y-2">
    <Button variant="ghost" size="sm" onClick={() => onChange([])}>Tous</Button>
    {visible.map(o => <label key={o.value} className="flex items-center gap-2 text-sm cursor-pointer">
      <Checkbox checked={selected.includes(o.value)} onCheckedChange={checked => onChange(checked ? [...selected, o.value] : selected.filter(v => v !== o.value))} />{o.label}
    </label>)}
  </PopoverContent></Popover>;
}