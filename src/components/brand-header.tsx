import { Logo } from "@/components/logo";

// The dashboard's top bar: the wordmark, and whatever sits opposite it.
export function BrandHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between px-5 sm:px-6 lg:max-w-5xl">
      <div className="flex items-center">
        <Logo className="h-9 w-9" />
        <span className="translate-y-[3px] bg-gradient-to-b from-lime-400 to-emerald-500 bg-clip-text font-heading text-[1.65rem] font-semibold leading-none tracking-tight text-transparent">
          kcals
        </span>
      </div>
      {children}
    </div>
  );
}
