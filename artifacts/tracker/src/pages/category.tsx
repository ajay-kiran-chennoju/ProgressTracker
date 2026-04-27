import { useState } from "react";
import { useParams, Link } from "wouter";
import { format, parseISO } from "date-fns";
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
  
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemContent, setEditItemContent] = useState("");

  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();

  if (isLoading || !data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
      </div>
    );
  }

  const { category, participant } = data;
  const isEditable = user?.slot === category.slot;

  const handleCreateItem = async () => {
    if (!newItemContent.trim()) return;
    try {
      await createItem.mutateAsync({
        data: {
          slot: category.slot,
          categoryId: category.id,
          content: newItemContent.trim()
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
        <Link href={`/day/${category.date}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors mb-4">
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to {format(parseISO(category.date), "MMMM d")}
        </Link>
        
        <h1 className="font-serif text-3xl md:text-4xl font-medium text-foreground mb-2">
          {category.title}
        </h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground/70">{participant.name || `Participant ${participant.slot}`}</span>
          <span>•</span>
          <span>{format(parseISO(category.date), "EEEE, MMMM d, yyyy")}</span>
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
                    <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
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
                    {format(parseISO(item.createdAt), "h:mm a")}
                  </p>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {category.items.length === 0 && !isAddingItem && (
          <div className="py-12 text-center border-2 border-dashed border-border/50 rounded-xl bg-card/30">
            <p className="text-muted-foreground mb-4">No entries yet in this category.</p>
            {isEditable && (
              <Button variant="outline" onClick={() => setIsAddingItem(true)}>
                <Plus className="h-4 w-4 mr-2" /> Add the first entry
              </Button>
            )}
          </div>
        )}

        {isEditable && (
          <div className="pt-6 border-t border-border/30">
            {isAddingItem ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                <Textarea 
                  autoFocus
                  placeholder="What's on your mind?..." 
                  value={newItemContent}
                  onChange={(e) => setNewItemContent(e.target.value)}
                  className="min-h-[120px] text-base resize-y bg-muted/20 focus-visible:ring-primary/30"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.metaKey) handleCreateItem();
                  }}
                />
                <div className="flex justify-between items-center">
                  <p className="text-xs text-muted-foreground">Press <kbd className="px-1 py-0.5 rounded bg-muted">Cmd/Ctrl</kbd> + <kbd className="px-1 py-0.5 rounded bg-muted">Enter</kbd> to save</p>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => {
                      setIsAddingItem(false);
                      setNewItemContent("");
                    }}>Cancel</Button>
                    <Button onClick={handleCreateItem} disabled={!newItemContent.trim() || createItem.isPending}>
                      {createItem.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                      Add Entry
                    </Button>
                  </div>
                </div>
              </motion.div>
            ) : (
              category.items.length > 0 && (
                <Button 
                  size="lg"
                  variant="outline" 
                  className="w-full text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all duration-300 rounded-xl"
                  onClick={() => setIsAddingItem(true)}
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Add another entry
                </Button>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
