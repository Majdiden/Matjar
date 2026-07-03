import { useState } from "react";
import { X, Search } from "lucide-react";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import type { PickerItem } from "./discount-form-types";

export function PickerField({
  label,
  placeholder,
  options,
  selected,
  onChange,
  noMatchesText,
}: {
  label: string;
  placeholder: string;
  options: PickerItem[];
  selected: PickerItem[];
  onChange: (next: PickerItem[]) => void;
  noMatchesText: string;
}) {
  const [query, setQuery] = useState("");
  const selectedIds = new Set(selected.map((s) => s._id));
  const filtered = options
    .filter((o) => !selectedIds.has(o._id))
    .filter((o) => o.name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 20);

  const add = (item: PickerItem) => {
    onChange([...selected, item]);
    setQuery("");
  };
  const remove = (id: string) => onChange(selected.filter((s) => s._id !== id));

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((item) => (
            <Badge key={item._id} variant="secondary" className="text-xs gap-1 pe-1">
              {item.name}
              <button
                type="button"
                onClick={() => remove(item._id)}
                className="rounded-sm hover:bg-muted-foreground/20 p-0.5"
                aria-label={`Remove ${item.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="relative">
        <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="ps-8 h-9"
        />
      </div>
      {query && (
        <div className="max-h-48 overflow-y-auto rounded-md border bg-popover text-sm">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-muted-foreground text-xs">{noMatchesText}</div>
          ) : (
            filtered.map((item) => (
              <button
                key={item._id}
                type="button"
                onClick={() => add(item)}
                className="block w-full text-start px-3 py-1.5 hover:bg-accent focus:bg-accent focus:outline-none"
              >
                {item.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
