export interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  type: 'Savings' | 'Current';
  isDefault: boolean;
  logo: string;
}

const STORAGE_KEY = 'trupay_bank_accounts';

export const getBankAccounts = (): BankAccount[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return [];
  }

  try {
    const accounts = JSON.parse(stored) as BankAccount[];
    // Remove the old demo placeholder accounts. Real linked accounts use random IDs.
    return accounts.filter((account) => account?.id !== '1' && account?.id !== '2');
  } catch {
    return [];
  }
};

export const saveBankAccounts = (accounts: BankAccount[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
};

export const addBankAccount = (account: Omit<BankAccount, 'id' | 'isDefault'>) => {
  const accounts = getBankAccounts();
  const newAccount: BankAccount = {
    ...account,
    id: Math.random().toString(36).substr(2, 9),
    isDefault: accounts.length === 0
  };
  saveBankAccounts([...accounts, newAccount]);
};

export const removeBankAccount = (id: string) => {
  const accounts = getBankAccounts().filter(acc => acc.id !== id);
  if (accounts.length > 0 && !accounts.some(acc => acc.isDefault)) {
    accounts[0].isDefault = true;
  }
  saveBankAccounts(accounts);
};

export const setDefaultAccount = (id: string) => {
  const accounts = getBankAccounts().map(acc => ({
    ...acc,
    isDefault: acc.id === id
  }));
  saveBankAccounts(accounts);
};
