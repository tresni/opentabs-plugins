import { OpenTabsPlugin } from '@opentabs-dev/plugin-sdk';
import type { ToolDefinition } from '@opentabs-dev/plugin-sdk';
import { isAuthenticated, waitForAuth } from './lib/api.js';
import { getCurrentUser } from './tools/get-current-user.js';
import { listVirtualCards } from './tools/list-virtual-cards.js';
import { getVirtualCard } from './tools/get-virtual-card.js';
import { listBills } from './tools/list-bills.js';
import { getBill } from './tools/get-bill.js';
import { listExpenseReports } from './tools/list-expense-reports.js';
import { getExpenseReport } from './tools/get-expense-report.js';
import { createExpenseReport } from './tools/create-expense-report.js';
import { submitExpenseReport } from './tools/submit-expense-report.js';
import { listPendingReceipts } from './tools/list-pending-receipts.js';
import { listRequests } from './tools/list-requests.js';
import { listVendors } from './tools/list-vendors.js';
import { searchVendors } from './tools/search-vendors.js';
import { createVirtualCardRequest } from './tools/create-virtual-card-request.js';
import { suspendVirtualCard } from './tools/suspend-virtual-card.js';
import { lockVirtualCard } from './tools/lock-virtual-card.js';
import { requestSpendLimitChange } from './tools/request-spend-limit-change.js';
import { listCardTransactions } from './tools/list-card-transactions.js';
import { addExpense } from './tools/add-expense.js';
import { updateExpense } from './tools/update-expense.js';
import { removeExpense } from './tools/remove-expense.js';
import { addMileageExpense } from './tools/add-mileage-expense.js';
import { listExpenseCategories } from './tools/list-expense-categories.js';
import { attachReceipt } from './tools/attach-receipt.js';
import { uploadReceipt } from './tools/upload-receipt.js';
import { detachReceipt } from './tools/detach-receipt.js';
import { approveBill } from './tools/approve-bill.js';
import { denyBill } from './tools/deny-bill.js';
import { sendBackBill } from './tools/send-back-bill.js';
import { addComment } from './tools/add-comment.js';
import { listComments } from './tools/list-comments.js';
import { deleteComment } from './tools/delete-comment.js';

class AirbasePlugin extends OpenTabsPlugin {
  readonly name = 'airbase';
  readonly description = 'OpenTabs plugin for Airbase';
  override readonly displayName = 'Airbase';
  override readonly homepage = 'https://dashboard.airbase.io';
  readonly urlPatterns = ['*://*.airbase.io/*'];
  readonly tools: ToolDefinition[] = [
    // Account
    getCurrentUser,
    listRequests,

    // Expense Reports
    listExpenseReports,
    getExpenseReport,
    createExpenseReport,
    submitExpenseReport,

    // Expenses (items on reports)
    addExpense,
    updateExpense,
    removeExpense,
    addMileageExpense,
    listExpenseCategories,

    // Receipts
    listPendingReceipts,
    uploadReceipt,
    attachReceipt,
    detachReceipt,

    // Bill Payments
    listBills,
    getBill,
    approveBill,
    denyBill,
    sendBackBill,

    // Virtual Cards
    listVirtualCards,
    getVirtualCard,
    createVirtualCardRequest,
    suspendVirtualCard,
    lockVirtualCard,
    requestSpendLimitChange,
    listCardTransactions,

    // Vendors
    listVendors,
    searchVendors,

    // Comments
    addComment,
    deleteComment,
    listComments,
  ];

  async isReady(): Promise<boolean> {
    if (isAuthenticated()) return true;
    return waitForAuth();
  }
}

export default new AirbasePlugin();
