'use client';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

// "Are you sure?" for something that cannot be undone with one click. The dialog stays open while the action runs
// and while it fails, so the reason can be shown in it; the caller closes it when the action succeeded.
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pending = false,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  pending?: boolean;
  error?: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <AlertDialogContent>
        <div className="space-y-2">
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <AlertDialogCancel asChild>
            <Button variant="outline" className="h-10 px-5 text-sm" disabled={pending}>
              Cancel
            </Button>
          </AlertDialogCancel>
          <Button className="h-10 bg-destructive px-5 text-sm text-white hover:bg-destructive/90" disabled={pending} onClick={onConfirm}>
            {pending ? 'Removing…' : confirmLabel}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
