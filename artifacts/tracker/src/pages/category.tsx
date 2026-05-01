import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { format, parseISO, parse } from "date-fns";
import { 
  useGetCategory, 
  getGetCategoryQueryKey,
  useCreateItem,
  useUpdateItem,
  useDeleteItem,
  ParticipantSlot,
  Item
} from "@workspace/api-client-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, Plus, MoreVertical, Trash2, Edit2, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { normalize, getItemSuggestions } from "@/utils/suggestions";

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

export default function CategoryDetail() {
  const { id } = useParams();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useGetCategory(id || "", {
    query: {
      queryKey: getGetCategoryQueryKey(id || ""),
      enabled: !!id,
    }
  });

  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemContent, setNewItemContent] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [allContents, setAllContents] = useState<string[]>([]);
  
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemContent, setEditItemContent] = useState("");

  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();

  const category = data?.category;
  const participant = data?.participant;
  const isEditable = user?.slot === category?.slot;

  useEffect(() => {
    if (isAddingItem && category?.id) {
      fetch(`/api/items/suggestions?categoryId=${category.id}`)
        .then(res => res.json())
        .then(data => setAllContents(data))
        .catch(() => {});
    }
  }, [isAddingItem, category?.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSuggestions(getItemSuggestions(newItemContent, allContents));
    }, 300);
    return () => clearTimeout(timer);
  }, [newItemContent, allContents]);

  if (isLoading || !data || !category || !participant) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
      </div>
    );
  }

  const handleCreateItem = async (overrideContent?: string) => {
    const contentToSave = (overrideContent || newItemContent).trim();
    if (!contentToSave) return;

    // Duplicate Check: Check if this exact item was already added TODAY
    const todayStr = new Date().toISOString().split('T')[0];
    const existsToday = category.items.some(
      (i: any) => normalize(i.content) === normalize(contentToSave) && i.createdAt.startsWith(todayStr)
    );
    if (existsToday) {
      toast({ description: "Already added today", variant: "destructive" });
      return;
    }

    try {
      await createItem.mutateAsync({
        data: {
          slot: category.slot,
          categoryId: category.id,
          content: contentToSave,
          date: todayStr
        }
      });
      setNewItemContent("");
      setIsAddingItem(false);
      queryClient.invalidateQueries({ queryKey: getGetCategoryQueryKey(category.id) });
    } catch (e) {}
  };

  const handleUpdateItem = async (itemId: string) => {
    if (!editItemContent.trim()) return;
    try {
      await updateItem.mutateAsync({
        itemId,
        data: {
          slot: category.slot,
          content: editItemContent.trim()
        }
      });
      setEditingItemId(null);
      setEditItemContent("");
      queryClient.invalidateQueries({ queryKey: getGetCategoryQueryKey(category.id) });
    } catch (e) {}
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm("Delete this entry?")) return;
    try {
      await deleteItem.mutateAsync({
        itemId,
        params: { slot: category.slot }
      });
      queryClient.invalidateQueries({ queryKey: getGetCategoryQueryKey(category.id) });
    } catch (e) {}
  };

  return (
    <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-4 md:px-8 py-6 animate-in fade-in duration-500">
      <div className="mb-8">
        <button onClick={() => window.history.back()} className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors mb-4">
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </button>
        
        <h1 className="font-serif text-3xl md:text-4xl font-medium text-foreground mb-2">
          {category.title}
        </h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground/70">{participant.name || `Participant ${participant.slot}`}</span>
          <span>•</span>
          <span>All Entries</span>
          {!isEditable && (
            <>
              <span>•</span>
              <span className="bg-muted px-2 py-0.5 rounded-sm text-xs uppercase tracking-wider">Read Only</span>
            </>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <AnimatePresence mode="popLayout">
          {category.items.map((item: Item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              layout
            >
              {editingItemId === item.id ? (
                <Card className="border-primary/30 shadow-sm border-2">
                  <CardContent className="p-4 space-y-3">
                    <Textarea 
                      autoFocus
                      value={editItemContent}
                      onChange={(e) => setEditItemContent(e.target.value)}
                      className="min-h-[100px] resize-y bg-background focus-visible:ring-primary/30 text-base"
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => setEditingItemId(null)}>Cancel</Button>
                      <Button onClick={() => handleUpdateItem(item.id)} disabled={!editItemContent.trim() || updateItem.isPending}>
                        {updateItem.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="group relative pl-4 border-l-2 border-primary/20 hover:border-primary/60 transition-colors">
                  <p className="text-base text-foreground/90 whitespace-pre-wrap leading-relaxed pr-8">
                    {item.content}
                  </p>
                  
                  {isEditable && (
                    <div className="absolute top-0 right-0 opacity-100 sm:opacity-60 sm:group-hover:opacity-100 transition-opacity">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setEditItemContent(item.content);
                            setEditingItemId(item.id);
                          }}>
                            <Edit2 className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDeleteItem(item.id)}>
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2 opacity-50">
                    {item.date ? format(parse(item.date, "yyyy-MM-dd", new Date()), "MMM d, yyyy") : "No Date"} • {item.createdAt ? format(parseISO(item.createdAt), "h:mm a") : "No Time"}
                  </p>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {category.items.length === 0 && (
          <div className="py-12 text-center border-2 border-dashed border-border/50 rounded-xl bg-card/30">
            <p className="text-muted-foreground">No entries yet in this category.</p>
          </div>
        )}

        {isEditable && (
          <div className="pt-6 border-t border-border/30">
          </div>
        )}
      </div>
    </div>
  );
}
