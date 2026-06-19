import { ConsoleProvider } from "./ConsoleContext";
import { AppShell } from "@/components/layout/AppShell";

export function ConsoleLayout() {
  return (
    <ConsoleProvider>
      <AppShell />
    </ConsoleProvider>
  );
}
