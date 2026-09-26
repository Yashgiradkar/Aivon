"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@workspace/backend/_generated/api";
import { useAtomValue } from "jotai";
import {
  contactSessionIdAtomFamily,
  conversationIdAtom,
  organizationIdAtom,
} from "../../atoms/widget-atoms";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { PhoneCallIcon } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const WidgetCallbackDialog = ({ open, onOpenChange }: Props) => {
  const conversationId = useAtomValue(conversationIdAtom);
  const organizationId = useAtomValue(organizationIdAtom);
  const contactSessionId = useAtomValue(
    contactSessionIdAtomFamily(organizationId || "")
  );

  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const scheduleCallback = useMutation(api.public.queue.scheduleCallback);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !conversationId || !contactSessionId) return;

    setIsSubmitting(true);
    try {
      await scheduleCallback({
        conversationId,
        contactSessionId,
        callbackPhoneNumber: phone,
      });
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onOpenChange(false);
      }, 2000);
    } catch (err) {
      console.error("Failed to schedule callback:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[340px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PhoneCallIcon className="h-5 w-5 text-primary" />
            Request a Callback
          </DialogTitle>
          <DialogDescription className="text-xs">
            An available support specialist will call you as soon as possible.
          </DialogDescription>
        </DialogHeader>

        {isSuccess ? (
          <div className="py-6 text-center text-sm font-medium text-green-600">
            ✓ Callback scheduled! We will contact you shortly.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-xs">
                Phone Number
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="text-sm"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting || !phone}>
                {isSubmitting ? "Scheduling..." : "Schedule Call"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
