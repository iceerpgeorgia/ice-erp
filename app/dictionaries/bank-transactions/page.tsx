import BankTransactionsTestTableFigma from "../bank-transactions-test/BankTransactionsTestTableFigma";

export const metadata = {
  title: "Bank Transactions",
  description: "View consolidated bank transaction records",
};

export default function BankTransactionsPage() {
  return (
    <div className="w-full">
      <BankTransactionsTestTableFigma />
    </div>
  );
}
