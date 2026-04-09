"use client";

import { Dialog, Transition } from "@headlessui/react";
import { Fragment } from "react";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Wider drawer for complex editors (e.g. menu item). */
  panelClassName?: string;
};

export function DrawerPanel({ open, title, onClose, children, panelClassName }: Props) {
  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <Transition.Child as={Fragment} enter="duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/30" />
        </Transition.Child>
        <div className="fixed inset-0 flex justify-end">
          <Transition.Child
            as={Fragment}
            enter="duration-150"
            enterFrom="translate-x-full"
            enterTo="translate-x-0"
            leave="duration-100"
            leaveFrom="translate-x-0"
            leaveTo="translate-x-full"
          >
            <Dialog.Panel
              className={cn(
                "h-full w-full max-w-md border-l border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900",
                panelClassName
              )}
            >
              <Dialog.Title className="mb-4 text-lg font-semibold">{title}</Dialog.Title>
              {children}
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}
