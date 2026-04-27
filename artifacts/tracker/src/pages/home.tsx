import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { 
  useGetActiveDays, 
  useGetSummary, 
  useGetRecentActivity,
  getGetActiveDaysQueryKey
} from "@workspace/api-client-react";
import { Calendar } from "@/components/ui/calendar";
import { format, isSameMonth, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Loader2, Flame, LayoutList, Layers } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";

export default function Home() {
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [, setLocation] = useLocation();
  const { user } = useCurrentUser();

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth() + 1; // 1-indexed

  const { data: activeDays, isLoading: activeDaysLoading } = useGetActiveDays(year, month, {
    query: {
      queryKey: getGetActiveDaysQueryKey(year, month),
      enabled: true
    }
  });

  const { data: summary, isLoading: summaryLoading } = useGetSummary();
  const { data: recentActivity, isLoading: recentLoading } = useGetRecentActivity({ limit: 5 });

  const modifiers = useMemo(() => {
    if (!activeDays) return {};
    const activeDates = activeDays.map(d => parseISO(d.date));
    return { active: activeDates };
  }, [activeDays]);

  const modifiersStyles = {
    active: {
      fontWeight: 'bold',
      backgroundColor: 'hsl(var(--primary) / 0.15)',
      color: 'hsl(var(--primary))'
    }
  };

  const handleDayClick = (day: Date) => {
    setLocation(`/day/${format(day, 'yyyy-MM-dd')}`);
  };

  const mySummary = user?.slot === 'A' ? summary?.a : summary?.b;
  const otherSummary = user?.slot === 'A' ? summary?.b : summary?.a;

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-5xl space-y-8 animate-in fade-in duration-500">
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card className="border-border/50 shadow-sm overflow-hidden">
            <div className="bg-primary/5 border-b border-border/50 p-4 md:p-6 flex items-center justify-between">
              <div>
                <h2 className="font-serif text-2xl font-medium text-foreground">Select a Day</h2>
                <p className="text-muted-foreground text-sm mt-1">Review past entries or add new ones.</p>
              </div>
            </div>
            <CardContent className="p-0 sm:p-6 flex justify-center py-6">
              <Calendar
                mode="single"
                month={currentMonth}
                onMonthChange={setCurrentMonth}
                onSelect={(day) => day && handleDayClick(day)}
                modifiers={modifiers}
                modifiersStyles={modifiersStyles}
                className="rounded-md border-0 w-full max-w-md mx-auto"
                classNames={{
                  months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                  month: "space-y-4 w-full",
                  table: "w-full border-collapse space-y-1",
                  head_row: "flex w-full justify-between",
                  head_cell: "text-muted-foreground rounded-md w-9 sm:w-12 font-normal text-[0.8rem]",
                  row: "flex w-full mt-2 justify-between",
                  cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                  day: "h-9 w-9 sm:h-12 sm:w-12 p-0 font-normal aria-selected:opacity-100 hover:bg-muted rounded-md transition-colors",
                  day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                  day_today: "bg-accent text-accent-foreground font-semibold",
                  day_outside: "text-muted-foreground opacity-50",
                  day_disabled: "text-muted-foreground opacity-50",
                  day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                  day_hidden: "invisible",
                }}
              />
            </CardContent>
          </Card>

          {recentActivity && recentActivity.length > 0 && (
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                  <LayoutList className="h-5 w-5 text-primary/70" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/40">
                  {recentActivity.map((entry, i) => (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      key={entry.itemId} 
                      className="p-4 hover:bg-muted/30 transition-colors"
                    >
                      <Link href={`/day/${entry.date}`} className="block">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-sm font-medium text-foreground">
                            {entry.participantName || `Participant ${entry.slot}`}
                          </span>
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            {format(parseISO(entry.date), 'MMM d, yyyy')}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                          {entry.content}
                        </p>
                        <div className="flex items-center gap-1.5 text-xs text-primary/80">
                          <Layers className="h-3 w-3" />
                          <span>{entry.categoryTitle}</span>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {summary && (
            <>
              <Card className="border-border/50 shadow-sm bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium text-muted-foreground">Your Stats</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end gap-3 mb-6">
                    <div className="flex items-center justify-center h-12 w-12 rounded-full bg-secondary/20 text-secondary">
                      <Flame className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-3xl font-serif text-foreground leading-none">{mySummary?.currentStreak || 0}</p>
                      <p className="text-sm text-muted-foreground">Day Streak</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50">
                    <div>
                      <p className="text-xl font-medium text-foreground">{mySummary?.totalItems || 0}</p>
                      <p className="text-xs text-muted-foreground">Total Entries</p>
                    </div>
                    <div>
                      <p className="text-xl font-medium text-foreground">{summary.totalDaysTracked}</p>
                      <p className="text-xs text-muted-foreground">Days Tracked</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {otherSummary && otherSummary.participant.name && (
                <Card className="border-border/50 shadow-sm opacity-80">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium text-muted-foreground">{otherSummary.participant.name}'s Stats</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-lg font-medium text-foreground">{otherSummary.currentStreak}</p>
                        <p className="text-xs text-muted-foreground">Streak</p>
                      </div>
                      <div className="h-8 w-px bg-border"></div>
                      <div>
                        <p className="text-lg font-medium text-foreground">{otherSummary.totalItems}</p>
                        <p className="text-xs text-muted-foreground">Entries</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {!summary && summaryLoading && (
            <Card className="border-border/50 shadow-sm">
              <CardContent className="p-8 flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
