import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  useRenameParticipant,
  useUpdateParticipantPin,
  useValidateParticipantPin,
  getListParticipantsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Loader2 } from "lucide-react";

export default function SettingsPage() {
  const { user, rename, updatePin } = useCurrentUser();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const renameMutation = useRenameParticipant();
  const updatePinMutation = useUpdateParticipantPin();
  const validatePin = useValidateParticipantPin();

  const [newName, setNewName] = useState(user?.name ?? "");
  const [namePin, setNamePin] = useState("");

  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newPinConfirm, setNewPinConfirm] = useState("");

  if (!user) {
    return null;
  }

  const isPinValid = (p: string) => /^[0-9]{4,8}$/.test(p);

  const handleRename = async () => {
    if (!newName.trim() || newName.trim() === user.name) return;
    if (!isPinValid(namePin)) {
      toast({ title: "Enter your current PIN", variant: "destructive" });
      return;
    }
    try {
      const ok = await validatePin.mutateAsync({
        slot: user.slot,
        data: { pin: namePin },
      });
      if (!ok.ok) {
        toast({ title: "Incorrect PIN", variant: "destructive" });
        return;
      }
      await renameMutation.mutateAsync({
        slot: user.slot,
        data: { name: newName.trim() },
      });
      rename(newName.trim());
      queryClient.invalidateQueries({ queryKey: getListParticipantsQueryKey() });
      setNamePin("");
      toast({ title: "Name updated" });
    } catch (e) {
      toast({ title: "Could not update name", variant: "destructive" });
    }
  };

  const handleUpdatePin = async () => {
    if (!isPinValid(currentPin)) {
      toast({ title: "Enter your current PIN", variant: "destructive" });
      return;
    }
    if (!isPinValid(newPin)) {
      toast({ title: "New PIN must be 4–8 digits", variant: "destructive" });
      return;
    }
    if (newPin !== newPinConfirm) {
      toast({ title: "New PINs do not match", variant: "destructive" });
      return;
    }
    try {
      await updatePinMutation.mutateAsync({
        slot: user.slot,
        data: { currentPin, newPin },
      });
      updatePin(newPin);
      setCurrentPin("");
      setNewPin("");
      setNewPinConfirm("");
      toast({ title: "PIN updated" });
    } catch (e: any) {
      const msg =
        e?.response?.status === 401
          ? "Incorrect current PIN"
          : "Could not update PIN";
      toast({ title: msg, variant: "destructive" });
    }
  };

  return (
    <div className="flex-1 max-w-2xl mx-auto w-full px-4 md:px-8 py-6 animate-in fade-in duration-500">
      <Link
        href="/"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors mb-4"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Back to calendar
      </Link>

      <h1 className="font-serif text-3xl md:text-4xl font-medium text-foreground mb-2">
        Settings
      </h1>
      <p className="text-sm text-muted-foreground mb-8">
        Signed in as <span className="font-medium text-foreground/80">{user.name}</span>{" "}
        (Participant {user.slot})
      </p>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Display Name</CardTitle>
            <CardDescription>
              How your name appears to the other participant.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="namePin">Current PIN (to confirm)</Label>
              <Input
                id="namePin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="••••"
                value={namePin}
                onChange={(e) =>
                  setNamePin(e.target.value.replace(/\D/g, "").slice(0, 8))
                }
                className="tracking-widest"
              />
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleRename}
                disabled={
                  renameMutation.isPending ||
                  validatePin.isPending ||
                  !newName.trim() ||
                  newName.trim() === user.name
                }
              >
                {(renameMutation.isPending || validatePin.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Name
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Change PIN</CardTitle>
            <CardDescription>
              Use 4–8 digits. You'll need this to sign in again.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPin">Current PIN</Label>
              <Input
                id="currentPin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="••••"
                value={currentPin}
                onChange={(e) =>
                  setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 8))
                }
                className="tracking-widest"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPin">New PIN</Label>
              <Input
                id="newPin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="••••"
                value={newPin}
                onChange={(e) =>
                  setNewPin(e.target.value.replace(/\D/g, "").slice(0, 8))
                }
                className="tracking-widest"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPinConfirm">Confirm New PIN</Label>
              <Input
                id="newPinConfirm"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="••••"
                value={newPinConfirm}
                onChange={(e) =>
                  setNewPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 8))
                }
                className="tracking-widest"
              />
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleUpdatePin}
                disabled={updatePinMutation.isPending}
                variant="default"
              >
                {updatePinMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Update PIN
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
