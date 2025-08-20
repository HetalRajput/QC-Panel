import { useState, useCallback } from 'react';
import { parseCsv } from '../Utilities/csvParser';

function useCsvData() {
  const [csvData, setCsvData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const processCsv = useCallback((csvString) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const parsedData = parseCsv(csvString);
      setCsvData(parsedData);
    } catch (err) {
      const message = err?.message || 'Failed to parse CSV file';
      setError(message);
      console.error('CSV parsing error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sortData = useCallback((key, direction) => {
    if (direction === 'none' || !csvData.length) return;

    setCsvData(prevData => {
      const sorted = [...prevData].sort((a, b) => {
        // Handle empty/missing values
        if (!a[key] && !b[key]) return 0;
        if (!a[key]) return direction === 'ascending' ? -1 : 1;
        if (!b[key]) return direction === 'ascending' ? 1 : -1;

        // Numeric comparison if values are numbers
        const numA = Number(a[key]);
        const numB = Number(b[key]);
        if (!isNaN(numA) && !isNaN(numB)) {
          return direction === 'ascending' ? numA - numB : numB - numA;
        }

        // String comparison
        return direction === 'ascending' 
          ? a[key].localeCompare(b[key])
          : b[key].localeCompare(a[key]);
      });

      return sorted;
    });
  }, [csvData.length]);

  const resetData = useCallback(() => {
    setCsvData([]);
    setError(null);
  }, []);

  return { 
    csvData, 
    isLoading, 
    error, 
    processCsv, 
    sortData,
    resetData,
    hasData: csvData.length > 0
  };
}

export default useCsvData;