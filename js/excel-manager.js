/* ==========================================================================
   ENTERPRISE CERTIFICATE GENERATOR - EXCEL PARSER & AUDIT ANALYTICS ENGINE
   ========================================================================== */

class ExcelManager {
  constructor() {
    this.supportedFormats = ['.xlsx', '.xls', '.csv'];
  }

  async parseFile(file) {
    return this.parseExcelFile(file);
  }

  async parseExcelFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetCount = workbook.SheetNames ? workbook.SheetNames.length : 1;
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];

          console.log('[ExcelParser] Step 1: Workbook read successfully. Sheets count:', sheetCount);
          console.log('[ExcelParser] Step 2: Parsing Worksheet:', firstSheetName);

          // Parse as 2D array to ensure exact column alignment and zero data loss
          const rawSheetData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

          if (!rawSheetData || rawSheetData.length === 0) {
            throw new Error('Uploaded Excel file contains no data.');
          }

          // Extract Headers from Row 0
          const rawHeaders = rawSheetData[0] || [];
          const headers = [];

          rawHeaders.forEach((h, idx) => {
            const cleanH = String(h !== undefined ? h : '').trim();
            if (cleanH.length > 0) {
              headers.push(cleanH);
            } else {
              headers.push(`Column_${idx + 1}`);
            }
          });

          console.log('[ExcelParser] Step 3: Extracted Column Headers:', headers);

          // Parse Data Rows (Row 1 to End)
          const cleanRows = [];
          for (let r = 1; r < rawSheetData.length; r++) {
            const rowArray = rawSheetData[r];
            if (!rowArray || rowArray.length === 0) continue;

            const rowObj = {};
            let hasAnyData = false;

            headers.forEach((header, cIdx) => {
              const cellVal = String(rowArray[cIdx] !== undefined ? rowArray[cIdx] : '').trim();
              rowObj[header] = cellVal;
              if (cellVal !== '') hasAnyData = true;
            });

            if (hasAnyData) {
              cleanRows.push(rowObj);
            }
          }

          console.log(`[ExcelParser] Step 4: Clean Data Rows Extracted: ${cleanRows.length} total row(s).`);

          const excelObj = {
            id: 'xls_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            name: file.name,
            sizeBytes: file.size,
            uploadedAt: new Date().toISOString(),
            headers: headers,
            rows: cleanRows
          };

          resolve(excelObj);
        } catch (err) {
          console.error('[ExcelParser] Parse Error:', err);
          reject(new Error(`Failed to parse Excel workbook "${file.name}": ${err.message}`));
        }
      };

      reader.onerror = () => reject(new Error(`Failed to read file "${file.name}".`));
      reader.readAsArrayBuffer(file);
    });
  }
}

window.excelManager = new ExcelManager();
