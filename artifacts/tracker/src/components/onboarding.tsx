import { useState } from "react";
import { useLocation } from "wouter";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  useListParticipants,
  useClaimParticipant,
  useValidateParticipantPin,
  ParticipantSlot,
  getListParticipantsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ChevronLeft } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

type View = "menu" | "claim" | "login";

export function Onboarding() {
  const { setUser } = useCurrentUser();
  const [, navigate] = useLocation();
  const { data: participants, isLoading } = useListParticipants();
  const claimMutation = useClaimParticipant();
  const validatePin = useValidateParticipantPin();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [view, setView] = useState<View>("menu");
  const [activeSlot, setActiveSlot] = useState<ParticipantSlot | null>(null);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
      </div>
    );
  }

  const slotA = participants?.find((p) => p.slot === "A");
  const slotB = participants?.find((p) => p.slot === "B");

  const isPinValid = (p: string) => /^[0-9]{4,8}$/.test(p);

  const handleClaim = async () => {
    if (!activeSlot) return;
    if (!name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    if (!isPinValid(pin)) {
      toast({ title: "PIN must be 4–8 digits", variant: "destructive" });
      return;
    }
    if (pin !== pinConfirm) {
      toast({ title: "PINs do not match", variant: "destructive" });
      return;
    }
    try {
      const result = await claimMutation.mutateAsync({
        data: { slot: activeSlot, name: name.trim(), pin },
      });
      setUser({ slot: result.slot, name: result.name!, pin });
      queryClient.invalidateQueries({ queryKey: getListParticipantsQueryKey() });
      navigate("/");
    } catch (e: any) {
      toast({
        title: "Could not join",
        description:
          e?.response?.status === 409
            ? "That spot is already claimed."
            : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleLogin = async () => {
    if (!activeSlot) return;
    if (!isPinValid(pin)) {
      toast({ title: "PIN must be 4–8 digits", variant: "destructive" });
      return;
    }
    try {
      const result = await validatePin.mutateAsync({
        slot: activeSlot,
        data: { pin },
      });
      if (!result.ok) {
        toast({ title: "Incorrect PIN", variant: "destructive" });
        return;
      }
      const slotData = activeSlot === "A" ? slotA : slotB;
      setUser({
        slot: activeSlot,
        name: slotData?.name ?? `Participant ${activeSlot}`,
        pin,
      });
      navigate("/");
    } catch (e) {
      toast({ title: "Incorrect PIN", variant: "destructive" });
    }
  };

  const renderMenu = () => (
    <Card className="w-full max-w-md shadow-xl border-border/50">
      <CardHeader className="text-center pb-2">
        <CardTitle className="font-serif text-3xl text-primary">
          Daily Progress
        </CardTitle>
        <CardDescription className="text-base mt-2">
          A shared space to log your days together.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-3">
        {(["A", "B"] as ParticipantSlot[]).map((slot) => {
          const data = slot === "A" ? slotA : slotB;
          const claimed = !!data?.name;
          return (
            <Button
              key={slot}
              variant="outline"
              className="w-full h-14 text-base justify-between px-6"
              onClick={() => {
                setActiveSlot(slot);
                setName("");
                setPin("");
                setPinConfirm("");
                setView(claimed ? "login" : "claim");
              }}
            >
              <span className="font-medium">
                {claimed ? data!.name : `Participant ${slot}`}
              </span>
              <span className="text-xs text-muted-foreground">
                {claimed ? "Sign in with PIN" : "Claim this spot"}
              </span>
            </Button>
          );
        })}
      </CardContent>
      <CardFooter className="flex justify-center">
        <p className="text-xs text-muted-foreground text-center">
          Pick your spot to begin.
        </p>
      </CardFooter>
    </Card>
  );

  const backButton = (
    <Button
      variant="ghost"
      size="sm"
      className="mb-2 -ml-2 text-muted-foreground"
      onClick={() => setView("menu")}
    >
      <ChevronLeft className="h-4 w-4 mr-1" /> Back
    </Button>
  );

  const renderClaim = () => (
    <Card className="w-full max-w-md shadow-xl border-border/50">
      <CardHeader className="pb-2">
        {backButton}
        <CardTitle className="font-serif text-2xl text-primary">
          Claim Participant {activeSlot}
        </CardTitle>
        <CardDescription>
          Pick a name and a PIN you'll use to sign in.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground/80">
            Your name
          </label>
          <Input
            placeholder="Enter your name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-11 bg-muted/30"
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground/80">
            Choose a PIN (4–8 digits)
          </label>
          <Input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="••••"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            className="h-11 bg-muted/30 tracking-widest"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground/80">
            Confirm PIN
          </label>
          <Input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="••••"
            value={pinConfirm}
            onChange={(e) =>
              setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 8))
            }
            className="h-11 bg-muted/30 tracking-widest"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleClaim();
            }}
          />
        </div>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full h-12 text-base font-medium"
          onClick={handleClaim}
          disabled={claimMutation.isPending}
        >
          {claimMutation.isPending && (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          )}
          Start Tracking
        </Button>
      </CardFooter>
    </Card>
  );

  const renderLogin = () => {
    const data = activeSlot === "A" ? slotA : slotB;
    return (
      <Card className="w-full max-w-md shadow-xl border-border/50">
        <CardHeader className="pb-2">
          {backButton}
          <CardTitle className="font-serif text-2xl text-primary">
            Welcome back, {data?.name}
          </CardTitle>
          <CardDescription>Enter your PIN to continue.</CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80">PIN</label>
            <Input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="••••"
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/\D/g, "").slice(0, 8))
              }
              className="h-11 bg-muted/30 tracking-widest"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLogin();
              }}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button
            className="w-full h-12 text-base font-medium"
            onClick={handleLogin}
            disabled={validatePin.isPending}
          >
            {validatePin.isPending && (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            )}
            Sign In
          </Button>
        </CardFooter>
      </Card>
    );
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-background">
      {view === "menu" && renderMenu()}
      {view === "claim" && renderClaim()}
      {view === "login" && renderLogin()}
    </div>
  );
}
