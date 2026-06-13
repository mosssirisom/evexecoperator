import OperatorShell from "@/components/operator/Layout";
import { OperatorToastProvider } from "@/components/operator/Toast";

export default function OperatorLayout({ children }) {
  return (
    <OperatorToastProvider>
      <OperatorShell>{children}</OperatorShell>
    </OperatorToastProvider>
  );
}
