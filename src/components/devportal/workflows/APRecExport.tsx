// AP Reconciliation Excel Export Function (ExcelJS formatted)
// This file contains the export logic to be integrated into APReconciliation.tsx

export const createAPReconciliationExport = async (
  reconciliationResult: any,
  companyId: string,
  selectedPeriod: string,
  publicAnonKey: string,
  projectId: string,
  novalareLogoImg: string,
  getCurrencySymbol: () => string
) => {
  // Fetch fresh reconciliation data
  console.log('📊 Fetching latest AP reconciliation data before Excel export...');
  let freshResult = reconciliationResult;
  
  try {
    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ap-rec/reconciliation?companyId=${companyId}&period=${selectedPeriod}`,
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
  titleCell.value = 'AP RECONCILIATION SUMMARY';
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
  
  addInfoRow('Total Vendor Transactions', freshResult.summary?.total_vendor_transactions || 0, true);
  addInfoRow('Total AP Ledger Entries', freshResult.summary?.total_ap_entries || 0, true);
  addInfoRow('Total Matched', freshResult.summary?.matched_count || 0, true);
  addInfoRow('Unmatched Vendor Transactions', freshResult.summary?.unmatched_vendor_count || 0, true);
  addInfoRow('Unmatched AP Entries', freshResult.summary?.unmatched_ap_count || 0, true);
  
  const matchRateRow = addInfoRow('Match Rate', `${(freshResult.summary?.match_rate || 0).toFixed(1)}%`, true);
  const matchRateValue = freshResult.summary?.match_rate || 0;
  matchRateRow.getCell(2).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: matchRateValue >= 90 ? 'C6EFCE' : matchRateValue >= 70 ? 'FFEB9C' : 'FFC7CE' }
  };
  
  summarySheet.addRow([]);
  
  // Financial Summary
  const financialHeaderRow = summarySheet.addRow(['FINANCIAL SUMMARY']);
  financialHeaderRow.getCell(1).font = { bold: true, size: 11, color: { argb: darkColor } };
  financialHeaderRow.getCell(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'F0F0F0' }
  };
  
  const currencyFormat = getCurrencySymbol() === '$' ? '$#,##0.00' : getCurrencySymbol() === '£' ? '£#,##0.00' : '€#,##0.00';
  
  const vendorAmountRow = addInfoRow('Total Vendor Amount', freshResult.summary?.total_vendor_amount || 0, true);
  vendorAmountRow.getCell(2).numFmt = currencyFormat;
  
  const apAmountRow = addInfoRow('Total AP Amount', freshResult.summary?.total_ap_amount || 0, true);
  apAmountRow.getCell(2).numFmt = currencyFormat;
  
  summarySheet.addRow([]);
  
  const differenceRow = addInfoRow('Total Difference', freshResult.summary?.difference || 0, true);
  differenceRow.getCell(2).numFmt = currencyFormat;
  differenceRow.getCell(2).font = { bold: true, size: 11, color: { argb: 'FF6600' } };
  
  const statusRow = summarySheet.addRow(['Status', Math.abs(freshResult.summary?.difference || 0) < 1 ? 'Balanced ✓' : 'Out of Balance ⚠']);
  statusRow.getCell(1).font = { bold: true };
  statusRow.getCell(2).font = { 
    bold: true, 
    size: 12,
    color: { argb: Math.abs(freshResult.summary?.difference || 0) < 1 ? '00AA00' : 'FF6600' }
  };
  
  // 2. MATCHED TRANSACTIONS SHEET
  if (freshResult.matched_pairs && freshResult.matched_pairs.length > 0) {
    const matchedSheet = workbook.addWorksheet('Matched Transactions', {
      properties: { tabColor: { argb: 'C6EFCE' } }
    });
    
    matchedSheet.columns = [
      { width: 12 }, { width: 20 }, { width: 35 }, { width: 14 },
      { width: 12 }, { width: 20 }, { width: 35 }, { width: 14 },
      { width: 18 }, { width: 12 }, { width: 50 }
    ];
    
    const headers = [
      'Vendor Date', 'Vendor Name', 'Vendor Description', 'Vendor Amount',
      'AP Date', 'AP Vendor', 'AP Description', 'AP Amount',
      'Match Type', 'Confidence', 'Explanation'
    ];
    const headerRow = matchedSheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: novalareColor }
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 25;
    
    freshResult.matched_pairs.forEach((pair: any) => {
      const vendor = pair.vendor_transaction || {};
      const apEntries = Array.isArray(pair.ap_entries) ? pair.ap_entries : [];
      
      if (apEntries.length === 1) {
        const ap = apEntries[0];
        const dataRow = matchedSheet.addRow([
          vendor.date || '',
          vendor.vendor || '',
          vendor.description || '',
          Math.abs(vendor.amount || 0),
          ap.date || '',
          ap.vendor || '',
          ap.description || '',
          Math.abs(ap.amount || 0),
          pair.match_type || '',
          `${pair.match_confidence || 0}%`,
          pair.explanation || ''
        ]);
        dataRow.getCell(4).numFmt = currencyFormat;
        dataRow.getCell(8).numFmt = currencyFormat;
      } else {
        apEntries.forEach((ap: any, idx: number) => {
          const dataRow = matchedSheet.addRow([
            idx === 0 ? (vendor.date || '') : '',
            idx === 0 ? (vendor.vendor || '') : '',
            idx === 0 ? (vendor.description || '') : '',
            idx === 0 ? Math.abs(vendor.amount || 0) : '',
            ap.date || '',
            ap.vendor || '',
            ap.description || '',
            Math.abs(ap.amount || 0),
            idx === 0 ? (pair.match_type || '') : '',
            idx === 0 ? `${pair.match_confidence || 0}%` : '',
            idx === 0 ? (pair.explanation || '') : ''
          ]);
          if (idx === 0) {
            dataRow.getCell(4).numFmt = currencyFormat;
          }
          dataRow.getCell(8).numFmt = currencyFormat;
        });
      }
    });
  }
  
  // 3. UNMATCHED VENDOR TRANSACTIONS SHEET
  if (freshResult.unmatched_vendor && freshResult.unmatched_vendor.length > 0) {
    const unmatchedVendorSheet = workbook.addWorksheet('Unmatched Vendor', {
      properties: { tabColor: { argb: 'FFC7CE' } }
    });
    
    unmatchedVendorSheet.columns = [
      { width: 12 }, { width: 20 }, { width: 40 }, { width: 14 }, { width: 50 }
    ];
    
    const headers = ['Date', 'Vendor', 'Description', 'Amount', 'Suggested Action'];
    const headerRow = unmatchedVendorSheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF6666' }
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 25;
    
    freshResult.unmatched_vendor.forEach((item: any) => {
      const txn = item.transaction || {};
      const dataRow = unmatchedVendorSheet.addRow([
        txn.date || '',
        txn.vendor || '',
        txn.description || '',
        Math.abs(txn.amount || 0),
        item.suggested_action || 'Review transaction'
      ]);
      dataRow.getCell(4).numFmt = currencyFormat;
    });
  }
  
  // 4. UNMATCHED AP ENTRIES SHEET
  if (freshResult.unmatched_ap && freshResult.unmatched_ap.length > 0) {
    const unmatchedAPSheet = workbook.addWorksheet('Unmatched AP', {
      properties: { tabColor: { argb: 'FFC7CE' } }
    });
    
    unmatchedAPSheet.columns = [
      { width: 12 }, { width: 20 }, { width: 40 }, { width: 14 }, { width: 15 }, { width: 30 }
    ];
    
    const headers = ['Date', 'Vendor', 'Description', 'Amount', 'Reference', 'Reason'];
    const headerRow = unmatchedAPSheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF6666' }
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 25;
    
    freshResult.unmatched_ap.forEach((item: any) => {
      const entry = item.entry || {};
      const dataRow = unmatchedAPSheet.addRow([
        entry.date || '',
        entry.vendor || '',
        entry.description || '',
        Math.abs(entry.amount || 0),
        entry.reference || '',
        item.reason || 'No matching vendor transaction'
      ]);
      dataRow.getCell(4).numFmt = currencyFormat;
    });
  }
  
  // Generate and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `AP_Reconciliation_${companyName}_${selectedPeriod}_${new Date().toISOString().split('T')[0]}.xlsx`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};
