import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Upload, FileText, TrendingUp, DollarSign, PieChart, ArrowLeft, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import ExcelJS from 'exceljs';
import { ProcessingStages } from '../components/ProcessingStages';

interface FinancialData {
  company_name: string;
  fiscal_years: number[];  // [2016, 2017, 2018]
  company_type: string;
  // Income Statement - 3 years
  revenue: number[];
  cost_of_sales: number[];
  research_and_development: number[];
  sales_and_marketing: number[];
  selling_general_admin: number[];
  other_operating_expenses: number[];
  depreciation_amortization: number[];
  interest_income: number[];
  interest_expense: number[];
  other_income_expense: number[];
  income_tax_expense: number[];
  stock_based_compensation: number[];
  gross_profit: number[];
  operating_profit: number[];
  ebitda: number[];
  adjusted_ebitda: number[];
  pretax_profit: number[];
  net_income: number[];
  gross_margin: number[];
  operating_margin: number[];
  ebitda_margin: number[];
  net_income_margin: number[];
  // Balance Sheet - 2 years padded with 0
  cash_and_equivalents: number[];  // [0, 2017, 2018]
  accounts_receivable: number[];
  inventories: number[];
  other_current_assets: number[];
  property_plant_equipment: number[];
  other_noncurrent_assets: number[];
  accounts_payable: number[];
  other_current_liabilities: number[];
  deferred_revenue: number[];
  short_term_debt: number[];
  long_term_debt: number[];
  other_noncurrent_liabilities: number[];
  common_stock: number[];
  retained_earnings: number[];
  other_equity: number[];
  total_current_assets: number[];
  total_assets: number[];
  total_current_liabilities: number[];
  total_liabilities: number[];
  total_equity: number[];
}

export function PEDemo() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [financialData, setFinancialData] = useState<FinancialData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  
  // Time savings calculator state
  const [companiesPerMonth, setCompaniesPerMonth] = useState(10);
  const hoursPerCompany = 6; // Manual 10-K analysis time
  const totalHours = companiesPerMonth * hoursPerCompany;
  const daysPerMonth = (totalHours / 8).toFixed(1);

  // Cleanup on unmount - abort pending requests ONLY
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Abort any pending fetch request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      // DO NOT reset state here - component is unmounting
    };
  }, []);
  
  // Cost calculations
  const avgAnalystSalary = 150000; // Average PE analyst/associate base salary
  const fullyLoadedCost = avgAnalystSalary * 1.3; // Including benefits, overhead
  const hourlyRate = fullyLoadedCost / 2080; // 2080 work hours per year
  const monthlyCostLost = (totalHours * hourlyRate).toFixed(0);
  const annualCostLost = (parseFloat(monthlyCostLost) * 12).toFixed(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      const formData = new FormData();
      formData.append('file', file);

      console.log('📤 Uploading 10-K to server...');

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/analyze-10k`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: formData,
          signal: abortControllerRef.current.signal, // Add abort signal
        }
      );

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Server error details:', errorData);
        throw new Error(errorData.details || errorData.error || 'Failed to process 10-K filing');
      }

      const data = await response.json();
      console.log('✅ Data received:', data);

      if (!isMountedRef.current) return;
      setFinancialData(data);
    } catch (err: any) {
      // Ignore abort errors (they're intentional when navigating away)
      if (err.name === 'AbortError') {
        console.log('🛑 Request aborted (component unmounted)');
        return;
      }
      
      if (!isMountedRef.current) return;
      
      console.error('❌ Processing error:', err);
      setError(err.message || 'Failed to process 10-K filing. Please try again.');
    } finally {
      if (isMountedRef.current) {
        setIsProcessing(false);
      }
    }
  };

  const handleReset = () => {
    setFile(null);
    setFinancialData(null);
    setError(null);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value) + 'M';
  };

  const calculateCAGR = (startValue: number, endValue: number, years: number) => {
    if (!startValue || !endValue || startValue <= 0 || endValue <= 0) return 0;
    return (Math.pow(endValue / startValue, 1 / years) - 1) * 100;
  };

  const safeAccess = (arr: number[] | undefined, index: number): number => {
    return arr && arr[index] !== undefined ? arr[index] : 0;
  };

  // Prepare waterfall chart data - shows full P&L flow for most recent year
  const getWaterfallData = () => {
    if (!financialData || !financialData.revenue || financialData.revenue.length < 3) return [];

    // Use most recent year (index 2)
    const idx = 2;
    const data = [
      { name: 'Revenue', value: safeAccess(financialData.revenue, idx), fill: '#8b5cf6' },
      { name: 'COGS', value: -safeAccess(financialData.cost_of_sales, idx), fill: '#ef4444' },
      { name: 'Gross Profit', value: safeAccess(financialData.gross_profit, idx), fill: '#10b981' },
    ];

    // Add OpEx items dynamically (only if > 0)
    // Note: D&A is NOT shown here - it's embedded in the operating expenses above
    if (safeAccess(financialData.research_and_development, idx) > 0) {
      data.push({ name: 'R&D', value: -safeAccess(financialData.research_and_development, idx), fill: '#f59e0b' });
    }
    if (safeAccess(financialData.sales_and_marketing, idx) > 0) {
      data.push({ name: 'Sales & Marketing', value: -safeAccess(financialData.sales_and_marketing, idx), fill: '#f59e0b' });
    }
    if (safeAccess(financialData.selling_general_admin, idx) > 0) {
      data.push({ name: 'SG&A', value: -safeAccess(financialData.selling_general_admin, idx), fill: '#f59e0b' });
    }
    if (safeAccess(financialData.other_operating_expenses, idx) > 0) {
      data.push({ name: 'Other OpEx', value: -safeAccess(financialData.other_operating_expenses, idx), fill: '#f59e0b' });
    }

    // EBIT (Operating Profit) - D&A is already embedded in the expenses above
    data.push({ name: 'EBIT', value: safeAccess(financialData.operating_profit, idx), fill: '#06b6d4' });

    // Add interest & other if applicable
    if (safeAccess(financialData.interest_income, idx) > 0) {
      data.push({ name: 'Interest Inc.', value: safeAccess(financialData.interest_income, idx), fill: '#10b981' });
    }
    if (safeAccess(financialData.interest_expense, idx) > 0) {
      data.push({ name: 'Interest Exp.', value: -safeAccess(financialData.interest_expense, idx), fill: '#ef4444' });
    }

    // Taxes and net income
    data.push({ name: 'Taxes', value: -safeAccess(financialData.income_tax_expense, idx), fill: '#ef4444' });
    data.push({ name: 'Net Income', value: safeAccess(financialData.net_income, idx), fill: '#3b82f6' });

    return data;
  };

  // Export to Excel with professional PE formatting
  const exportToExcel = async () => {
    if (!financialData) return;

    const wb = new ExcelJS.Workbook();
    
    // Helper to get numeric value (0 for missing data)
    const getVal = (val: number) => {
      return val || 0;
    };

    // ==================== INCOME STATEMENT SHEET ====================
    const wsIncome = wb.addWorksheet('Income Statement');
    
    // Set column widths
    wsIncome.getColumn(1).width = 45;
    wsIncome.getColumn(2).width = 18;
    wsIncome.getColumn(3).width = 18;
    wsIncome.getColumn(4).width = 18;

    // Define styles
    const blueInputStyle = {
      font: { color: { argb: 'FF0563C1' } }, // Blue
      numFmt: '#,##0;(#,##0);-', // Numbers with commas, negatives in parentheses
      alignment: { horizontal: 'right' as const }
    };

    const boldCalcStyle = {
      font: { bold: true },
      numFmt: '#,##0;(#,##0);-',
      alignment: { horizontal: 'right' as const }
    };

    // Headers
    wsIncome.getCell('A1').value = 'Income Statement';
    wsIncome.getCell('A2').value = '($ in millions)';
    wsIncome.getCell('B2').value = `${safeAccess(financialData.fiscal_years, 0)}A`;
    wsIncome.getCell('C2').value = `${safeAccess(financialData.fiscal_years, 1)}A`;
    wsIncome.getCell('D2').value = `${safeAccess(financialData.fiscal_years, 2)}A`;
    wsIncome.getCell('A3').value = 'Fiscal Year Ended';
    wsIncome.getCell('B3').value = `Sep ${safeAccess(financialData.fiscal_years, 0)}`;
    wsIncome.getCell('C3').value = `Sep ${safeAccess(financialData.fiscal_years, 1)}`;
    wsIncome.getCell('D3').value = `Sep ${safeAccess(financialData.fiscal_years, 2)}`;

    let row = 5;
    
    // Revenue (Blue input)
    wsIncome.getCell(`A${row}`).value = 'Revenue';
    wsIncome.getCell(`B${row}`).value = getVal(safeAccess(financialData.revenue, 0));
    wsIncome.getCell(`C${row}`).value = getVal(safeAccess(financialData.revenue, 1));
    wsIncome.getCell(`D${row}`).value = getVal(safeAccess(financialData.revenue, 2));
    ['B', 'C', 'D'].forEach(col => { wsIncome.getCell(`${col}${row}`).style = blueInputStyle; });
    row++;

    // Cost of sales (Blue input, negative)
    wsIncome.getCell(`A${row}`).value = 'Cost of sales';
    wsIncome.getCell(`B${row}`).value = -getVal(safeAccess(financialData.cost_of_sales, 0));
    wsIncome.getCell(`C${row}`).value = -getVal(safeAccess(financialData.cost_of_sales, 1));
    wsIncome.getCell(`D${row}`).value = -getVal(safeAccess(financialData.cost_of_sales, 2));
    ['B', 'C', 'D'].forEach(col => { wsIncome.getCell(`${col}${row}`).style = blueInputStyle; });
    row++;

    // Gross profit (Bold calc)
    wsIncome.getCell(`A${row}`).value = 'Gross profit';
    wsIncome.getCell(`B${row}`).value = getVal(safeAccess(financialData.gross_profit, 0));
    wsIncome.getCell(`C${row}`).value = getVal(safeAccess(financialData.gross_profit, 1));
    wsIncome.getCell(`D${row}`).value = getVal(safeAccess(financialData.gross_profit, 2));
    ['B', 'C', 'D'].forEach(col => { wsIncome.getCell(`${col}${row}`).style = boldCalcStyle; });
    row += 2; // Blank row

    // Operating expenses
    if (safeAccess(financialData.research_and_development, 2) > 0) {
      wsIncome.getCell(`A${row}`).value = 'Research and development';
      wsIncome.getCell(`B${row}`).value = -getVal(safeAccess(financialData.research_and_development, 0));
      wsIncome.getCell(`C${row}`).value = -getVal(safeAccess(financialData.research_and_development, 1));
      wsIncome.getCell(`D${row}`).value = -getVal(safeAccess(financialData.research_and_development, 2));
      ['B', 'C', 'D'].forEach(col => { wsIncome.getCell(`${col}${row}`).style = blueInputStyle; });
      row++;
    }
    
    if (safeAccess(financialData.sales_and_marketing, 2) > 0) {
      wsIncome.getCell(`A${row}`).value = 'Sales and marketing';
      wsIncome.getCell(`B${row}`).value = -getVal(safeAccess(financialData.sales_and_marketing, 0));
      wsIncome.getCell(`C${row}`).value = -getVal(safeAccess(financialData.sales_and_marketing, 1));
      wsIncome.getCell(`D${row}`).value = -getVal(safeAccess(financialData.sales_and_marketing, 2));
      ['B', 'C', 'D'].forEach(col => { wsIncome.getCell(`${col}${row}`).style = blueInputStyle; });
      row++;
    }
    
    if (safeAccess(financialData.selling_general_admin, 2) > 0) {
      wsIncome.getCell(`A${row}`).value = 'Selling, general and administrative';
      wsIncome.getCell(`B${row}`).value = -getVal(safeAccess(financialData.selling_general_admin, 0));
      wsIncome.getCell(`C${row}`).value = -getVal(safeAccess(financialData.selling_general_admin, 1));
      wsIncome.getCell(`D${row}`).value = -getVal(safeAccess(financialData.selling_general_admin, 2));
      ['B', 'C', 'D'].forEach(col => { wsIncome.getCell(`${col}${row}`).style = blueInputStyle; });
      row++;
    }
    
    if (safeAccess(financialData.other_operating_expenses, 2) > 0) {
      wsIncome.getCell(`A${row}`).value = 'Other operating expenses';
      wsIncome.getCell(`B${row}`).value = -getVal(safeAccess(financialData.other_operating_expenses, 0));
      wsIncome.getCell(`C${row}`).value = -getVal(safeAccess(financialData.other_operating_expenses, 1));
      wsIncome.getCell(`D${row}`).value = -getVal(safeAccess(financialData.other_operating_expenses, 2));
      ['B', 'C', 'D'].forEach(col => { wsIncome.getCell(`${col}${row}`).style = blueInputStyle; });
      row++;
    }

    // Operating income (Bold calc)
    wsIncome.getCell(`A${row}`).value = 'Operating income / (loss)';
    wsIncome.getCell(`B${row}`).value = getVal(safeAccess(financialData.operating_profit, 0));
    wsIncome.getCell(`C${row}`).value = getVal(safeAccess(financialData.operating_profit, 1));
    wsIncome.getCell(`D${row}`).value = getVal(safeAccess(financialData.operating_profit, 2));
    ['B', 'C', 'D'].forEach(col => { wsIncome.getCell(`${col}${row}`).style = boldCalcStyle; });
    row += 2; // Blank row

    // Interest and dividend income (Blue input)
    wsIncome.getCell(`A${row}`).value = 'Interest and dividend income';
    wsIncome.getCell(`B${row}`).value = getVal(safeAccess(financialData.interest_income, 0));
    wsIncome.getCell(`C${row}`).value = getVal(safeAccess(financialData.interest_income, 1));
    wsIncome.getCell(`D${row}`).value = getVal(safeAccess(financialData.interest_income, 2));
    ['B', 'C', 'D'].forEach(col => { wsIncome.getCell(`${col}${row}`).style = blueInputStyle; });
    row++;

    // Interest expense (Blue input, negative)
    wsIncome.getCell(`A${row}`).value = 'Interest expense';
    wsIncome.getCell(`B${row}`).value = -getVal(safeAccess(financialData.interest_expense, 0));
    wsIncome.getCell(`C${row}`).value = -getVal(safeAccess(financialData.interest_expense, 1));
    wsIncome.getCell(`D${row}`).value = -getVal(safeAccess(financialData.interest_expense, 2));
    ['B', 'C', 'D'].forEach(col => { wsIncome.getCell(`${col}${row}`).style = blueInputStyle; });
    row++;

    // Other income/expense (Blue input)
    wsIncome.getCell(`A${row}`).value = 'Other income / (expense), net';
    wsIncome.getCell(`B${row}`).value = getVal(safeAccess(financialData.other_income_expense, 0));
    wsIncome.getCell(`C${row}`).value = getVal(safeAccess(financialData.other_income_expense, 1));
    wsIncome.getCell(`D${row}`).value = getVal(safeAccess(financialData.other_income_expense, 2));
    ['B', 'C', 'D'].forEach(col => { wsIncome.getCell(`${col}${row}`).style = blueInputStyle; });
    row++;

    // Pretax profit (Bold calc)
    wsIncome.getCell(`A${row}`).value = 'Income / (loss) before provision for income taxes';
    wsIncome.getCell(`B${row}`).value = getVal(safeAccess(financialData.pretax_profit, 0));
    wsIncome.getCell(`C${row}`).value = getVal(safeAccess(financialData.pretax_profit, 1));
    wsIncome.getCell(`D${row}`).value = getVal(safeAccess(financialData.pretax_profit, 2));
    ['B', 'C', 'D'].forEach(col => { wsIncome.getCell(`${col}${row}`).style = boldCalcStyle; });
    row++;

    // Taxes (Blue input, negative)
    wsIncome.getCell(`A${row}`).value = 'Provision for / (benefit from) income taxes';
    wsIncome.getCell(`B${row}`).value = -getVal(safeAccess(financialData.income_tax_expense, 0));
    wsIncome.getCell(`C${row}`).value = -getVal(safeAccess(financialData.income_tax_expense, 1));
    wsIncome.getCell(`D${row}`).value = -getVal(safeAccess(financialData.income_tax_expense, 2));
    ['B', 'C', 'D'].forEach(col => { wsIncome.getCell(`${col}${row}`).style = blueInputStyle; });
    row++;

    // Net income (Bold calc)
    wsIncome.getCell(`A${row}`).value = 'Net income / (loss)';
    wsIncome.getCell(`B${row}`).value = getVal(safeAccess(financialData.net_income, 0));
    wsIncome.getCell(`C${row}`).value = getVal(safeAccess(financialData.net_income, 1));
    wsIncome.getCell(`D${row}`).value = getVal(safeAccess(financialData.net_income, 2));
    ['B', 'C', 'D'].forEach(col => { wsIncome.getCell(`${col}${row}`).style = boldCalcStyle; });
    row += 2; // Blank row

    // D&A (Blue input)
    wsIncome.getCell(`A${row}`).value = 'Depreciation & amortization';
    wsIncome.getCell(`B${row}`).value = getVal(safeAccess(financialData.depreciation_amortization, 0));
    wsIncome.getCell(`C${row}`).value = getVal(safeAccess(financialData.depreciation_amortization, 1));
    wsIncome.getCell(`D${row}`).value = getVal(safeAccess(financialData.depreciation_amortization, 2));
    ['B', 'C', 'D'].forEach(col => { wsIncome.getCell(`${col}${row}`).style = blueInputStyle; });
    row++;

    // EBITDA (Bold calc)
    wsIncome.getCell(`A${row}`).value = 'EBITDA';
    wsIncome.getCell(`B${row}`).value = getVal(safeAccess(financialData.ebitda, 0));
    wsIncome.getCell(`C${row}`).value = getVal(safeAccess(financialData.ebitda, 1));
    wsIncome.getCell(`D${row}`).value = getVal(safeAccess(financialData.ebitda, 2));
    ['B', 'C', 'D'].forEach(col => { wsIncome.getCell(`${col}${row}`).style = boldCalcStyle; });
    row += 2; // Blank row

    // Stock-based compensation (Blue input)
    wsIncome.getCell(`A${row}`).value = 'Stock-based compensation';
    wsIncome.getCell(`B${row}`).value = getVal(safeAccess(financialData.stock_based_compensation, 0));
    wsIncome.getCell(`C${row}`).value = getVal(safeAccess(financialData.stock_based_compensation, 1));
    wsIncome.getCell(`D${row}`).value = getVal(safeAccess(financialData.stock_based_compensation, 2));
    ['B', 'C', 'D'].forEach(col => { wsIncome.getCell(`${col}${row}`).style = blueInputStyle; });
    row++;

    // Adjusted EBITDA (Bold calc)
    wsIncome.getCell(`A${row}`).value = 'Adjusted EBITDA';
    wsIncome.getCell(`B${row}`).value = getVal(safeAccess(financialData.adjusted_ebitda, 0));
    wsIncome.getCell(`C${row}`).value = getVal(safeAccess(financialData.adjusted_ebitda, 1));
    wsIncome.getCell(`D${row}`).value = getVal(safeAccess(financialData.adjusted_ebitda, 2));
    ['B', 'C', 'D'].forEach(col => { wsIncome.getCell(`${col}${row}`).style = boldCalcStyle; });

    // ==================== BALANCE SHEET SHEET ====================
    const wsBalance = wb.addWorksheet('Balance Sheet');
    
    // Set column widths
    wsBalance.getColumn(1).width = 45;
    wsBalance.getColumn(2).width = 18;
    wsBalance.getColumn(3).width = 18;

    // Headers
    wsBalance.getCell('A1').value = 'Balance Sheet';
    wsBalance.getCell('A2').value = '($ in millions)';
    wsBalance.getCell('B2').value = `${safeAccess(financialData.fiscal_years, 1)}A`;
    wsBalance.getCell('C2').value = `${safeAccess(financialData.fiscal_years, 2)}A`;
    wsBalance.getCell('A3').value = 'Fiscal Year Ended';
    wsBalance.getCell('B3').value = `Sep ${safeAccess(financialData.fiscal_years, 1)}`;
    wsBalance.getCell('C3').value = `Sep ${safeAccess(financialData.fiscal_years, 2)}`;

    let bsRow = 5;
    wsBalance.getCell(`A${bsRow}`).value = 'ASSETS';
    bsRow++;
    wsBalance.getCell(`A${bsRow}`).value = 'Current assets:';
    bsRow++;

    // Cash (Blue input)
    wsBalance.getCell(`A${bsRow}`).value = 'Cash and cash equivalents';
    wsBalance.getCell(`B${bsRow}`).value = getVal(safeAccess(financialData.cash_and_equivalents, 1));
    wsBalance.getCell(`C${bsRow}`).value = getVal(safeAccess(financialData.cash_and_equivalents, 2));
    ['B', 'C'].forEach(col => { wsBalance.getCell(`${col}${bsRow}`).style = blueInputStyle; });
    bsRow++;

    // AR (Blue input)
    wsBalance.getCell(`A${bsRow}`).value = 'Accounts receivable, net';
    wsBalance.getCell(`B${bsRow}`).value = getVal(safeAccess(financialData.accounts_receivable, 1));
    wsBalance.getCell(`C${bsRow}`).value = getVal(safeAccess(financialData.accounts_receivable, 2));
    ['B', 'C'].forEach(col => { wsBalance.getCell(`${col}${bsRow}`).style = blueInputStyle; });
    bsRow++;

    if (safeAccess(financialData.inventories, 2) > 0) {
      wsBalance.getCell(`A${bsRow}`).value = 'Inventories';
      wsBalance.getCell(`B${bsRow}`).value = getVal(safeAccess(financialData.inventories, 1));
      wsBalance.getCell(`C${bsRow}`).value = getVal(safeAccess(financialData.inventories, 2));
      ['B', 'C'].forEach(col => { wsBalance.getCell(`${col}${bsRow}`).style = blueInputStyle; });
      bsRow++;
    }

    if (safeAccess(financialData.other_current_assets, 2) > 0) {
      wsBalance.getCell(`A${bsRow}`).value = 'Other current assets';
      wsBalance.getCell(`B${bsRow}`).value = getVal(safeAccess(financialData.other_current_assets, 1));
      wsBalance.getCell(`C${bsRow}`).value = getVal(safeAccess(financialData.other_current_assets, 2));
      ['B', 'C'].forEach(col => { wsBalance.getCell(`${col}${bsRow}`).style = blueInputStyle; });
      bsRow++;
    }

    // Total current assets (Bold calc)
    wsBalance.getCell(`A${bsRow}`).value = 'Total current assets';
    wsBalance.getCell(`B${bsRow}`).value = getVal(safeAccess(financialData.total_current_assets, 1));
    wsBalance.getCell(`C${bsRow}`).value = getVal(safeAccess(financialData.total_current_assets, 2));
    ['B', 'C'].forEach(col => { wsBalance.getCell(`${col}${bsRow}`).style = boldCalcStyle; });
    bsRow += 2;

    wsBalance.getCell(`A${bsRow}`).value = 'Non-current assets:';
    bsRow++;

    // PPE (Blue input)
    wsBalance.getCell(`A${bsRow}`).value = 'Property, plant and equipment, net';
    wsBalance.getCell(`B${bsRow}`).value = getVal(safeAccess(financialData.property_plant_equipment, 1));
    wsBalance.getCell(`C${bsRow}`).value = getVal(safeAccess(financialData.property_plant_equipment, 2));
    ['B', 'C'].forEach(col => { wsBalance.getCell(`${col}${bsRow}`).style = blueInputStyle; });
    bsRow++;

    if (safeAccess(financialData.other_noncurrent_assets, 2) > 0) {
      wsBalance.getCell(`A${bsRow}`).value = 'Other non-current assets';
      wsBalance.getCell(`B${bsRow}`).value = getVal(safeAccess(financialData.other_noncurrent_assets, 1));
      wsBalance.getCell(`C${bsRow}`).value = getVal(safeAccess(financialData.other_noncurrent_assets, 2));
      ['B', 'C'].forEach(col => { wsBalance.getCell(`${col}${bsRow}`).style = blueInputStyle; });
      bsRow++;
    }

    // Total assets (Bold calc)
    wsBalance.getCell(`A${bsRow}`).value = 'Total assets';
    wsBalance.getCell(`B${bsRow}`).value = getVal(safeAccess(financialData.total_assets, 1));
    wsBalance.getCell(`C${bsRow}`).value = getVal(safeAccess(financialData.total_assets, 2));
    ['B', 'C'].forEach(col => { wsBalance.getCell(`${col}${bsRow}`).style = boldCalcStyle; });
    bsRow += 2;

    wsBalance.getCell(`A${bsRow}`).value = 'LIABILITIES AND STOCKHOLDERS\' EQUITY';
    bsRow++;
    wsBalance.getCell(`A${bsRow}`).value = 'Current liabilities:';
    bsRow++;

    // AP (Blue input)
    wsBalance.getCell(`A${bsRow}`).value = 'Accounts payable';
    wsBalance.getCell(`B${bsRow}`).value = getVal(safeAccess(financialData.accounts_payable, 1));
    wsBalance.getCell(`C${bsRow}`).value = getVal(safeAccess(financialData.accounts_payable, 2));
    ['B', 'C'].forEach(col => { wsBalance.getCell(`${col}${bsRow}`).style = blueInputStyle; });
    bsRow++;

    if (safeAccess(financialData.other_current_liabilities, 2) > 0) {
      wsBalance.getCell(`A${bsRow}`).value = 'Other current liabilities';
      wsBalance.getCell(`B${bsRow}`).value = getVal(safeAccess(financialData.other_current_liabilities, 1));
      wsBalance.getCell(`C${bsRow}`).value = getVal(safeAccess(financialData.other_current_liabilities, 2));
      ['B', 'C'].forEach(col => { wsBalance.getCell(`${col}${bsRow}`).style = blueInputStyle; });
      bsRow++;
    }

    if (safeAccess(financialData.deferred_revenue, 2) > 0) {
      wsBalance.getCell(`A${bsRow}`).value = 'Deferred revenue';
      wsBalance.getCell(`B${bsRow}`).value = getVal(safeAccess(financialData.deferred_revenue, 1));
      wsBalance.getCell(`C${bsRow}`).value = getVal(safeAccess(financialData.deferred_revenue, 2));
      ['B', 'C'].forEach(col => { wsBalance.getCell(`${col}${bsRow}`).style = blueInputStyle; });
      bsRow++;
    }

    if (safeAccess(financialData.short_term_debt, 2) > 0) {
      wsBalance.getCell(`A${bsRow}`).value = 'Commercial paper / Short-term debt';
      wsBalance.getCell(`B${bsRow}`).value = getVal(safeAccess(financialData.short_term_debt, 1));
      wsBalance.getCell(`C${bsRow}`).value = getVal(safeAccess(financialData.short_term_debt, 2));
      ['B', 'C'].forEach(col => { wsBalance.getCell(`${col}${bsRow}`).style = blueInputStyle; });
      bsRow++;
    }

    // Total current liabilities (Bold calc)
    wsBalance.getCell(`A${bsRow}`).value = 'Total current liabilities';
    wsBalance.getCell(`B${bsRow}`).value = getVal(safeAccess(financialData.total_current_liabilities, 1));
    wsBalance.getCell(`C${bsRow}`).value = getVal(safeAccess(financialData.total_current_liabilities, 2));
    ['B', 'C'].forEach(col => { wsBalance.getCell(`${col}${bsRow}`).style = boldCalcStyle; });
    bsRow += 2;

    wsBalance.getCell(`A${bsRow}`).value = 'Non-current liabilities:';
    bsRow++;

    if (safeAccess(financialData.long_term_debt, 2) > 0) {
      wsBalance.getCell(`A${bsRow}`).value = 'Long-term debt';
      wsBalance.getCell(`B${bsRow}`).value = getVal(safeAccess(financialData.long_term_debt, 1));
      wsBalance.getCell(`C${bsRow}`).value = getVal(safeAccess(financialData.long_term_debt, 2));
      ['B', 'C'].forEach(col => { wsBalance.getCell(`${col}${bsRow}`).style = blueInputStyle; });
      bsRow++;
    }

    if (safeAccess(financialData.other_noncurrent_liabilities, 2) > 0) {
      wsBalance.getCell(`A${bsRow}`).value = 'Other non-current liabilities';
      wsBalance.getCell(`B${bsRow}`).value = getVal(safeAccess(financialData.other_noncurrent_liabilities, 1));
      wsBalance.getCell(`C${bsRow}`).value = getVal(safeAccess(financialData.other_noncurrent_liabilities, 2));
      ['B', 'C'].forEach(col => { wsBalance.getCell(`${col}${bsRow}`).style = blueInputStyle; });
      bsRow++;
    }

    // Total liabilities (Bold calc)
    wsBalance.getCell(`A${bsRow}`).value = 'Total liabilities';
    wsBalance.getCell(`B${bsRow}`).value = getVal(safeAccess(financialData.total_liabilities, 1));
    wsBalance.getCell(`C${bsRow}`).value = getVal(safeAccess(financialData.total_liabilities, 2));
    ['B', 'C'].forEach(col => { wsBalance.getCell(`${col}${bsRow}`).style = boldCalcStyle; });
    bsRow += 2;

    wsBalance.getCell(`A${bsRow}`).value = 'Stockholders\' equity:';
    bsRow++;

    // Common stock (Blue input)
    wsBalance.getCell(`A${bsRow}`).value = 'Common stock and additional paid-in capital';
    wsBalance.getCell(`B${bsRow}`).value = getVal(safeAccess(financialData.common_stock, 1));
    wsBalance.getCell(`C${bsRow}`).value = getVal(safeAccess(financialData.common_stock, 2));
    ['B', 'C'].forEach(col => { wsBalance.getCell(`${col}${bsRow}`).style = blueInputStyle; });
    bsRow++;

    // Retained earnings (Blue input)
    wsBalance.getCell(`A${bsRow}`).value = 'Retained earnings';
    wsBalance.getCell(`B${bsRow}`).value = getVal(safeAccess(financialData.retained_earnings, 1));
    wsBalance.getCell(`C${bsRow}`).value = getVal(safeAccess(financialData.retained_earnings, 2));
    ['B', 'C'].forEach(col => { wsBalance.getCell(`${col}${bsRow}`).style = blueInputStyle; });
    bsRow++;

    if (safeAccess(financialData.other_equity, 2) !== 0) {
      wsBalance.getCell(`A${bsRow}`).value = 'Accumulated other comprehensive income/(loss)';
      wsBalance.getCell(`B${bsRow}`).value = getVal(safeAccess(financialData.other_equity, 1));
      wsBalance.getCell(`C${bsRow}`).value = getVal(safeAccess(financialData.other_equity, 2));
      ['B', 'C'].forEach(col => { wsBalance.getCell(`${col}${bsRow}`).style = blueInputStyle; });
      bsRow++;
    }

    // Total equity (Bold calc)
    wsBalance.getCell(`A${bsRow}`).value = 'Total stockholders\' equity';
    wsBalance.getCell(`B${bsRow}`).value = getVal(safeAccess(financialData.total_equity, 1));
    wsBalance.getCell(`C${bsRow}`).value = getVal(safeAccess(financialData.total_equity, 2));
    ['B', 'C'].forEach(col => { wsBalance.getCell(`${col}${bsRow}`).style = boldCalcStyle; });
    bsRow += 2;

    // Total liabilities and equity (Bold calc)
    wsBalance.getCell(`A${bsRow}`).value = 'Total liabilities and stockholders\' equity';
    wsBalance.getCell(`B${bsRow}`).value = getVal(safeAccess(financialData.total_liabilities, 1)) + getVal(safeAccess(financialData.total_equity, 1));
    wsBalance.getCell(`C${bsRow}`).value = getVal(safeAccess(financialData.total_liabilities, 2)) + getVal(safeAccess(financialData.total_equity, 2));
    ['B', 'C'].forEach(col => { wsBalance.getCell(`${col}${bsRow}`).style = boldCalcStyle; });
    bsRow += 2;

    // Balance check
    wsBalance.getCell(`A${bsRow}`).value = 'Balance Check (should be zero)';
    wsBalance.getCell(`B${bsRow}`).value = getVal(safeAccess(financialData.total_assets, 1)) - getVal(safeAccess(financialData.total_liabilities, 1)) - getVal(safeAccess(financialData.total_equity, 1));
    wsBalance.getCell(`C${bsRow}`).value = getVal(safeAccess(financialData.total_assets, 2)) - getVal(safeAccess(financialData.total_liabilities, 2)) - getVal(safeAccess(financialData.total_equity, 2));
    ['B', 'C'].forEach(col => { wsBalance.getCell(`${col}${bsRow}`).style = blueInputStyle; });

    // Generate file name
    const companyName = financialData.company_name.replace(/[^a-z0-9]/gi, '_');
    const mostRecentYear = safeAccess(financialData.fiscal_years, 2);
    const fileName = `${companyName}_10K_Analysis_${mostRecentYear}.xlsx`;

    // Download file
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-purple-300 hover:text-purple-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}>Back to Home</span>
          </button>
          <h1
            className="text-white"
            style={{
              fontSize: 'clamp(18px, 3vw, 24px)',
              fontWeight: '700',
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: '-0.02em',
            }}
          >
            10-K Financial Analyzer
          </h1>
          <div className="w-24" /> {/* Spacer for centering */}
        </div>
      </div>

      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Upload Section */}
          <AnimatePresence mode="wait">
            {!financialData && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="text-center mb-12"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="mb-8"
                >
                  <h2
                    className="text-white mb-4"
                    style={{
                      fontSize: 'clamp(28px, 5vw, 48px)',
                      fontWeight: '900',
                      fontFamily: "'Outfit', sans-serif",
                      letterSpacing: '-0.03em',
                    }}
                  >
                    Extract Financial Metrics from 10-K Filings
                  </h2>
                  <p
                    className="text-purple-200/80 max-w-2xl mx-auto"
                    style={{
                      fontSize: 'clamp(15px, 2vw, 18px)',
                      fontFamily: "'Manrope', sans-serif",
                      lineHeight: '1.6',
                    }}
                  >
                    Upload a 10-K filing and our AI will automatically extract key financial metrics including Revenue, COGS, R&D, SG&A, and calculate Gross Profit and EBIT.
                  </p>
                </motion.div>

                {/* Upload Box */}
                {!isProcessing && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: 0.3 }}
                    className="max-w-xl mx-auto"
                  >
                    <label className="block">
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={handleFileChange}
                        className="hidden"
                        disabled={isProcessing}
                      />
                      <div
                        className="border-2 border-dashed border-purple-500/50 rounded-2xl p-12 cursor-pointer hover:border-purple-400 hover:bg-purple-500/5 transition-all duration-300"
                        style={{
                          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.05), rgba(217, 70, 239, 0.05))',
                        }}
                      >
                        {file ? (
                          <div className="flex flex-col items-center gap-4">
                            <FileText className="w-16 h-16 text-purple-400" strokeWidth={1.5} />
                            <div>
                              <p className="text-white font-semibold mb-1">{file.name}</p>
                              <p className="text-purple-300 text-sm">
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-4">
                            <Upload className="w-16 h-16 text-purple-400" strokeWidth={1.5} />
                            <div>
                              <p className="text-white font-semibold mb-1">
                                Click to upload 10-K filing
                              </p>
                              <p className="text-purple-300 text-sm">PDF format supported</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </label>

                    {file && !isProcessing && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        onClick={handleUpload}
                        className="mt-6 px-8 py-4 rounded-full transition-all duration-300 hover:scale-105 active:scale-95"
                        style={{
                          background: 'linear-gradient(135deg, #8b5cf6 0%, #d946ef 50%, #f97316 100%)',
                          boxShadow: '0 20px 60px rgba(139, 92, 246, 0.5)',
                          fontFamily: "'Outfit', sans-serif",
                          fontWeight: '700',
                          fontSize: '18px',
                        }}
                      >
                        Analyze 10-K
                      </motion.button>
                    )}

                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg"
                      >
                        <p className="text-red-300">{error}</p>
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {/* Processing Stages - Full Screen */}
                {isProcessing && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="max-w-2xl mx-auto"
                  >
                    <ProcessingStages type="pe" />
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results Section */}
          <AnimatePresence>
            {financialData && financialData.revenue && financialData.fiscal_years && financialData.revenue.length === 3 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-8"
              >
                {/* Company Header */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-center"
                >
                  <h2
                    className="text-white mb-2"
                    style={{
                      fontSize: 'clamp(32px, 5vw, 48px)',
                      fontWeight: '900',
                      fontFamily: "'Outfit', sans-serif",
                    }}
                  >
                    {financialData?.company_name || 'Unknown Company'}
                  </h2>
                  <div className="flex items-center justify-center gap-3 flex-wrap">
                    <p className="text-purple-300 text-xl" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      Fiscal Years {safeAccess(financialData?.fiscal_years, 0)}–{safeAccess(financialData?.fiscal_years, 2)}
                    </p>
                    <span className="px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-300 text-sm capitalize">
                      {financialData?.company_type || 'Unknown'}
                    </span>
                  </div>
                </motion.div>

                {/* Key Metrics Cards - Row 1 */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="grid grid-cols-1 md:grid-cols-4 gap-6"
                >
                  <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <DollarSign className="w-6 h-6 text-purple-300" />
                      <h3 className="text-purple-200 font-semibold" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        Revenue
                      </h3>
                    </div>
                    <p className="text-white text-3xl font-bold" style={{ fontFamily: "'Outfit', sans-serif" }}>
                      {formatCurrency(safeAccess(financialData?.revenue, 2))}
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <TrendingUp className="w-6 h-6 text-green-300" />
                      <h3 className="text-green-200 font-semibold" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        EBITDA
                      </h3>
                    </div>
                    <p className="text-white text-3xl font-bold" style={{ fontFamily: "'Outfit', sans-serif" }}>
                      {formatCurrency(safeAccess(financialData?.ebitda, 2))}
                    </p>
                    <p className="text-green-300 text-sm mt-1">
                      {safeAccess(financialData?.ebitda_margin, 2).toFixed(1)}% margin
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/30 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <PieChart className="w-6 h-6 text-cyan-300" />
                      <h3 className="text-cyan-200 font-semibold" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        EBIT
                      </h3>
                    </div>
                    <p className="text-white text-3xl font-bold" style={{ fontFamily: "'Outfit', sans-serif" }}>
                      {formatCurrency(safeAccess(financialData?.operating_profit, 2))}
                    </p>
                    <p className="text-cyan-300 text-sm mt-1">
                      {safeAccess(financialData?.operating_margin, 2).toFixed(1)}% margin
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <TrendingUp className="w-6 h-6 text-blue-300" />
                      <h3 className="text-blue-200 font-semibold" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        Net Income
                      </h3>
                    </div>
                    <p className="text-white text-3xl font-bold" style={{ fontFamily: "'Outfit', sans-serif" }}>
                      {formatCurrency(safeAccess(financialData?.net_income, 2))}
                    </p>
                    <p className="text-blue-300 text-sm mt-1">
                      {safeAccess(financialData?.net_income_margin, 2).toFixed(1)}% margin
                    </p>
                  </div>
                </motion.div>

                {/* Year-over-Year Growth Metrics */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="bg-gradient-to-br from-purple-500/10 to-violet-500/10 border border-purple-500/20 rounded-2xl p-6"
                >
                  <h3
                    className="text-white mb-4 text-lg md:text-xl"
                    style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '700' }}
                  >
                    📈 3-Year Growth Metrics (CAGR)
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className="text-white/60 text-sm mb-1" style={{ fontFamily: "'Manrope', sans-serif" }}>Revenue</p>
                      <p className={`text-2xl font-bold ${calculateCAGR(safeAccess(financialData?.revenue, 0), safeAccess(financialData?.revenue, 2), 2) >= 0 ? 'text-green-400' : 'text-red-400'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                        {calculateCAGR(safeAccess(financialData?.revenue, 0), safeAccess(financialData?.revenue, 2), 2).toFixed(1)}%
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-white/60 text-sm mb-1" style={{ fontFamily: "'Manrope', sans-serif" }}>EBITDA</p>
                      <p className={`text-2xl font-bold ${calculateCAGR(safeAccess(financialData?.ebitda, 0), safeAccess(financialData?.ebitda, 2), 2) >= 0 ? 'text-green-400' : 'text-red-400'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                        {calculateCAGR(safeAccess(financialData?.ebitda, 0), safeAccess(financialData?.ebitda, 2), 2).toFixed(1)}%
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-white/60 text-sm mb-1" style={{ fontFamily: "'Manrope', sans-serif" }}>Operating Profit</p>
                      <p className={`text-2xl font-bold ${calculateCAGR(safeAccess(financialData?.operating_profit, 0), safeAccess(financialData?.operating_profit, 2), 2) >= 0 ? 'text-green-400' : 'text-red-400'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                        {calculateCAGR(safeAccess(financialData?.operating_profit, 0), safeAccess(financialData?.operating_profit, 2), 2).toFixed(1)}%
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-white/60 text-sm mb-1" style={{ fontFamily: "'Manrope', sans-serif" }}>Net Income</p>
                      <p className={`text-2xl font-bold ${calculateCAGR(safeAccess(financialData?.net_income, 0), safeAccess(financialData?.net_income, 2), 2) >= 0 ? 'text-green-400' : 'text-red-400'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                        {calculateCAGR(safeAccess(financialData?.net_income, 0), safeAccess(financialData?.net_income, 2), 2).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </motion.div>

                {/* Financial Breakdown Chart */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-white/5 border border-white/10 rounded-2xl p-8"
                >
                  <h3
                    className="text-white mb-6 text-xl md:text-2xl"
                    style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '700' }}
                  >
                    P&L Waterfall: Revenue to Net Income
                  </h3>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={getWaterfallData()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                      <XAxis dataKey="name" stroke="#ffffff80" style={{ fontFamily: "'Manrope', sans-serif" }} />
                      <YAxis stroke="#ffffff80" style={{ fontFamily: "'Manrope', sans-serif" }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1a1a1a',
                          border: '1px solid rgba(139, 92, 246, 0.3)',
                          borderRadius: '8px',
                          fontFamily: "'Manrope', sans-serif",
                          color: '#ffffff',
                        }}
                        labelStyle={{
                          color: '#c4b5fd',
                          fontWeight: '600',
                        }}
                        itemStyle={{
                          color: '#ffffff',
                        }}
                        formatter={(value: any) => formatCurrency(Math.abs(value))}
                      />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                        {getWaterfallData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </motion.div>

                {/* Detailed Table */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="bg-white/5 border border-white/10 rounded-2xl p-8 overflow-x-auto"
                >
                  <h3
                    className="text-white mb-6 text-xl md:text-2xl"
                    style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '700' }}
                  >
                    Income Statement (in millions)
                  </h3>
                  <div className="overflow-x-auto">
                  <table className="w-full" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    <thead>
                      <tr className="border-b-2 border-white/20">
                        <th className="py-3 text-left text-white/60 font-semibold text-sm"></th>
                        <th className="py-3 text-right text-white/60 font-semibold text-sm">{safeAccess(financialData?.fiscal_years, 0)}</th>
                        <th className="py-3 text-right text-white/60 font-semibold text-sm">{safeAccess(financialData?.fiscal_years, 1)}</th>
                        <th className="py-3 text-right text-white/60 font-semibold text-sm">{safeAccess(financialData?.fiscal_years, 2)}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      <tr className="hover:bg-white/5 transition-colors">
                        <td className="py-3 text-white font-semibold">Revenue</td>
                        <td className="py-3 text-right text-purple-300 font-mono">{formatCurrency(safeAccess(financialData?.revenue, 0))}</td>
                        <td className="py-3 text-right text-purple-300 font-mono">{formatCurrency(safeAccess(financialData?.revenue, 1))}</td>
                        <td className="py-3 text-right text-purple-300 font-mono">{formatCurrency(safeAccess(financialData?.revenue, 2))}</td>
                      </tr>
                      <tr className="hover:bg-white/5 transition-colors">
                        <td className="py-3 text-white/80 pl-4">Cost of Sales</td>
                        <td className="py-3 text-right text-red-300 font-mono">({formatCurrency(safeAccess(financialData?.cost_of_sales, 0))})</td>
                        <td className="py-3 text-right text-red-300 font-mono">({formatCurrency(safeAccess(financialData?.cost_of_sales, 1))})</td>
                        <td className="py-3 text-right text-red-300 font-mono">({formatCurrency(safeAccess(financialData?.cost_of_sales, 2))})</td>
                      </tr>
                      <tr className="hover:bg-white/5 transition-colors border-t-2 border-green-500/30">
                        <td className="py-3 text-white font-bold">Gross Profit</td>
                        <td className="py-3 text-right text-green-300 font-mono font-bold">{formatCurrency(safeAccess(financialData?.gross_profit, 0))}</td>
                        <td className="py-3 text-right text-green-300 font-mono font-bold">{formatCurrency(safeAccess(financialData?.gross_profit, 1))}</td>
                        <td className="py-3 text-right text-green-300 font-mono font-bold">{formatCurrency(safeAccess(financialData?.gross_profit, 2))}</td>
                      </tr>
                      {safeAccess(financialData?.research_and_development, 2) > 0 && (
                        <tr className="hover:bg-white/5 transition-colors">
                          <td className="py-3 text-white/80 pl-4">Research & Development</td>
                          <td className="py-3 text-right text-orange-300 font-mono">({formatCurrency(safeAccess(financialData?.research_and_development, 0))})</td>
                          <td className="py-3 text-right text-orange-300 font-mono">({formatCurrency(safeAccess(financialData?.research_and_development, 1))})</td>
                          <td className="py-3 text-right text-orange-300 font-mono">({formatCurrency(safeAccess(financialData?.research_and_development, 2))})</td>
                        </tr>
                      )}
                      {safeAccess(financialData?.sales_and_marketing, 2) > 0 && (
                        <tr className="hover:bg-white/5 transition-colors">
                          <td className="py-3 text-white/80 pl-4">Sales & Marketing</td>
                          <td className="py-3 text-right text-orange-300 font-mono">({formatCurrency(safeAccess(financialData?.sales_and_marketing, 0))})</td>
                          <td className="py-3 text-right text-orange-300 font-mono">({formatCurrency(safeAccess(financialData?.sales_and_marketing, 1))})</td>
                          <td className="py-3 text-right text-orange-300 font-mono">({formatCurrency(safeAccess(financialData?.sales_and_marketing, 2))})</td>
                        </tr>
                      )}
                      {safeAccess(financialData?.selling_general_admin, 2) > 0 && (
                        <tr className="hover:bg-white/5 transition-colors">
                          <td className="py-3 text-white/80 pl-4">Selling, General & Administrative</td>
                          <td className="py-3 text-right text-orange-300 font-mono">({formatCurrency(safeAccess(financialData?.selling_general_admin, 0))})</td>
                          <td className="py-3 text-right text-orange-300 font-mono">({formatCurrency(safeAccess(financialData?.selling_general_admin, 1))})</td>
                          <td className="py-3 text-right text-orange-300 font-mono">({formatCurrency(safeAccess(financialData?.selling_general_admin, 2))})</td>
                        </tr>
                      )}
                      {safeAccess(financialData?.other_operating_expenses, 2) > 0 && (
                        <tr className="hover:bg-white/5 transition-colors">
                          <td className="py-3 text-white/80 pl-4">Other Operating Expenses</td>
                          <td className="py-3 text-right text-orange-300 font-mono">({formatCurrency(safeAccess(financialData?.other_operating_expenses, 0))})</td>
                          <td className="py-3 text-right text-orange-300 font-mono">({formatCurrency(safeAccess(financialData?.other_operating_expenses, 1))})</td>
                          <td className="py-3 text-right text-orange-300 font-mono">({formatCurrency(safeAccess(financialData?.other_operating_expenses, 2))})</td>
                        </tr>
                      )}
                      <tr className="hover:bg-white/5 transition-colors border-t-2 border-cyan-500/30">
                        <td className="py-3 text-white font-bold">Operating Profit (EBIT)</td>
                        <td className="py-3 text-right text-cyan-300 font-mono font-bold">{formatCurrency(safeAccess(financialData?.operating_profit, 0))}</td>
                        <td className="py-3 text-right text-cyan-300 font-mono font-bold">{formatCurrency(safeAccess(financialData?.operating_profit, 1))}</td>
                        <td className="py-3 text-right text-cyan-300 font-mono font-bold">{formatCurrency(safeAccess(financialData?.operating_profit, 2))}</td>
                      </tr>
                      <tr className="hover:bg-white/5 transition-colors">
                        <td className="py-3 text-white/80 pl-4">Interest Income</td>
                        <td className="py-3 text-right text-green-300 font-mono">{safeAccess(financialData?.interest_income, 0) > 0 ? formatCurrency(safeAccess(financialData?.interest_income, 0)) : '—'}</td>
                        <td className="py-3 text-right text-green-300 font-mono">{safeAccess(financialData?.interest_income, 1) > 0 ? formatCurrency(safeAccess(financialData?.interest_income, 1)) : '—'}</td>
                        <td className="py-3 text-right text-green-300 font-mono">{safeAccess(financialData?.interest_income, 2) > 0 ? formatCurrency(safeAccess(financialData?.interest_income, 2)) : '—'}</td>
                      </tr>
                      <tr className="hover:bg-white/5 transition-colors">
                        <td className="py-3 text-white/80 pl-4">Interest Expense</td>
                        <td className="py-3 text-right text-red-300 font-mono">{safeAccess(financialData?.interest_expense, 0) > 0 ? `(${formatCurrency(safeAccess(financialData?.interest_expense, 0))})` : '—'}</td>
                        <td className="py-3 text-right text-red-300 font-mono">{safeAccess(financialData?.interest_expense, 1) > 0 ? `(${formatCurrency(safeAccess(financialData?.interest_expense, 1))})` : '—'}</td>
                        <td className="py-3 text-right text-red-300 font-mono">{safeAccess(financialData?.interest_expense, 2) > 0 ? `(${formatCurrency(safeAccess(financialData?.interest_expense, 2))})` : '—'}</td>
                      </tr>
                      <tr className="hover:bg-white/5 transition-colors">
                        <td className="py-3 text-white/80 pl-4">Other Income/(Expense), net</td>
                        <td className="py-3 text-right font-mono" style={{ color: safeAccess(financialData?.other_income_expense, 0) >= 0 ? '#86efac' : '#fca5a5' }}>
                          {safeAccess(financialData?.other_income_expense, 0) !== 0 ? (safeAccess(financialData?.other_income_expense, 0) >= 0 ? formatCurrency(safeAccess(financialData?.other_income_expense, 0)) : `(${formatCurrency(Math.abs(safeAccess(financialData?.other_income_expense, 0)))})`) : '—'}
                        </td>
                        <td className="py-3 text-right font-mono" style={{ color: safeAccess(financialData?.other_income_expense, 1) >= 0 ? '#86efac' : '#fca5a5' }}>
                          {safeAccess(financialData?.other_income_expense, 1) !== 0 ? (safeAccess(financialData?.other_income_expense, 1) >= 0 ? formatCurrency(safeAccess(financialData?.other_income_expense, 1)) : `(${formatCurrency(Math.abs(safeAccess(financialData?.other_income_expense, 1)))})`) : '—'}
                        </td>
                        <td className="py-3 text-right font-mono" style={{ color: safeAccess(financialData?.other_income_expense, 2) >= 0 ? '#86efac' : '#fca5a5' }}>
                          {safeAccess(financialData?.other_income_expense, 2) !== 0 ? (safeAccess(financialData?.other_income_expense, 2) >= 0 ? formatCurrency(safeAccess(financialData?.other_income_expense, 2)) : `(${formatCurrency(Math.abs(safeAccess(financialData?.other_income_expense, 2)))})`) : '—'}
                        </td>
                      </tr>
                      <tr className="hover:bg-white/5 transition-colors border-t-2 border-violet-500/30">
                        <td className="py-3 text-white font-bold">Pretax Profit</td>
                        <td className="py-3 text-right text-violet-300 font-mono font-bold">{formatCurrency(safeAccess(financialData?.pretax_profit, 0))}</td>
                        <td className="py-3 text-right text-violet-300 font-mono font-bold">{formatCurrency(safeAccess(financialData?.pretax_profit, 1))}</td>
                        <td className="py-3 text-right text-violet-300 font-mono font-bold">{formatCurrency(safeAccess(financialData?.pretax_profit, 2))}</td>
                      </tr>
                      <tr className="hover:bg-white/5 transition-colors">
                        <td className="py-3 text-white/80 pl-4">Income Tax Expense</td>
                        <td className="py-3 text-right text-red-300 font-mono">({formatCurrency(safeAccess(financialData?.income_tax_expense, 0))})</td>
                        <td className="py-3 text-right text-red-300 font-mono">({formatCurrency(safeAccess(financialData?.income_tax_expense, 1))})</td>
                        <td className="py-3 text-right text-red-300 font-mono">({formatCurrency(safeAccess(financialData?.income_tax_expense, 2))})</td>
                      </tr>
                      <tr className="hover:bg-white/5 transition-colors border-t-4 border-blue-500/50">
                        <td className="py-3 text-white font-bold text-lg">Net Income</td>
                        <td className="py-3 text-right text-blue-300 font-mono font-bold text-lg">{formatCurrency(safeAccess(financialData?.net_income, 0))}</td>
                        <td className="py-3 text-right text-blue-300 font-mono font-bold text-lg">{formatCurrency(safeAccess(financialData?.net_income, 1))}</td>
                        <td className="py-3 text-right text-blue-300 font-mono font-bold text-lg">{formatCurrency(safeAccess(financialData?.net_income, 2))}</td>
                      </tr>
                      
                      {/* Spacer */}
                      <tr><td colSpan={4} className="py-2"></td></tr>
                      
                      {/* Non-GAAP Adjustments Section */}
                      <tr className="bg-white/5">
                        <td colSpan={4} className="py-2 text-purple-300 font-semibold text-sm uppercase tracking-wider">
                          Non-GAAP Metrics
                        </td>
                      </tr>
                      <tr className="hover:bg-white/5 transition-colors">
                        <td className="py-3 text-white font-semibold">EBITDA</td>
                        <td className="py-3 text-right text-green-300 font-mono font-bold">{formatCurrency(safeAccess(financialData?.ebitda, 0))}</td>
                        <td className="py-3 text-right text-green-300 font-mono font-bold">{formatCurrency(safeAccess(financialData?.ebitda, 1))}</td>
                        <td className="py-3 text-right text-green-300 font-mono font-bold">{formatCurrency(safeAccess(financialData?.ebitda, 2))}</td>
                      </tr>
                      <tr className="hover:bg-white/5 transition-colors">
                        <td className="py-3 text-white/80 pl-4">+ Stock-Based Compensation</td>
                        <td className="py-3 text-right text-green-300 font-mono">{safeAccess(financialData?.stock_based_compensation, 0) > 0 ? formatCurrency(safeAccess(financialData?.stock_based_compensation, 0)) : '—'}</td>
                        <td className="py-3 text-right text-green-300 font-mono">{safeAccess(financialData?.stock_based_compensation, 1) > 0 ? formatCurrency(safeAccess(financialData?.stock_based_compensation, 1)) : '—'}</td>
                        <td className="py-3 text-right text-green-300 font-mono">{safeAccess(financialData?.stock_based_compensation, 2) > 0 ? formatCurrency(safeAccess(financialData?.stock_based_compensation, 2)) : '—'}</td>
                      </tr>
                      <tr className="hover:bg-white/5 transition-colors border-t-2 border-amber-500/30">
                        <td className="py-3 text-white font-bold">Adjusted EBITDA</td>
                        <td className="py-3 text-right text-amber-300 font-mono font-bold">{formatCurrency(safeAccess(financialData?.adjusted_ebitda, 0))}</td>
                        <td className="py-3 text-right text-amber-300 font-mono font-bold">{formatCurrency(safeAccess(financialData?.adjusted_ebitda, 1))}</td>
                        <td className="py-3 text-right text-amber-300 font-mono font-bold">{formatCurrency(safeAccess(financialData?.adjusted_ebitda, 2))}</td>
                      </tr>
                    </tbody>
                  </table>
                  </div>
                </motion.div>

                {/* Balance Sheet */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="bg-white/5 border border-white/10 rounded-2xl p-8 overflow-x-auto"
                >
                  <h3
                    className="text-white mb-6 text-xl md:text-2xl"
                    style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '700' }}
                  >
                    Balance Sheet (in millions)
                  </h3>
                  <div className="overflow-x-auto">
                  <table className="w-full" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    <thead>
                      <tr className="border-b-2 border-white/20">
                        <th className="py-3 text-left text-white/60 font-semibold text-sm"></th>
                        <th className="py-3 text-right text-white/60 font-semibold text-sm">{safeAccess(financialData?.fiscal_years, 1)}</th>
                        <th className="py-3 text-right text-white/60 font-semibold text-sm">{safeAccess(financialData?.fiscal_years, 2)}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {/* Assets Section */}
                      <tr className="bg-white/5">
                        <td colSpan={3} className="py-2 text-purple-300 font-semibold text-sm uppercase tracking-wider">
                          Assets
                        </td>
                      </tr>
                      <tr className="hover:bg-white/5 transition-colors">
                        <td className="py-3 text-white/80">Cash & equivalents, ST and LT marketable securities</td>
                        <td className="py-3 text-right text-blue-300 font-mono">{formatCurrency(safeAccess(financialData?.cash_and_equivalents, 1))}</td>
                        <td className="py-3 text-right text-blue-300 font-mono">{formatCurrency(safeAccess(financialData?.cash_and_equivalents, 2))}</td>
                      </tr>
                      <tr className="hover:bg-white/5 transition-colors">
                        <td className="py-3 text-white/80">Accounts receivable</td>
                        <td className="py-3 text-right text-blue-300 font-mono">{formatCurrency(safeAccess(financialData?.accounts_receivable, 1))}</td>
                        <td className="py-3 text-right text-blue-300 font-mono">{formatCurrency(safeAccess(financialData?.accounts_receivable, 2))}</td>
                      </tr>
                      {safeAccess(financialData?.inventories, 2) > 0 && (
                        <tr className="hover:bg-white/5 transition-colors">
                          <td className="py-3 text-white/80">Inventories</td>
                          <td className="py-3 text-right text-blue-300 font-mono">{formatCurrency(safeAccess(financialData?.inventories, 1))}</td>
                          <td className="py-3 text-right text-blue-300 font-mono">{formatCurrency(safeAccess(financialData?.inventories, 2))}</td>
                        </tr>
                      )}
                      {safeAccess(financialData?.other_current_assets, 2) > 0 && (
                        <tr className="hover:bg-white/5 transition-colors">
                          <td className="py-3 text-white/80">Other current assets</td>
                          <td className="py-3 text-right text-blue-300 font-mono">{formatCurrency(safeAccess(financialData?.other_current_assets, 1))}</td>
                          <td className="py-3 text-right text-blue-300 font-mono">{formatCurrency(safeAccess(financialData?.other_current_assets, 2))}</td>
                        </tr>
                      )}
                      <tr className="hover:bg-white/5 transition-colors border-t border-white/20">
                        <td className="py-3 text-white/90 font-semibold">Total current assets</td>
                        <td className="py-3 text-right text-blue-400 font-mono font-semibold">{formatCurrency(safeAccess(financialData?.total_current_assets, 1))}</td>
                        <td className="py-3 text-right text-blue-400 font-mono font-semibold">{formatCurrency(safeAccess(financialData?.total_current_assets, 2))}</td>
                      </tr>
                      <tr className="hover:bg-white/5 transition-colors">
                        <td className="py-3 text-white/80">Property, plant & equipment</td>
                        <td className="py-3 text-right text-blue-300 font-mono">{formatCurrency(safeAccess(financialData?.property_plant_equipment, 1))}</td>
                        <td className="py-3 text-right text-blue-300 font-mono">{formatCurrency(safeAccess(financialData?.property_plant_equipment, 2))}</td>
                      </tr>
                      {safeAccess(financialData?.other_noncurrent_assets, 2) > 0 && (
                        <tr className="hover:bg-white/5 transition-colors">
                          <td className="py-3 text-white/80">Other non current assets</td>
                          <td className="py-3 text-right text-blue-300 font-mono">{formatCurrency(safeAccess(financialData?.other_noncurrent_assets, 1))}</td>
                          <td className="py-3 text-right text-blue-300 font-mono">{formatCurrency(safeAccess(financialData?.other_noncurrent_assets, 2))}</td>
                        </tr>
                      )}
                      <tr className="hover:bg-white/5 transition-colors border-t-2 border-blue-500/30">
                        <td className="py-3 text-white font-bold">Total assets</td>
                        <td className="py-3 text-right text-blue-300 font-mono font-bold">{formatCurrency(safeAccess(financialData?.total_assets, 1))}</td>
                        <td className="py-3 text-right text-blue-300 font-mono font-bold">{formatCurrency(safeAccess(financialData?.total_assets, 2))}</td>
                      </tr>

                      {/* Spacer */}
                      <tr><td colSpan={3} className="py-2"></td></tr>

                      {/* Liabilities Section */}
                      <tr className="bg-white/5">
                        <td colSpan={3} className="py-2 text-purple-300 font-semibold text-sm uppercase tracking-wider">
                          Liabilities
                        </td>
                      </tr>
                      <tr className="hover:bg-white/5 transition-colors">
                        <td className="py-3 text-white/80">Accounts payable</td>
                        <td className="py-3 text-right text-red-300 font-mono">{formatCurrency(safeAccess(financialData?.accounts_payable, 1))}</td>
                        <td className="py-3 text-right text-red-300 font-mono">{formatCurrency(safeAccess(financialData?.accounts_payable, 2))}</td>
                      </tr>
                      {safeAccess(financialData?.other_current_liabilities, 2) > 0 && (
                        <tr className="hover:bg-white/5 transition-colors">
                          <td className="py-3 text-white/80">Other current liabilities</td>
                          <td className="py-3 text-right text-red-300 font-mono">{formatCurrency(safeAccess(financialData?.other_current_liabilities, 1))}</td>
                          <td className="py-3 text-right text-red-300 font-mono">{formatCurrency(safeAccess(financialData?.other_current_liabilities, 2))}</td>
                        </tr>
                      )}
                      {safeAccess(financialData?.deferred_revenue, 2) > 0 && (
                        <tr className="hover:bg-white/5 transition-colors">
                          <td className="py-3 text-white/80">Deferred revenue (current and non current)</td>
                          <td className="py-3 text-right text-red-300 font-mono">{formatCurrency(safeAccess(financialData?.deferred_revenue, 1))}</td>
                          <td className="py-3 text-right text-red-300 font-mono">{formatCurrency(safeAccess(financialData?.deferred_revenue, 2))}</td>
                        </tr>
                      )}
                      {safeAccess(financialData?.short_term_debt, 2) > 0 && (
                        <tr className="hover:bg-white/5 transition-colors">
                          <td className="py-3 text-white/80">Commercial paper / revolver</td>
                          <td className="py-3 text-right text-red-300 font-mono">{formatCurrency(safeAccess(financialData?.short_term_debt, 1))}</td>
                          <td className="py-3 text-right text-red-300 font-mono">{formatCurrency(safeAccess(financialData?.short_term_debt, 2))}</td>
                        </tr>
                      )}
                      <tr className="hover:bg-white/5 transition-colors border-t border-white/20">
                        <td className="py-3 text-white/90 font-semibold">Total current liabilities</td>
                        <td className="py-3 text-right text-red-400 font-mono font-semibold">{formatCurrency(safeAccess(financialData?.total_current_liabilities, 1))}</td>
                        <td className="py-3 text-right text-red-400 font-mono font-semibold">{formatCurrency(safeAccess(financialData?.total_current_liabilities, 2))}</td>
                      </tr>
                      {safeAccess(financialData?.long_term_debt, 2) > 0 && (
                        <tr className="hover:bg-white/5 transition-colors">
                          <td className="py-3 text-white/80">Long term debt (includes current portion)</td>
                          <td className="py-3 text-right text-red-300 font-mono">{formatCurrency(safeAccess(financialData?.long_term_debt, 1))}</td>
                          <td className="py-3 text-right text-red-300 font-mono">{formatCurrency(safeAccess(financialData?.long_term_debt, 2))}</td>
                        </tr>
                      )}
                      {safeAccess(financialData?.other_noncurrent_liabilities, 2) > 0 && (
                        <tr className="hover:bg-white/5 transition-colors">
                          <td className="py-3 text-white/80">Other non current liabilities</td>
                          <td className="py-3 text-right text-red-300 font-mono">{formatCurrency(safeAccess(financialData?.other_noncurrent_liabilities, 1))}</td>
                          <td className="py-3 text-right text-red-300 font-mono">{formatCurrency(safeAccess(financialData?.other_noncurrent_liabilities, 2))}</td>
                        </tr>
                      )}
                      <tr className="hover:bg-white/5 transition-colors border-t-2 border-red-500/30">
                        <td className="py-3 text-white font-bold">Total liabilities</td>
                        <td className="py-3 text-right text-red-300 font-mono font-bold">{formatCurrency(safeAccess(financialData?.total_liabilities, 1))}</td>
                        <td className="py-3 text-right text-red-300 font-mono font-bold">{formatCurrency(safeAccess(financialData?.total_liabilities, 2))}</td>
                      </tr>

                      {/* Spacer */}
                      <tr><td colSpan={3} className="py-2"></td></tr>

                      {/* Equity Section */}
                      <tr className="bg-white/5">
                        <td colSpan={3} className="py-2 text-purple-300 font-semibold text-sm uppercase tracking-wider">
                          Equity
                        </td>
                      </tr>
                      <tr className="hover:bg-white/5 transition-colors">
                        <td className="py-3 text-white/80">Common stock</td>
                        <td className="py-3 text-right text-green-300 font-mono">{formatCurrency(safeAccess(financialData?.common_stock, 1))}</td>
                        <td className="py-3 text-right text-green-300 font-mono">{formatCurrency(safeAccess(financialData?.common_stock, 2))}</td>
                      </tr>
                      <tr className="hover:bg-white/5 transition-colors">
                        <td className="py-3 text-white/80">Retained earnings</td>
                        <td className="py-3 text-right text-green-300 font-mono">{formatCurrency(safeAccess(financialData?.retained_earnings, 1))}</td>
                        <td className="py-3 text-right text-green-300 font-mono">{formatCurrency(safeAccess(financialData?.retained_earnings, 2))}</td>
                      </tr>
                      {safeAccess(financialData?.other_equity, 2) !== 0 && (
                        <tr className="hover:bg-white/5 transition-colors">
                          <td className="py-3 text-white/80">Other comprehensive income</td>
                          <td className="py-3 text-right text-green-300 font-mono">{formatCurrency(safeAccess(financialData?.other_equity, 1))}</td>
                          <td className="py-3 text-right text-green-300 font-mono">{formatCurrency(safeAccess(financialData?.other_equity, 2))}</td>
                        </tr>
                      )}
                      <tr className="hover:bg-white/5 transition-colors border-t-2 border-green-500/30">
                        <td className="py-3 text-white font-bold">Total equity</td>
                        <td className="py-3 text-right text-green-300 font-mono font-bold">{formatCurrency(safeAccess(financialData?.total_equity, 1))}</td>
                        <td className="py-3 text-right text-green-300 font-mono font-bold">{formatCurrency(safeAccess(financialData?.total_equity, 2))}</td>
                      </tr>
                    </tbody>
                  </table>
                  </div>
                </motion.div>

                {/* Action Buttons */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="flex flex-col sm:flex-row items-center justify-center gap-4"
                >
                  <button
                    onClick={exportToExcel}
                    className="px-6 py-3 rounded-full transition-all duration-300 hover:scale-105 active:scale-95 flex items-center gap-2"
                    style={{
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      boxShadow: '0 10px 30px rgba(16, 185, 129, 0.3)',
                      fontFamily: "'Outfit', sans-serif",
                      fontWeight: '700',
                    }}
                  >
                    <Download className="w-5 h-5" />
                    Export to Excel
                  </button>
                  <button
                    onClick={handleReset}
                    className="px-6 py-3 border-2 border-purple-500/50 rounded-full text-purple-300 hover:bg-purple-500/10 hover:border-purple-400 transition-all"
                    style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}
                  >
                    Analyze Another 10-K
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Time Savings Calculator Section */}
          <div className="mt-16 bg-gradient-to-br from-purple-500/10 via-violet-500/10 to-fuchsia-500/10 border border-purple-500/30 rounded-3xl p-8 sm:p-12">
            <div className="text-center mb-10">
              <h2 className="text-3xl sm:text-4xl md:text-5xl text-white mb-4" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '800' }}>
                The <span className="bg-gradient-to-r from-purple-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">Hidden Cost</span> of Manual Analysis
              </h2>
              <p className="text-lg text-purple-200" style={{ fontFamily: "'Manrope', sans-serif" }}>
                Calculate how much time your analysts spend on 10-K deep dives
              </p>
            </div>

            {/* Stat Highlight */}
            <div className="max-w-3xl mx-auto mb-10">
              {/* Company Count Slider */}
              <div className="mb-8">
                <label className="block text-center mb-4">
                  <span className="text-purple-200 text-lg" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    How many target companies do you analyze per month?
                  </span>
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="5"
                    max="30"
                    step="5"
                    value={companiesPerMonth}
                    onChange={(e) => setCompaniesPerMonth(Number(e.target.value))}
                    className="flex-1 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-purple-500 [&::-webkit-slider-thumb]:to-violet-500 [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-gradient-to-r [&::-moz-range-thumb]:from-purple-500 [&::-moz-range-thumb]:to-violet-500 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
                  />
                  <input
                    type="number"
                    min="5"
                    max="30"
                    step="5"
                    value={companiesPerMonth}
                    onChange={(e) => setCompaniesPerMonth(Number(e.target.value))}
                    className="w-24 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-center focus:outline-none focus:border-purple-500"
                    style={{ fontFamily: "'Manrope', sans-serif" }}
                  />
                </div>
                <div className="flex justify-between text-sm text-purple-200/60 mt-2" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  <span>5</span>
                  <span>30</span>
                </div>
              </div>

              <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-2xl p-8 text-center">
                <div className="text-5xl sm:text-6xl md:text-7xl bg-gradient-to-r from-purple-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent mb-4" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '800' }}>
                  {daysPerMonth} Days
                </div>
                <p className="text-xl sm:text-2xl text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}>
                  Saved per month with AI automation
                </p>
                <p className="text-purple-200" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  Based on analyzing {companiesPerMonth} companies per month
                </p>
              </div>
            </div>

            {/* Math Breakdown */}
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="bg-white/5 border border-white/10 rounded-xl p-6" style={{ fontFamily: "'Manrope', sans-serif" }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-purple-200">Manual analysis time per 10-K:</span>
                  <span className="text-white font-semibold">{hoursPerCompany} hours</span>
                </div>
                <div className="h-px bg-white/10 my-3"></div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-purple-200">Monthly company evaluations:</span>
                  <span className="text-white font-semibold">× {companiesPerMonth} companies</span>
                </div>
                <div className="h-px bg-white/10 my-3"></div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-purple-200">Total monthly time:</span>
                  <span className="text-white font-semibold">= {totalHours} hours</span>
                </div>
              </div>

              <div className="text-center py-4">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-500/20 rounded-full">
                  <span className="text-2xl">↓</span>
                </div>
              </div>

              <div className="bg-gradient-to-r from-purple-500/20 via-violet-500/20 to-fuchsia-500/20 border border-purple-500/50 rounded-xl p-4 sm:p-6" style={{ fontFamily: "'Manrope', sans-serif" }}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-3">
                  <span className="text-white text-sm sm:text-base">{totalHours} hours ÷ 8 hours/day</span>
                  <span className="text-xl sm:text-2xl bg-gradient-to-r from-purple-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent" style={{ fontWeight: '800' }}>
                    = {daysPerMonth} work days/month
                  </span>
                </div>
                <p className="text-purple-200 text-sm">
                  That's nearly {Math.round(parseFloat(daysPerMonth) / 5)} full work weeks per month on financial extraction alone!
                </p>
              </div>
            </div>

            {/* Funds Lost Section */}
            <div className="mt-12 max-w-4xl mx-auto">
              <div className="bg-gradient-to-br from-red-500/10 via-orange-500/10 to-amber-500/10 border-2 border-red-500/30 rounded-2xl p-8 sm:p-10">
                <div className="text-center mb-8">
                  <h3 className="text-2xl sm:text-3xl text-white mb-3" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '700' }}>
                    💸 The Real Cost of Manual Work
                  </h3>
                  <p className="text-red-200" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    Your team's time has a price tag
                  </p>
                </div>

                {/* Two-column cost display */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  {/* Monthly Cost */}
                  <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-xl p-6 text-center">
                    <div className="text-red-300/70 text-sm mb-2" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      Monthly Cost Lost
                    </div>
                    <div className="text-4xl sm:text-5xl text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '800' }}>
                      ${Number(monthlyCostLost).toLocaleString()}
                    </div>
                    <div className="text-red-200/80 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      on manual financial extraction
                    </div>
                  </div>

                  {/* Annual Cost */}
                  <div className="bg-gradient-to-br from-red-500/20 to-orange-500/20 border-2 border-red-500/50 rounded-xl p-6 text-center">
                    <div className="text-red-300/70 text-sm mb-2" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      Annual Cost Lost
                    </div>
                    <div className="text-4xl sm:text-5xl bg-gradient-to-r from-red-300 via-orange-300 to-amber-300 bg-clip-text text-transparent mb-2" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '800' }}>
                      ${Number(annualCostLost).toLocaleString()}
                    </div>
                    <div className="text-red-200/80 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      wasted annually
                    </div>
                  </div>
                </div>

                {/* Cost Breakdown */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  <div className="flex items-center justify-between mb-2 text-sm sm:text-base">
                    <span className="text-red-200/80">Average PE analyst fully-loaded cost:</span>
                    <span className="text-white font-semibold">${(fullyLoadedCost / 1000).toFixed(0)}K/year</span>
                  </div>
                  <div className="h-px bg-white/10 my-3"></div>
                  <div className="flex items-center justify-between mb-2 text-sm sm:text-base">
                    <span className="text-red-200/80">Effective hourly rate:</span>
                    <span className="text-white font-semibold">${hourlyRate.toFixed(0)}/hour</span>
                  </div>
                  <div className="h-px bg-white/10 my-3"></div>
                  <div className="flex items-center justify-between mb-2 text-sm sm:text-base">
                    <span className="text-red-200/80">Hours spent on manual work:</span>
                    <span className="text-white font-semibold">{totalHours} hours/month</span>
                  </div>
                  <div className="h-px bg-white/10 my-3"></div>
                  <div className="flex items-center justify-between text-sm sm:text-base">
                    <span className="text-white font-bold">Wasted capital:</span>
                    <span className="text-red-300 font-bold">${Number(monthlyCostLost).toLocaleString()}/month</span>
                  </div>
                </div>

                {/* Opportunity Cost */}
                <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-6">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">⚠️</div>
                    <div>
                      <h4 className="text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}>
                        Hidden Opportunity Cost
                      </h4>
                      <p className="text-amber-200/90 text-sm mb-3" style={{ fontFamily: "'Manrope', sans-serif" }}>
                        Beyond direct costs, your analysts could be using these {daysPerMonth} days/month to:
                      </p>
                      <ul className="space-y-2 text-sm text-amber-200/80" style={{ fontFamily: "'Manrope', sans-serif" }}>
                        <li className="flex items-start gap-2">
                          <span className="text-amber-400 mt-0.5">•</span>
                          <span>Build deeper competitive analysis and industry research</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-amber-400 mt-0.5">•</span>
                          <span>Conduct management interviews and site visits</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-amber-400 mt-0.5">•</span>
                          <span>Source proprietary deal flow and build relationships</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-amber-400 mt-0.5">•</span>
                          <span>Develop value creation plans for portfolio companies</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Call to Action */}
            <div className="text-center mt-10" style={{ fontFamily: "'Manrope', sans-serif" }}>
              <p className="text-lg text-purple-200 mb-6">
                A typical PE associate spends <span className="text-white font-bold">4–8 hours per company</span> manually extracting and reconciling financial data from 10-Ks.
              </p>
              <p className="text-xl text-white" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}>
                <span className="bg-gradient-to-r from-purple-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">Free your analysts to focus on what matters: strategic evaluation.</span>
              </p>
            </div>

            {/* What Gets Automated */}
            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h4 className="text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}>
                      Automated Extraction
                    </h4>
                    <p className="text-purple-200 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      Income statement, balance sheet, and cash flow data extracted in seconds from 200+ page filings
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <DollarSign className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <h4 className="text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}>
                      PE-Grade Calculations
                    </h4>
                    <p className="text-purple-200 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      EBITDA, Adjusted EBITDA, and margin analysis calculated automatically with D&A from cash flows
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                    <PieChart className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <h4 className="text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}>
                      Multi-Statement Reconciliation
                    </h4>
                    <p className="text-purple-200 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      Cross-references income statement, cash flow, and footnotes to ensure accuracy
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h4 className="text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}>
                      Industry-Adaptive
                    </h4>
                    <p className="text-purple-200 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      Automatically adjusts for tech (R&D, stock comp) vs consumer (inventory, marketing) vs industrial models
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
