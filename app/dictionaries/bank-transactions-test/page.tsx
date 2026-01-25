import BankTransactionsTestTableFigma from "./BankTransactionsTestTableFigma";

export const metadata = {
  title: "Bank Transactions Test",
  description: "View deconsolidated bank transaction records",
};

export default function BankTransactionsTestPage() {
  return (
    <div className="w-full">
      <BankTransactionsTestTableFigma />
    </div>
  );
}
