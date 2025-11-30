import { useState } from 'react';
import { ChartOfAccounts } from './components/ChartOfAccounts';
import { AccountDialog } from './components/AccountDialog';
import { Button } from './components/ui/button';
import { Plus } from 'lucide-react';

export interface Account {
  id: string;
  code: string;
  name: string;
  type: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
  description: string;
  isIncome: boolean;
  pnl: boolean;
  cf: boolean;
  children?: Account[];
}

const initialAccounts: Account[] = [
  {
    id: '1',
    code: '1',
    name: 'Assets',
    type: 'Asset',
    description: 'All company assets',
    isIncome: false,
    pnl: false,
    cf: true,
    children: [
      {
        id: '1-1',
        code: '1.1',
        name: 'Current Assets',
        type: 'Asset',
        description: 'Assets convertible to cash within one year',
        isIncome: false,
        pnl: false,
        cf: true,
        children: [
          {
            id: '1-1-1',
            code: '1.1.1',
            name: 'Cash',
            type: 'Asset',
            description: 'Cash on hand and in bank',
            isIncome: false,
            pnl: false,
            cf: true,
          },
          {
            id: '1-1-2',
            code: '1.1.2',
            name: 'Accounts Receivable',
            type: 'Asset',
            description: 'Money owed by customers',
            isIncome: false,
            pnl: false,
            cf: true,
          },
          {
            id: '1-1-3',
            code: '1.1.3',
            name: 'Inventory',
            type: 'Asset',
            description: 'Goods available for sale',
            isIncome: false,
            pnl: false,
            cf: true,
          },
        ],
      },
      {
        id: '1-2',
        code: '1.2',
        name: 'Fixed Assets',
        type: 'Asset',
        description: 'Long-term tangible assets',
        isIncome: false,
        pnl: false,
        cf: true,
        children: [
          {
            id: '1-2-1',
            code: '1.2.1',
            name: 'Equipment',
            type: 'Asset',
            description: 'Machinery and equipment',
            isIncome: false,
            pnl: false,
            cf: true,
          },
          {
            id: '1-2-2',
            code: '1.2.2',
            name: 'Vehicles',
            type: 'Asset',
            description: 'Company vehicles',
            isIncome: false,
            pnl: false,
            cf: true,
          },
        ],
      },
    ],
  },
  {
    id: '2',
    code: '2',
    name: 'Liabilities',
    type: 'Liability',
    description: 'All company liabilities',
    isIncome: false,
    pnl: false,
    cf: true,
    children: [
      {
        id: '2-1',
        code: '2.1',
        name: 'Current Liabilities',
        type: 'Liability',
        description: 'Obligations due within one year',
        isIncome: false,
        pnl: false,
        cf: true,
        children: [
          {
            id: '2-1-1',
            code: '2.1.1',
            name: 'Accounts Payable',
            type: 'Liability',
            description: 'Money owed to suppliers',
            isIncome: false,
            pnl: false,
            cf: true,
          },
          {
            id: '2-1-2',
            code: '2.1.2',
            name: 'Short-term Loans',
            type: 'Liability',
            description: 'Loans due within one year',
            isIncome: false,
            pnl: false,
            cf: true,
          },
        ],
      },
      {
        id: '2-2',
        code: '2.2',
        name: 'Long-term Liabilities',
        type: 'Liability',
        description: 'Obligations due after one year',
        isIncome: false,
        pnl: false,
        cf: true,
        children: [
          {
            id: '2-2-1',
            code: '2.2.1',
            name: 'Mortgage Payable',
            type: 'Liability',
            description: 'Long-term property mortgage',
            isIncome: false,
            pnl: false,
            cf: true,
          },
        ],
      },
    ],
  },
  {
    id: '3',
    code: '3',
    name: 'Equity',
    type: 'Equity',
    description: 'Owner equity in the business',
    isIncome: false,
    pnl: false,
    cf: false,
    children: [
      {
        id: '3-1',
        code: '3.1',
        name: 'Owner\'s Equity',
        type: 'Equity',
        description: 'Capital invested by owner',
        isIncome: false,
        pnl: false,
        cf: false,
      },
    ],
  },
  {
    id: '4',
    code: '4',
    name: 'Revenue',
    type: 'Revenue',
    description: 'All revenue streams',
    isIncome: true,
    pnl: true,
    cf: false,
    children: [
      {
        id: '4-1',
        code: '4.1',
        name: 'Sales Revenue',
        type: 'Revenue',
        description: 'Revenue from product sales',
        isIncome: true,
        pnl: true,
        cf: false,
      },
      {
        id: '4-2',
        code: '4.2',
        name: 'Service Revenue',
        type: 'Revenue',
        description: 'Revenue from services',
        isIncome: true,
        pnl: true,
        cf: false,
      },
    ],
  },
  {
    id: '5',
    code: '5',
    name: 'Expenses',
    type: 'Expense',
    description: 'All business expenses',
    isIncome: false,
    pnl: true,
    cf: false,
    children: [
      {
        id: '5-1',
        code: '5.1',
        name: 'Operating Expenses',
        type: 'Expense',
        description: 'Day-to-day operating costs',
        isIncome: false,
        pnl: true,
        cf: false,
        children: [
          {
            id: '5-1-1',
            code: '5.1.1',
            name: 'Salaries',
            type: 'Expense',
            description: 'Employee compensation',
            isIncome: false,
            pnl: true,
            cf: false,
          },
          {
            id: '5-1-2',
            code: '5.1.2',
            name: 'Rent',
            type: 'Expense',
            description: 'Office and facility rent',
            isIncome: false,
            pnl: true,
            cf: false,
          },
          {
            id: '5-1-3',
            code: '5.1.3',
            name: 'Utilities',
            type: 'Expense',
            description: 'Electricity, water, and gas',
            isIncome: false,
            pnl: true,
            cf: false,
          },
        ],
      },
      {
        id: '5-2',
        code: '5.2',
        name: 'Administrative Expenses',
        type: 'Expense',
        description: 'Administrative overhead costs',
        isIncome: false,
        pnl: true,
        cf: false,
        children: [
          {
            id: '5-2-1',
            code: '5.2.1',
            name: 'Office Supplies',
            type: 'Expense',
            description: 'Stationery and office materials',
            isIncome: false,
            pnl: true,
            cf: false,
          },
          {
            id: '5-2-2',
            code: '5.2.2',
            name: 'Insurance',
            type: 'Expense',
            description: 'Business insurance premiums',
            isIncome: false,
            pnl: true,
            cf: false,
          },
        ],
      },
    ],
  },
];

export interface ColumnWidths {
  code: number;
  name: number;
  isIncome: number;
  validation: number;
  description: number;
  pnl: number;
  cf: number;
  actions: number;
}

export default function App() {
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedParent, setSelectedParent] = useState<Account | null>(null);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>({
    code: 120,
    name: 180,
    isIncome: 100,
    validation: 250,
    description: 250,
    pnl: 80,
    cf: 80,
    actions: 140,
  });

  const getAccountLevel = (code: string): number => {
    return code.split('.').length;
  };

  const handleAddAccount = (codeNumber: string, accountData: Omit<Account, 'id' | 'children' | 'code'>, parentId?: string) => {
    // Construct the full code based on parent
    const fullCode = parentId 
      ? (() => {
          let parentCode = '';
          const findParent = (accounts: Account[]): boolean => {
            for (const acc of accounts) {
              if (acc.id === parentId) {
                parentCode = acc.code;
                return true;
              }
              if (acc.children && findParent(acc.children)) {
                return true;
              }
            }
            return false;
          };
          findParent(accounts);
          const parentLevel = getAccountLevel(parentCode);
          if (parentLevel >= 7) {
            alert('Maximum level (7) reached. Cannot add more sub-levels.');
            return;
          }
          return `${parentCode}.${codeNumber}`;
        })()
      : codeNumber;

    if (!fullCode) return;

    const account: Account = {
      ...accountData,
      code: fullCode,
      id: Date.now().toString(),
      children: [],
    };

    if (parentId) {
      const addToParent = (accounts: Account[]): Account[] => {
        return accounts.map((acc) => {
          if (acc.id === parentId) {
            return {
              ...acc,
              children: [...(acc.children || []), account],
            };
          }
          if (acc.children) {
            return {
              ...acc,
              children: addToParent(acc.children),
            };
          }
          return acc;
        });
      };
      setAccounts(addToParent(accounts));
    } else {
      setAccounts([...accounts, account]);
    }
  };

  const handleOpenDialog = (parent?: Account) => {
    setSelectedParent(parent || null);
    setEditingAccount(null);
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = (account: Account) => {
    setEditingAccount(account);
    setSelectedParent(null);
    setIsDialogOpen(true);
  };

  const handleEditAccount = (accountId: string, updatedData: Omit<Account, 'id' | 'children' | 'code'>) => {
    const updateInTree = (accounts: Account[]): Account[] => {
      return accounts.map((acc) => {
        if (acc.id === accountId) {
          return {
            ...acc,
            ...updatedData,
          };
        }
        if (acc.children) {
          return {
            ...acc,
            children: updateInTree(acc.children),
          };
        }
        return acc;
      });
    };
    setAccounts(updateInTree(accounts));
  };

  const handleDeleteAccount = (accountId: string) => {
    const deleteFromTree = (accounts: Account[]): Account[] => {
      return accounts
        .filter((acc) => acc.id !== accountId)
        .map((acc) => ({
          ...acc,
          children: acc.children ? deleteFromTree(acc.children) : undefined,
        }));
    };
    setAccounts(deleteFromTree(accounts));
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-slate-900">Chart of Accounts</h1>
            <p className="text-slate-600 mt-2">Hierarchical view of your accounting structure</p>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Add Root Account
          </Button>
        </div>

        <div className="rounded-lg border bg-white shadow-sm overflow-auto">
          <ChartOfAccounts
            accounts={accounts}
            onAddChild={handleOpenDialog}
            onEdit={handleOpenEditDialog}
            onDelete={handleDeleteAccount}
            columnWidths={columnWidths}
            onColumnWidthChange={setColumnWidths}
          />
        </div>
      </div>

      <AccountDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSubmit={(codeNumber, accountData) => {
          if (editingAccount) {
            handleEditAccount(editingAccount.id, accountData);
          } else {
            handleAddAccount(codeNumber, accountData, selectedParent?.id);
          }
          setIsDialogOpen(false);
        }}
        parentAccount={selectedParent}
        editingAccount={editingAccount}
      />
    </div>
  );
}
