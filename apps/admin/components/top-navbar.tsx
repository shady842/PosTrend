"use client";

import { Fragment } from "react";
import Link from "next/link";
import { Bell, ChevronDown, Moon, Search, Sun } from "lucide-react";
import { Menu, Transition } from "@headlessui/react";
import { cn } from "@/lib/utils";

type Option = { id: string; name: string };

type Props = {
  tenantName: string;
  conceptId: string;
  branchId: string;
  concepts: Option[];
  branches: Option[];
  onConceptChange: (v: string) => void;
  onBranchChange: (v: string) => void;
  onToggleTheme: () => void;
  dark: boolean;
  onLogout: () => void;
};

export function TopNavbar({
  tenantName,
  conceptId,
  branchId,
  concepts,
  branches,
  onConceptChange,
  onBranchChange,
  onToggleTheme,
  dark,
  onLogout
}: Props) {
  return (
    <header className="glass sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-slate-200/60 px-4 py-3 dark:border-slate-700/50">
      <div className="flex flex-1 items-center gap-3">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input className="w-full pl-9" placeholder="Global search..." />
        </div>
      </div>
      <div className="hidden items-center gap-2 md:flex">
        <select value={conceptId} onChange={(e) => onConceptChange(e.target.value)}>
          <option value="">Concept</option>
          {concepts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={branchId} onChange={(e) => onBranchChange(e.target.value)}>
          <option value="">Branch</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      <button className="bg-slate-100 dark:bg-slate-800" onClick={onToggleTheme}>
        {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
      <button className="relative bg-slate-100 dark:bg-slate-800">
        <Bell className="h-4 w-4" />
        <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-rose-500" />
      </button>
      <Menu as="div" className="relative">
        <Menu.Button className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
          <span className="max-w-28 truncate">{tenantName}</span>
          <ChevronDown className="h-4 w-4" />
        </Menu.Button>
        <Transition
          as={Fragment}
          enter="transition duration-100"
          enterFrom="opacity-0 translate-y-1"
          enterTo="opacity-100 translate-y-0"
          leave="transition duration-75"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <Menu.Items className="card absolute right-0 mt-2 w-52 p-1">
            <Menu.Item>
              {({ active }) => (
                <Link
                  href="/"
                  className={cn("block px-2 py-1.5 text-sm", active && "bg-slate-100 dark:bg-slate-800")}
                >
                  Marketing site
                </Link>
              )}
            </Menu.Item>
            <Menu.Item>
              {({ active }) => (
                <Link
                  href="/super-admin/login"
                  className={cn("block px-2 py-1.5 text-sm", active && "bg-slate-100 dark:bg-slate-800")}
                >
                  Super admin login
                </Link>
              )}
            </Menu.Item>
            <Menu.Item>
              {({ active }) => (
                <button className={cn("w-full px-2 py-1.5 text-left text-sm", active && "bg-slate-100 dark:bg-slate-800")}>
                  Profile
                </button>
              )}
            </Menu.Item>
            <Menu.Item>
              {({ active }) => (
                <button
                  onClick={onLogout}
                  className={cn("w-full px-2 py-1.5 text-left text-sm text-rose-600", active && "bg-slate-100 dark:bg-slate-800")}
                >
                  Logout
                </button>
              )}
            </Menu.Item>
          </Menu.Items>
        </Transition>
      </Menu>
    </header>
  );
}
