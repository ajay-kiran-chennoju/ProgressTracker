import { useState, useEffect, useRef } from "react";
import { useLocation, useParams, Link } from "wouter";
import { format, parseISO, addDays, subDays, parse } from "date-fns";
import { 
  useGetDay, 
  getGetDayQueryKey,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useCreateItem,
  useUpdateItem,
  useDeleteItem,
  ParticipantSlot,
  CategoryWithItems,
  Item
} from "@workspace/api-client-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Plus, MoreVertical, Trash2, Edit2, Loader2, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { normalize, getCategorySuggestions, getItemSuggestions } from "@/utils/suggestions";

function SuggestionList({ 
  suggestions, 
  onSelect, 
  highlight 
}: { 
  suggestions: string[], 
  onSelect: (s: string) => void,
  highlight: string
}) {
  if (suggestions.length === 0) return null;
  return (
    <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-48 overflow-auto animate-in fade-in zoom-in-95 duration-100">
      {suggestions.map((s, i) => (
        <button
          key={i}
          className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors border-b border-border/20 last:border-0"
          onClick={() => onSelect(s)}
        >
          {s.toLowerCase().startsWith(highlight.toLowerCase()) ? (
            <>
              <span className="font-bold text-primary">{s.substring(0, highlight.length)}</span>
              <span>{s.substring(highlight.length)}</span>
            </>
          ) : s}
        </button>
      ))}
    </div>
  );
}

export default function DayView() {
  const { date } = useParams();
  const [, setLocation] = useLocation();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: dayData, isLoading } = useGetDay(date || "", {
    query: {
      queryKey: getGetDayQueryKey(date || ""),
      enabled: !!date,
    }
  });

  const parsedDate = date ? parseISO(date) : new Date();
  
  const handlePrevDay = () => {
    setLocation(`/day/${format(subDays(parsedDate, 1), 'yyyy-MM-dd')}`);
  };
  
  const handleNextDay = () => {
    setLocation(`/day/${format(addDays(parsedDate, 1), 'yyyy-MM-dd')}`);
  };

  if (isLoading || !dayData) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
      </div>
    );
  }

  // Ensure current user's column is always on the left for them
  const myData = user?.slot === "A" ? dayData.a : dayData.b;
  const otherData = user?.slot === "A" ? dayData.b : dayData.a;

  return (
    <div className="flex-1 flex flex-col animate-in fade-in duration-500">
      <div className="bg-background border-b border-border/40 sticky top-16 z-10 px-4 py-3 flex items-center justify-between shadow-sm">
        <Button variant="ghost" size="icon" onClick={handlePrevDay}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        
        <div className="text-center">
          <h1 className="font-serif text-xl md:text-2xl font-medium text-foreground">
            {format(parsedDate, "EEEE, MMMM d")}
          </h1>
          <p className="text-xs text-muted-foreground">{format(parsedDate, "yyyy")}</p>
        </div>
        
        <Button variant="ghost" size="icon" onClick={handleNextDay}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto bg-muted/20">
        <div className="container mx-auto p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-6 h-full max-w-7xl">
          <ParticipantColumn 
            date={date!} 
            data={myData} 
            isEditable={true} 
            slot={user?.slot as ParticipantSlot} 
          />
          <ParticipantColumn 
            date={date!} 
            data={otherData} 
            isEditable={false} 
            slot={user?.slot === "A" ? "B" : "A"} 
          />
        </div>
      </div>
    </div>
  );
}

function ParticipantColumn({ 
  date, 
  data, 
  isEditable, 
  slot 
}: { 
  date: string, 
  data: any, 
  isEditable: boolean,
  slot: ParticipantSlot 
}) {
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryTitle, setNewCategoryTitle] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [allTitles, setAllTitles] = useState<{id: string, title: string}[]>([]);
  const [, setLocation] = useLocation();
  const createCategory = useCreateCategory();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (isAddingCategory) {
      // Fetch unique categories for suggestions
      fetch(`/api/categories/unique?slot=${slot}`)
        .then(res => res.json())
        .then(data => setAllTitles(data))
        .catch(() => {});
    }
  }, [isAddingCategory, slot]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSuggestions(getCategorySuggestions(newCategoryTitle, allTitles.map(c => c.title)));
    }, 300);
    return () => clearTimeout(timer);
  }, [newCategoryTitle, allTitles]);

  const handleCreateCategory = async (overrideTitle?: string) => {
    const titleToSave = (overrideTitle || newCategoryTitle).trim();
    if (!titleToSave) return;

    // Check if category already exists globally
    const existingCat = allTitles.find(
      (c) => normalize(c.title) === normalize(titleToSave)
    );
    if (existingCat) {
      // Add it to the local view immediately so they can add items.
      // Once an item is added, it persists for this day because days.ts fetches categories that have items on this day.
      queryClient.setQueryData(getGetDayQueryKey(date), (old: any) => {
        if (!old) return old;
        const sideKey = slot.toLowerCase() as "a" | "b";
        const side = old[sideKey];
        if (side.categories.some((c: any) => c.id === existingCat.id)) return old;
        
        return {
          ...old,
          [sideKey]: {
            ...side,
            categories: [...side.categories, { ...existingCat, slot, items: [] }]
          }
        };
      });
      setNewCategoryTitle("");
      setIsAddingCategory(false);
      return;
    }

    try {
      await createCategory.mutateAsync({
        data: {
          slot,
          date,
          title: titleToSave
        }
      });
      setNewCategoryTitle("");
      setIsAddingCategory(false);
      queryClient.invalidateQueries({ queryKey: getGetDayQueryKey(date) });
    } catch (e) {}
  };

  return (
    <div className={`flex flex-col h-full ${!isEditable ? 'opacity-90' : ''}`}>
      <div className="flex items-center justify-between mb-4 px-2">
        <h2 className="font-serif text-xl font-medium text-foreground/90 flex items-center gap-2">
          {data.participant.name || `Participant ${slot}`}
          {!isEditable && (
            <span className="text-[10px] uppercase tracking-wider bg-muted text-muted-foreground px-2 py-0.5 rounded-sm">
              Viewing
            </span>
          )}
        </h2>
      </div>

      <div className="flex-1 space-y-4 relative">
        <AnimatePresence mode="popLayout">
          {data.categories.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="h-32 border-2 border-dashed border-border/50 rounded-xl flex items-center justify-center text-muted-foreground text-sm bg-card/30"
            >
              No entries yet
            </motion.div>
          ) : (
            data.categories.map((category: CategoryWithItems, i: number) => (
              <CategoryCard 
                key={category.id} 
                category={category} 
                isEditable={isEditable} 
                slot={slot}
                date={date}
                index={i}
              />
            ))
          )}
        </AnimatePresence>

        {isEditable && (
          <div className="pt-2">
            {isAddingCategory ? (
              <Card className="border-primary/30 shadow-sm overflow-hidden">
                <div className="p-3 bg-muted/30 relative">
                  <Input 
                    autoFocus
                    placeholder="e.g. Work, Workout, Thoughts..." 
                    value={newCategoryTitle}
                    onChange={(e) => setNewCategoryTitle(e.target.value)}
                    className="border-0 focus-visible:ring-1 focus-visible:ring-primary/50 bg-background"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (suggestions.length > 0 && normalize(suggestions[0]) !== normalize(newCategoryTitle)) {
                          handleCreateCategory(suggestions[0]);
                        } else {
                          handleCreateCategory();
                        }
                      }
                      if (e.key === "Escape") {
                        setIsAddingCategory(false);
                        setNewCategoryTitle("");
                      }
                    }}
                  />
                  <SuggestionList 
                    suggestions={suggestions} 
                    onSelect={(s) => handleCreateCategory(s)} 
                    highlight={newCategoryTitle}
                  />
                  <div className="flex justify-end gap-2 mt-3">
                    <Button size="sm" variant="ghost" onClick={() => {
                      setIsAddingCategory(false);
                      setNewCategoryTitle("");
                    }}>Cancel</Button>
                    <Button size="sm" onClick={() => handleCreateCategory()} disabled={!newCategoryTitle.trim() || createCategory.isPending}>
                      {createCategory.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              <Button 
                variant="outline" 
                className="w-full border-dashed border-border/80 hover:border-primary/50 hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all duration-300 h-12 rounded-xl"
                onClick={() => setIsAddingCategory(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Category
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryCard({ 
  category, 
  isEditable, 
  slot,
  date,
  index
}: { 
  category: CategoryWithItems, 
  isEditable: boolean,
  slot: ParticipantSlot,
  date: string,
  index: number
}) {
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemContent, setNewItemContent] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [allContents, setAllContents] = useState<string[]>([]);
  const [editTitleOpen, setEditTitleOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(category.title);
  
  const createItem = useCreateItem();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const deleteItem = useDeleteItem();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (isAddingItem) {
      fetch(`/api/items/suggestions?categoryId=${category.id}`)
        .then(res => res.json())
        .then(data => setAllContents(data))
        .catch(() => {});
    }
  }, [isAddingItem, category.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSuggestions(getItemSuggestions(newItemContent, allContents));
    }, 300);
    return () => clearTimeout(timer);
  }, [newItemContent, allContents]);

  const handleCreateItem = async (overrideContent?: string) => {
    const contentToSave = (overrideContent || newItemContent).trim();
    if (!contentToSave) return;

    // Duplicate Check: Check if this exact item was already added TODAY to this category
    const existsToday = category.items.some(
      (item: any) => normalize(item.content) === normalize(contentToSave)
    );
    if (existsToday) {
      toast({ description: "Already added today", variant: "destructive" });
      return;
    }

    try {
      await createItem.mutateAsync({
        data: {
          slot,
          categoryId: category.id,
          content: contentToSave,
          date
        }
      });
      setNewItemContent("");
      setIsAddingItem(false);
      queryClient.invalidateQueries({ queryKey: getGetDayQueryKey(date) });
    } catch (e) {}
  };

  const handleUpdateTitle = async () => {
    if (!editTitle.trim() || editTitle === category.title) {
      setEditTitleOpen(false);
      return;
    }
    try {
      await updateCategory.mutateAsync({
        categoryId: category.id,
        data: { slot, title: editTitle.trim() }
      });
      setEditTitleOpen(false);
      queryClient.invalidateQueries({ queryKey: getGetDayQueryKey(date) });
    } catch (e) {}
  };

  const handleDeleteCategory = async () => {
    if (!confirm("Are you sure you want to delete this entire category and all its entries?")) return;
    try {
      await deleteCategory.mutateAsync({
        categoryId: category.id,
        params: { slot }
      });
      queryClient.invalidateQueries({ queryKey: getGetDayQueryKey(date) });
      toast({ description: "Category deleted" });
    } catch (e) {}
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Card className="overflow-hidden border-border/50 shadow-sm transition-all duration-300 hover:shadow-md group">
        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0 bg-muted/10 border-b border-border/30">
          <Link href={`/category/${category.id}`} className="font-medium text-foreground hover:text-primary transition-colors flex items-center gap-1 group-hover/link">
            {category.title}
            <ArrowRight className="h-3 w-3 opacity-0 -translate-x-2 group-hover/link:opacity-100 group-hover/link:translate-x-0 transition-all text-primary" />
          </Link>
          
          {isEditable && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 opacity-50 group-hover:opacity-100 transition-opacity">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => {
                  setEditTitle(category.title);
                  setEditTitleOpen(true);
                }}>
                  <Edit2 className="h-4 w-4 mr-2" /> Rename
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={handleDeleteCategory}>
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <ul className="space-y-3">
            {category.items.map((item) => (
              <li
                key={item.id}
                className="group/item flex items-start gap-2 text-sm leading-relaxed text-foreground/80 pl-3 border-l-2 border-primary/20"
              >
                <span className="flex-1 whitespace-pre-wrap">{item.content}</span>
                {isEditable && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive opacity-60 hover:opacity-100"
                    onClick={async () => {
                      if (!confirm("Delete this entry?")) return;
                      try {
                        await deleteItem.mutateAsync({
                          itemId: item.id,
                          params: { slot },
                        });
                        queryClient.invalidateQueries({
                          queryKey: getGetDayQueryKey(date),
                        });
                      } catch (e) {
                        toast({
                          title: "Could not delete entry",
                          variant: "destructive",
                        });
                      }
                    }}
                    aria-label="Delete entry"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
          
          {isEditable && (
            <div className="pt-2">
              {isAddingItem ? (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 relative">
                  <Textarea 
                    autoFocus
                    placeholder="Type here..." 
                    value={newItemContent}
                    onChange={(e) => setNewItemContent(e.target.value)}
                    className="min-h-[80px] text-sm resize-none bg-muted/20 border-border/50 focus-visible:ring-primary/30"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (suggestions.length > 0 && normalize(suggestions[0]) !== normalize(newItemContent)) {
                          handleCreateItem(suggestions[0]);
                        } else {
                          handleCreateItem();
                        }
                      }
                      if (e.key === "Escape") {
                        setIsAddingItem(false);
                        setNewItemContent("");
                      }
                    }}
                  />
                  <SuggestionList 
                    suggestions={suggestions} 
                    onSelect={(s) => handleCreateItem(s)} 
                    highlight={newItemContent}
                  />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" className="h-8 px-3 text-xs" onClick={() => {
                      setIsAddingItem(false);
                      setNewItemContent("");
                    }}>Cancel</Button>
                    <Button size="sm" className="h-8 px-3 text-xs" onClick={() => handleCreateItem()} disabled={!newItemContent.trim() || createItem.isPending}>
                      {createItem.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save (Enter)'}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full text-muted-foreground hover:text-primary hover:bg-primary/5 justify-start px-2 h-8"
                  onClick={() => setIsAddingItem(true)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add entry
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editTitleOpen} onOpenChange={setEditTitleOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Rename Category</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleUpdateTitle()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTitleOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateTitle} disabled={!editTitle.trim() || editTitle === category.title || updateCategory.isPending}>
              {updateCategory.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
