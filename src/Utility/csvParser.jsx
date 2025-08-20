export function parseCsv(csvString) {
  // Remove BOM if present and trim whitespace
  const cleanString = csvString.trim().replace(/^\uFEFF/, '');
  
  // Handle different line endings and split lines
  const lines = cleanString.split(/\r?\n/).filter(line => line.trim() !== '');
  
  if (lines.length < 2) {
    throw new Error('CSV file must contain at least a header row and one data row');
  }

  // Parse headers with proper CSV escaping (basic support)
  const headers = lines[0].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
    .map(header => header.trim().replace(/^"|"$/g, ''));

  return lines.slice(1)
    .map(line => {
      // Basic CSV value parsing (handles quoted values)
      const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
        .map(val => val.trim().replace(/^"|"$/g, ''));

      return headers.reduce((obj, header, index) => {
        obj[header] = values[index] || '';
        return obj;
      }, {});
    })
    .filter(row => 
      // Filter out empty rows
      Object.values(row).some(value => value !== '') &&
      // Ensure row has same number of values as headers
      Object.keys(row).length === headers.length
    );
}