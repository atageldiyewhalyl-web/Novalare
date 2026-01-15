// AR Reconciliation Excel Export Function (ExcelJS formatted)
// This file contains the export logic for AR Reconciliation

export const createARReconciliationExport = async (
  reconciliationResult: any,
  companyId: string,
  selectedPeriod: string,
  publicAnonKey: string,
  projectId: string,
  novalareLogoImg: string,
  formatCurrency: (amount: number, currency: string) => string
) => {
  // Fetch fresh reconciliation data
  console.log('📊 Fetching latest AR reconciliation data before Excel export...');
  let freshResult = reconciliationResult;
  
  try {
    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ar-rec/reconciliation?companyId=${companyId}&period=${selectedPeriod}`,
      {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      freshResult = data.reconciliation || reconciliationResult;
      console.log('✅ Fresh reconciliation data fetched for export');
    }
  } catch (err) {
    console.warn('⚠️ Failed to fetch fresh data, using cached', err);
  }
  
  // Use ExcelJS for advanced formatting
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  
  // Fetch company details
  let companyName = companyId;
  try {
    const companyResponse = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/companies/${companyId}`,
      { 
        headers: { 
          'Authorization': `Bearer ${publicAnonKey}`,
        } 
      }
    );
    if (companyResponse.ok) {
      const companyData = await companyResponse.json();
      companyName = companyData.name || companyData.email || companyId;
    }
  } catch (err) {
    console.error('Failed to fetch company name:', err);
  }
  
  // Novalare brand color
  const novalareColor = '65D3FD';
  const darkColor = '1a1a1a';
  
  // 1. SUMMARY SHEET
  const summarySheet = workbook.addWorksheet('Summary', {
    properties: { tabColor: { argb: novalareColor } }
  });
  
  summarySheet.columns = [
    { width: 35 },
    { width: 25 }
  ];
  
  // Add Novalare logo
  try {
    const logoResponse = await fetch(novalareLogoImg);
    const logoBlob = await logoResponse.blob();
    const logoBuffer = await logoBlob.arrayBuffer();
    const logoId = workbook.addImage({
      buffer: logoBuffer,
      extension: 'png',
    });
    
    summarySheet.addImage(logoId, {
      tl: { col: 0.8, row: 0.5 },
      ext: { width: 150, height: 100 }
    });
    
    summarySheet.getRow(1).height = 45;
    summarySheet.getRow(2).height = 45;
    summarySheet.getRow(3).height = 10;
  } catch (err) {
    console.error('Failed to add logo:', err);
  }
  
  // Title row (row 4)
  summarySheet.mergeCells('A4:B4');
  const titleCell = summarySheet.getCell('A4');
  titleCell.value = 'AR RECONCILIATION SUMMARY';
  titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: novalareColor }
  };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  summarySheet.getRow(4).height = 30;
  
  // Powered by Novalare
  summarySheet.mergeCells('A5:B5');
  const poweredCell = summarySheet.getCell('A5');
  poweredCell.value = 'Powered by Novalare';
  poweredCell.font = { size: 9, italic: true, color: { argb: '666666' } };
  poweredCell.alignment = { horizontal: 'center' };
  
  summarySheet.addRow([]);
  
  // Helper function to add info rows
  const addInfoRow = (label: string, value: any, boldValue = false) => {
    const row = summarySheet.addRow([label, value]);
    row.getCell(1).font = { bold: true };
    if (boldValue) {
      row.getCell(2).font = { bold: true, size: 11 };
    }
    return row;
  };
  
  // Company Information Section
  const companyHeaderRow = summarySheet.addRow(['COMPANY INFORMATION']);
  companyHeaderRow.getCell(1).font = { bold: true, size: 11, color: { argb: darkColor } };
  companyHeaderRow.getCell(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'F0F0F0' }
  };
  
  addInfoRow('Company', companyName, true);
  addInfoRow('Period', selectedPeriod, true);
  addInfoRow('Report Date', new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }));
  
  summarySheet.addRow([]);
  
  // Reconciliation Statistics
  const statsHeaderRow = summarySheet.addRow(['RECONCILIATION STATISTICS']);
  statsHeaderRow.getCell(1).font = { bold: true, size: 11, color: { argb: darkColor } };
  statsHeaderRow.getCell(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'F0F0F0' }
  };
  
  const summary = freshResult.summary || {};
  
  addInfoRow('Total Customer Payments', summary.total_payments || 0, true);
  addInfoRow('Total AR Invoices', summary.total_invoices || 0, true);
  addInfoRow('Matched Pairs', summary.matched_count || 0, true);
  addInfoRow('Unmatched Payments', summary.unmatched_payments_count || 0, true);
  addInfoRow('Unmatched Invoices', summary.unmatched_invoices_count || 0, true);
  
  summarySheet.addRow([]);
  
  // Match Type Breakdown
  const matchTypeHeaderRow = summarySheet.addRow(['MATCH TYPE BREAKDOWN']);
  matchTypeHeaderRow.getCell(1).font = { bold: true, size: 11, color: { argb: darkColor } };
  matchTypeHeaderRow.getCell(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'F0F0F0' }
  };
  
  addInfoRow('Exact Matches (Invoice # + Amount)', summary.exact_matches || 0);
  addInfoRow('Amount Matches', summary.amount_matches || 0);
  addInfoRow('Customer Name Matches', summary.customer_name_matches || 0);
  
  summarySheet.addRow([]);
  
  // Financial Summary
  const financialHeaderRow = summarySheet.addRow(['FINANCIAL SUMMARY']);
  financialHeaderRow.getCell(1).font = { bold: true, size: 11, color: { argb: darkColor } };
  financialHeaderRow.getCell(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'F0F0F0' }
  };
  
  // Determine primary currency (most common in matched pairs)
  let primaryCurrency = 'USD';
  if (freshResult.matched_pairs && freshResult.matched_pairs.length > 0) {
    const currencies = freshResult.matched_pairs.map((m: any) => m.payment?.currency || 'USD');
    const currencyCount = currencies.reduce((acc: any, curr: string) => {
      acc[curr] = (acc[curr] || 0) + 1;
      return acc;
    }, {});
    primaryCurrency = Object.keys(currencyCount).reduce((a, b) => 
      currencyCount[a] > currencyCount[b] ? a : b
    );
  }
  
  addInfoRow('Total Payment Amount', formatCurrency(summary.total_payment_amount || 0, primaryCurrency), true);
  addInfoRow('Total Invoice Amount', formatCurrency(summary.total_invoice_amount || 0, primaryCurrency), true);
  addInfoRow('Matched Payment Amount', formatCurrency(summary.matched_payment_amount || 0, primaryCurrency));
  addInfoRow('Matched Invoice Amount', formatCurrency(summary.matched_invoice_amount || 0, primaryCurrency));
  addInfoRow('Match Rate', `${summary.match_rate || 0}%`, true);
  
  // 2. MATCHED PAIRS SHEET
  const matchedSheet = workbook.addWorksheet('Matched Pairs', {
    properties: { tabColor: { argb: '10B981' } }
  });
  
  matchedSheet.columns = [
    { width: 12 }, // Payment Date
    { width: 35 }, // Payment Description
    { width: 15 }, // Payment Amount
    { width: 10 }, // Currency
    { width: 20 }, // Statement Name
    { width: 15 }, // Invoice #
    { width: 25 }, // Customer
    { width: 12 }, // Invoice Date
    { width: 15 }, // Invoice Amount
    { width: 15 }, // Match Type
    { width: 10 }, // Confidence
    { width: 15 }, // Amount Diff
  ];
  
  // Header row
  const matchedHeaderRow = matchedSheet.addRow([
    'Payment Date',
    'Payment Description',
    'Payment Amount',
    'Currency',
    'Statement',
    'Invoice #',
    'Customer',
    'Invoice Date',
    'Invoice Amount',
    'Match Type',
    'Confidence',
    'Amount Difference'
  ]);
  
  matchedHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  matchedHeaderRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: novalareColor }
  };
  matchedHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };
  matchedHeaderRow.height = 25;
  
  // Data rows
  const matchedPairs = freshResult.matched_pairs || [];
  matchedPairs.forEach((match: any) => {
    const row = matchedSheet.addRow([
      match.payment?.date || '',
      match.payment?.description || '',
      match.payment?.amount || 0,
      match.payment?.currency || 'USD',
      match.payment?.statement || '',
      match.invoice?.invoice_number || '',
      match.invoice?.customer || '',
      match.invoice?.date || '',
      match.invoice?.amount || 0,
      match.match_type || '',
      `${match.confidence || 0}%`,
      match.amount_difference || 0
    ]);
    
    // Format amounts as currency
    row.getCell(3).numFmt = '#,##0.00';
    row.getCell(9).numFmt = '#,##0.00';
    row.getCell(12).numFmt = '#,##0.00';
    
    // Color code by match type
    if (match.match_type === 'exact') {
      row.getCell(10).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'D1FAE5' }
      };
    } else if (match.match_type === 'amount') {
      row.getCell(10).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'DBEAFE' }
      };
    } else if (match.match_type === 'customer_name') {
      row.getCell(10).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FEF3C7' }
      };
    }
  });
  
  // 3. UNMATCHED PAYMENTS SHEET
  const unmatchedPaymentsSheet = workbook.addWorksheet('Unmatched Payments', {
    properties: { tabColor: { argb: 'F59E0B' } }
  });
  
  unmatchedPaymentsSheet.columns = [
    { width: 12 }, // Date
    { width: 40 }, // Description
    { width: 15 }, // Amount
    { width: 10 }, // Currency
    { width: 20 }, // Statement Name
    { width: 40 }, // Reason
    { width: 50 }  // Suggested Action
  ];
  
  // Header row
  const unmatchedPayHeaderRow = unmatchedPaymentsSheet.addRow([
    'Date',
    'Description',
    'Amount',
    'Currency',
    'Statement',
    'Reason',
    'Suggested Action'
  ]);
  
  unmatchedPayHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  unmatchedPayHeaderRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: novalareColor }
  };
  unmatchedPayHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };
  unmatchedPayHeaderRow.height = 25;
  
  // Data rows
  const unmatchedPayments = freshResult.unmatched_payments || [];
  unmatchedPayments.forEach((item: any) => {
    const payment = item.payment;
    const row = unmatchedPaymentsSheet.addRow([
      payment?.date || '',
      payment?.description || '',
      payment?.amount || 0,
      payment?.currency || 'USD',
      payment?.statement || '',
      item.reason || '',
      item.suggested_action || ''
    ]);
    
    row.getCell(3).numFmt = '#,##0.00';
  });
  
  // 4. UNMATCHED INVOICES SHEET
  const unmatchedInvoicesSheet = workbook.addWorksheet('Unmatched Invoices', {
    properties: { tabColor: { argb: 'EF4444' } }
  });
  
  unmatchedInvoicesSheet.columns = [
    { width: 15 }, // Invoice #
    { width: 25 }, // Customer
    { width: 12 }, // Date
    { width: 15 }, // Amount
    { width: 10 }, // Currency
    { width: 12 }, // Due Date
    { width: 40 }, // Reason
    { width: 50 }  // Suggested Action
  ];
  
  // Header row
  const unmatchedInvHeaderRow = unmatchedInvoicesSheet.addRow([
    'Invoice #',
    'Customer',
    'Date',
    'Amount',
    'Currency',
    'Due Date',
    'Reason',
    'Suggested Action'
  ]);
  
  unmatchedInvHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  unmatchedInvHeaderRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: novalareColor }
  };
  unmatchedInvHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };
  unmatchedInvHeaderRow.height = 25;
  
  // Data rows
  const unmatchedInvoices = freshResult.unmatched_invoices || [];
  unmatchedInvoices.forEach((item: any) => {
    const invoice = item.invoice;
    const row = unmatchedInvoicesSheet.addRow([
      invoice?.invoice_number || '',
      invoice?.customer || '',
      invoice?.date || '',
      invoice?.amount || 0,
      invoice?.currency || 'USD',
      invoice?.due_date || '',
      item.reason || '',
      item.suggested_action || ''
    ]);
    
    row.getCell(4).numFmt = '#,##0.00';
  });
  
  // Generate and download the file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `AR_Reconciliation_${companyName}_${selectedPeriod}.xlsx`;
  link.click();
  
  URL.revokeObjectURL(url);
};
