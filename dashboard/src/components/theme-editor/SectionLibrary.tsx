/**
 * SectionLibrary — slide-in panel (right side) for browsing and adding
 * sections to the current page. Pulls available sections from the API
 * and allows search + category filter.
 */
import { useState, useEffect } from 'react';
import { Search, Plus } from 'lucide-react';
import { api } from '../../lib/api-client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../ui/sheet';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { getSectionMeta, SECTION_CATEGORIES } from './sectionMeta';

interface SectionType {
  type: string;
  name: string;
  description: string;
  category: string;
  icon: string;
}

interface SectionLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSection: (sectionType: string) => void;
}

export default function SectionLibrary({ isOpen, onClose, onAddSection }: SectionLibraryProps) {
  const [sections, setSections] = useState<SectionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    if (isOpen) loadSections();
  }, [isOpen]);

  const loadSections = async () => {
    try {
      setLoading(true);
      const response = (await api.themeCustomization.getAvailableSections()) as {
        data: { sections: SectionType[] };
      };
      setSections(response.data.sections);
    } catch (error) {
      console.error('Failed to load sections:', error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = sections.filter((s) => {
    const meta = getSectionMeta(s.type);
    const cat = meta.category || s.category;
    const matchesSearch =
      !searchQuery ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || cat === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-[400px] sm:w-[420px] p-0 flex flex-col">
        <SheetHeader className="px-5 py-4 border-b border-slate-200 space-y-1">
          <SheetTitle className="text-base">Add a section</SheetTitle>
          <SheetDescription className="text-xs">
            Choose a section type to add to your page.
          </SheetDescription>
        </SheetHeader>

        {/* Search + categories */}
        <div className="px-5 py-3 border-b border-slate-200 space-y-3">
          <div className="relative">
            <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sections…"
              className="h-9 ps-8 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {SECTION_CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition ${
                  selectedCategory === c.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Section grid */}
        <ScrollArea className="flex-1">
          <div className="p-3">
            {loading ? (
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-24 rounded-lg bg-slate-100 animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-slate-500">No sections found</p>
                <p className="text-xs text-slate-400 mt-1">Try a different search or category</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {filtered.map((s) => {
                  const meta = getSectionMeta(s.type);
                  const Icon = meta.icon;
                  return (
                    <button
                      key={s.type}
                      onClick={() => {
                        onAddSection(s.type);
                        onClose();
                      }}
                      className="group relative bg-white border border-slate-200 rounded-lg p-3 hover:border-blue-400 hover:shadow-md transition text-start"
                    >
                      <div className="h-9 w-9 rounded-md bg-slate-100 group-hover:bg-blue-50 flex items-center justify-center mb-2 transition">
                        <Icon className="h-4 w-4 text-slate-600 group-hover:text-blue-600" />
                      </div>
                      <p className="text-xs font-semibold text-slate-900 truncate">{meta.name}</p>
                      {s.description && (
                        <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2 leading-tight">
                          {s.description}
                        </p>
                      )}
                      <span className="absolute top-2 end-2 opacity-0 group-hover:opacity-100 transition">
                        <Plus className="h-3.5 w-3.5 text-blue-600" />
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
