import { useState } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useListParticipants, useClaimParticipant, ParticipantSlot } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { getListParticipantsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export function Onboarding() {
  const { setUser } = useCurrentUser();
  const { data: participants, isLoading } = useListParticipants();
  const claimMutation = useClaimParticipant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [viewOnlyMode, setViewOnlyMode] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
      </div>
    );
  }

  const participantA = participants?.find(p => p.slot === "A");
  const participantB = participants?.find(p => p.slot === "B");

  const bothClaimed = participantA?.name && participantB?.name;
  const nextFreeSlot = !participantA?.name ? "A" : !participantB?.name ? "B" : null;

  const handleClaim = async () => {
    if (!name.trim() || !nextFreeSlot) return;

    try {
      const result = await claimMutation.mutateAsync({
        data: { slot: nextFreeSlot as ParticipantSlot, name: name.trim() }
      });
      setUser({ slot: result.slot, name: result.name! });
      queryClient.invalidateQueries({ queryKey: getListParticipantsQueryKey() });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to join. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleViewAs = (slot: "A" | "B", pName: string) => {
    setUser({ slot, name: pName });
  };

  if (bothClaimed && !viewOnlyMode) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md shadow-xl border-border/50">
          <CardHeader className="text-center pb-2">
            <CardTitle className="font-serif text-3xl text-primary">Welcome</CardTitle>
            <CardDescription className="text-base mt-2">
              Both spots are currently taken by {participantA.name} and {participantB.name}.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <Button 
                variant="outline" 
                className="w-full h-14 text-lg justify-start px-6" 
                onClick={() => handleViewAs("A", participantA.name!)}
              >
                View as {participantA.name}
              </Button>
              <Button 
                variant="outline" 
                className="w-full h-14 text-lg justify-start px-6"
                onClick={() => handleViewAs("B", participantB.name!)}
              >
                View as {participantB.name}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md shadow-xl border-border/50">
        <CardHeader className="text-center pb-2">
          <CardTitle className="font-serif text-3xl text-primary">Daily Progress</CardTitle>
          <CardDescription className="text-base mt-2">
            A shared space to log your days together.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium text-foreground/80">
                What's your name?
              </label>
              <Input 
                id="name" 
                placeholder="Enter your name..." 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-12 text-lg bg-muted/30"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && name.trim()) {
                    handleClaim();
                  }
                }}
              />
            </div>
            {participantA?.name && (
              <p className="text-sm text-muted-foreground text-center italic">
                Joining {participantA.name}'s tracker
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            className="w-full h-12 text-lg font-medium shadow-sm hover:shadow-md transition-all" 
            onClick={handleClaim}
            disabled={!name.trim() || claimMutation.isPending}
          >
            {claimMutation.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
            Start Tracking
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
