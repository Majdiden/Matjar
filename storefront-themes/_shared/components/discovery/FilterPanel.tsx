import React, { useState } from 'react';
import { cn } from '../../utils/cn';
import { Accordion } from '../primitives/Accordion';
import type { FilterGroup, ActiveFilter } from '../../types/components';
import { useThemeSlot } from '../../theme/ThemeSlotsProvider';

export const SLOT_KEY = 'filterPanel';

interface FilterPanelProps {
  groups: FilterGroup[];
  active: ActiveFilter[];
  onChange: (filters: ActiveFilter[]) => void;
  onClear: () => void;
  className?: string;
}

export function FilterPanel(props: FilterPanelProps) {
  const Override = useThemeSlot<React.ComponentType<FilterPanelProps>>(SLOT_KEY);
  if (Override) return <Override {...props} />;
  const { groups, active, onChange, onClear, className } = props;
  const isActive = (groupId: string, value: string) =>
    active.some(f => f.groupId === groupId && f.value === value);

  const toggleFilter = (groupId: string, value: string, label: string) => {
    const exists = active.some(f => f.groupId === groupId && f.value === value);
    if (exists) {
      onChange(active.filter(f => !(f.groupId === groupId && f.value === value)));
    } else {
      onChange([...active, { groupId, value, label }]);
    }
  };

  return (
    <div className={cn('space-y-0', className)}>
      {/* Active filters */}
      {active.length > 0 && (
        <div className="pb-4 border-b mb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Active Filters</span>
            <button onClick={onClear} className="text-xs text-red-600 hover:underline">Clear All</button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {active.map((f, i) => (
              <button
                key={i}
                onClick={() => onChange(active.filter((_, j) => j !== i))}
                className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"
              >
                {f.label}
                <span className="text-gray-400">&times;</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter groups */}
      <Accordion multiple defaultOpen={groups.slice(0, 3).map(g => g.id)}>
        {groups.map(group => (
          <Accordion.Item key={group.id} id={group.id}>
            <Accordion.Trigger id={group.id}>
              <span className="text-sm font-medium">{group.label}</span>
            </Accordion.Trigger>
            <Accordion.Content id={group.id}>
              {group.type === 'checkbox' && group.options && (
                <div className="space-y-2">
                  {group.options.map(option => (
                    <label key={option.value} className="flex items-center gap-2 cursor-pointer group/filter">
                      <input
                        type="checkbox"
                        checked={isActive(group.id, option.value)}
                        onChange={() => toggleFilter(group.id, option.value, option.label)}
                        className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-300 group-hover/filter:text-gray-900 dark:group-hover/filter:text-white transition">
                        {option.label}
                      </span>
                      {option.count !== undefined && (
                        <span className="text-xs text-gray-400 ml-auto">({option.count})</span>
                      )}
                    </label>
                  ))}
                </div>
              )}

              {group.type === 'color' && group.options && (
                <div className="flex flex-wrap gap-2">
                  {group.options.map(option => (
                    <button
                      key={option.value}
                      onClick={() => toggleFilter(group.id, option.value, option.label)}
                      className={cn(
                        'w-7 h-7 rounded-full border-2 transition',
                        isActive(group.id, option.value)
                          ? 'border-gray-900 ring-2 ring-offset-1 ring-gray-900/20'
                          : 'border-gray-200 hover:border-gray-400'
                      )}
                      style={{ backgroundColor: option.value }}
                      title={option.label}
                    />
                  ))}
                </div>
              )}

              {group.type === 'range' && (
                <PriceRangeFilter
                  group={group}
                  active={active}
                  onChange={onChange}
                />
              )}
            </Accordion.Content>
          </Accordion.Item>
        ))}
      </Accordion>
    </div>
  );
}

// ─── Price Range Sub-component ───────────────────────────────────

function PriceRangeFilter({
  group,
  active,
  onChange,
}: {
  group: FilterGroup;
  active: ActiveFilter[];
  onChange: (filters: ActiveFilter[]) => void;
}) {
  const min = group.min ?? 0;
  const max = group.max ?? 1000;
  const step = group.step ?? 1;

  const activeRange = active.find(f => f.groupId === group.id);
  const [range, setRange] = useState<[number, number]>(
    activeRange ? (activeRange.value as [number, number]) : [min, max]
  );

  const applyRange = () => {
    const filtered = active.filter(f => f.groupId !== group.id);
    if (range[0] !== min || range[1] !== max) {
      filtered.push({
        groupId: group.id,
        value: range,
        label: `$${range[0]} - $${range[1]}`,
      });
    }
    onChange(filtered);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={range[0]}
          onChange={e => setRange([Number(e.target.value), range[1]])}
          min={min}
          max={range[1]}
          step={step}
          className="w-20 px-2 py-1 border rounded text-sm"
          aria-label="Min price"
        />
        <span className="text-gray-400">—</span>
        <input
          type="number"
          value={range[1]}
          onChange={e => setRange([range[0], Number(e.target.value)])}
          min={range[0]}
          max={max}
          step={step}
          className="w-20 px-2 py-1 border rounded text-sm"
          aria-label="Max price"
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={range[1]}
        onChange={e => setRange([range[0], Number(e.target.value)])}
        className="w-full accent-gray-900"
      />
      <button
        onClick={applyRange}
        className="text-xs font-medium px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-800 transition"
      >
        Apply
      </button>
    </div>
  );
}
