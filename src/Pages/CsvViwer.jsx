import React, { useState, useEffect } from 'react';
import { FaFileUpload, FaFileDownload, FaExchangeAlt, FaChevronLeft, FaChevronRight, FaTimes, FaCheck, FaSearch } from 'react-icons/fa';
import FieldMapper from '../Component/Csv-uploader/FieldMapper';
import MatchResults from '../Component/Csv-uploader/MatchResult';

function CsvViewer() {
  const [file, setFile] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [showMapper, setShowMapper] = useState(false);
  const [fieldMap, setFieldMap] = useState({});
  const [mappedData, setMappedData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMapping, setIsMapping] = useState(false);
  const [error, setError] = useState(null);
  const [apiResults, setApiResults] = useState([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const fixedFields = ['item', 'name', 'batch', 'mrp', 'pack', 'Expiry'];
  // Search functionality states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const processFile = (file) => {
    setError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const csvString = event.target.result;
        const lines = csvString.split('\n');
        if (lines.length < 2) {
          setError('CSV file is empty or has no headers');
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim());
        const data = lines.slice(1)
          .filter(line => line.trim() !== '')
          .map(line => {
            const values = line.split(',');
            return headers.reduce((obj, header, index) => {
              obj[header] = values[index] ? values[index].trim() : '';
              return obj;
            }, {});
          })
          .filter(row => Object.values(row).some(v => v !== ''));

        if (data.length === 0) {
          setError('CSV file contains no valid data');
          return;
        }

        setCsvHeaders(headers);
        setCsvData(data);
        setFile(file);
        setShowMapper(true);
        setIsCollapsed(false);
      } catch (err) {
        console.error('File processing error:', err);
        setError('Failed to parse CSV file');
      }
    };
    reader.onerror = () => {
      setError('Error reading file');
    };
    reader.readAsText(file);
  };

  // Search API integration
  const handleSearch = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`http://jemapps.in/api/ocr/search-customer/${encodeURIComponent(query)}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch search results');
      }
      const data = await response.json();
      console.log('Search results:', data);
      
      setSearchResults(data);
      setShowDropdown(true);
    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to fetch search results');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle customer selection from dropdown
  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer);
    setSearchQuery(customer.Name);
    setShowDropdown(false);
    console.log('Selected customer:', customer);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (event.target.closest('.search-container') === null) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleRemoveFile = () => {
    setFile(null);
    setCsvData([]);
    setCsvHeaders([]);
    setMappedData([]);
    setApiResults([]);
    setShowMapper(false);
    setFieldMap({});
    setError(null);
  };

  const applyMapping = () => {
    setIsMapping(true);
    setError(null);

    try {
      const requiredFields = ['item', 'name'];
      const missingFields = requiredFields.filter(field => !fieldMap[field]);

      if (missingFields.length > 0) {
        setError(`Please map these required fields: ${missingFields.join(', ')}`);
        return;
      }

      const newData = csvData.map(row => {
        const mappedRow = {};
        fixedFields.forEach(fixedField => {
          const csvField = fieldMap[fixedField];
          mappedRow[fixedField] = csvField ? (row[csvField] || '') : '';
        });
        return mappedRow;
      }).filter(row => Object.values(row).some(v => v !== ''));

      setMappedData(newData);
      setShowMapper(false);
      fetchMatchResults(newData);
    } catch (err) {
      console.error('Mapping error:', err);
      setError('Failed to apply field mapping');
      setMappedData([]);
    } finally {
      setIsMapping(false);
    }
  };

  const fetchMatchResults = (data) => {
    setIsLoading(true);
    setApiResults([]);

    setTimeout(() => {
      try {
        const results = data.map(item => ({
          ...item,
          matchStatus: Math.random() > 0.5 ? 'matched' : 'unmatched',
          matchedItem: Math.random() > 0.5 ? `Item-${Math.floor(Math.random() * 1000)}` : null
        }));
        setApiResults(results);
      } catch (err) {
        setError('Error fetching match results');
      } finally {
        setIsLoading(false);
      }
    }, 1500);
  };

  const handleDownload = () => {
    if (mappedData.length === 0) return;

    try {
      const headers = fixedFields;
      const csvContent = [
        headers.join(','),
        ...mappedData.map(row => headers.map(header => row[header]).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'processed_data.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError('Error generating download');
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Left Sidebar - Collapsible */}
      <div className={`relative ${isCollapsed ? 'w-12' : 'w-1/4'} bg-white shadow-md transition-all duration-300`}>
        {/* Collapse/Expand Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-4 bg-white rounded-full shadow-md p-1 z-10"
        >
          {isCollapsed ? <FaChevronRight /> : <FaChevronLeft />}
        </button>

        {!isCollapsed ? (
          <div className="p-4 overflow-y-auto">
            {/* Search Section */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Customer Search</h3>
              <div className="relative search-container">
                <div className="flex items-center border border-gray-300 rounded-md overflow-hidden">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowDropdown(e.target.value.trim() !== '');
                      if (e.target.value.trim() === '') {
                        setSelectedCustomer(null);
                      }
                    }}
                    placeholder="Search customers..."
                    className="flex-1 px-3 py-2 focus:outline-none"
                  />
                  <button className="px-3 py-2 bg-gray-100 text-gray-600">
                    {isSearching ? '...' : <FaSearch />}
                  </button>
                </div>
                
                {/* Search Results Dropdown */}
                {showDropdown && searchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {searchResults.map((customer) => (
                      <div 
                        key={customer.VCode}
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                        onClick={() => handleCustomerSelect(customer)}
                      >
                        <div className="font-medium">{customer.Name}</div>
                        <div className="text-sm text-gray-600">Code: {customer.VCode}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Selected Customer Display */}
              {selectedCustomer && (
                <div className="mt-3 p-3 bg-blue-50 rounded-md">
                  <div className="font-semibold">Selected Customer:</div>
                  <div>{selectedCustomer.Name}</div>
                  <div className="text-sm text-gray-600">Code: {selectedCustomer.VCode}</div>
                </div>
              )}
            </div>

            {/* Rest of your existing code remains the same */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">CSV Upload</h3>
              <div
                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${file ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-400'
                  }`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file && (file.type === 'text/csv' || file.name.endsWith('.csv'))) {
                    processFile(file);
                  }
                }}
              >
                {file ? (
                  <div className="flex flex-col items-center space-y-3 w-full">
                    <div className="flex items-center justify-between w-full bg-green-100 px-3 py-2 rounded-md max-w-full">
                      <div className="flex items-center min-w-0">
                        <FaCheck className="text-green-500 mr-2 flex-shrink-0" />
                        <span className="font-medium text-green-800 truncate block overflow-hidden">
                          {file.name}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFile();
                        }}
                        className="text-gray-500 hover:text-red-500 ml-2 flex-shrink-0"
                      >
                        <FaTimes />
                      </button>
                    </div>
                    <p className="text-sm text-green-600">
                      File uploaded successfully
                    </p>
                    <div className="relative">
                      <button
                        onClick={() => document.getElementById('csv-upload').click()}
                        className="text-sm bg-blue-500 text-white px-3 py-1 rounded-md hover:bg-blue-600"
                      >
                        Change File
                      </button>
                      <input
                        type="file"
                        accept=".csv"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            processFile(e.target.files[0]);
                          }
                        }}
                        className="hidden"
                        id="csv-upload"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <FaFileUpload className="text-blue-500 text-3xl mx-auto mb-2" />
                    <p className="text-gray-600 mb-2">Drag & drop CSV file</p>
                    <p className="text-xs text-gray-500 mb-3">or</p>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          processFile(e.target.files[0]);
                        }
                      }}
                      className="hidden"
                      id="csv-upload"
                    />
                    <label
                      htmlFor="csv-upload"
                      className="inline-block bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 cursor-pointer"
                    >
                      Browse Files
                    </label>
                  </>
                )}
              </div>
            </div>
            {showMapper && (
              <FieldMapper
                csvHeaders={csvHeaders}
                fixedFields={fixedFields}
                fieldMap={fieldMap}
                mappedData={mappedData}
                onFieldMapChange={(field, value) => {
                  setFieldMap(prev => ({ ...prev, [field]: value }));
                }}
                onSaveMapping={applyMapping}
                csvData={csvData}
                SelectedCustomer={selectedCustomer}
              />
            )}
            {error && (
              <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 mb-4 relative">
                <strong>Error: </strong>
                {error}
                <button
                  onClick={() => setError(null)}
                  className="absolute top-1 right-1 text-red-700 hover:text-red-900"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center p-2">
            <FaFileUpload
              className={`text-xl my-4 cursor-pointer ${file ? 'text-green-500' : 'text-blue-500'
                }`}
              onClick={() => document.getElementById('csv-upload').click()}
            />
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  processFile(e.target.files[0]);
                }
              }}
              className="hidden"
              id="csv-upload"
            />
          </div>
        )}
      </div>

      {/* Right Main Content */}
      <div className="flex-1 flex overflow-hidden">
        <div className="w-full bg-gray-50 shadow-inner p-4 overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Match Results</h3>
            <div className="flex items-center">
              {mappedData.length > 0 && (
                <button
                  className="flex items-center bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 mr-2"
                  onClick={handleDownload}
                >
                  <FaFileDownload className="mr-1" /> Download
                </button>
              )}
              <FaExchangeAlt className="text-gray-500" />
            </div>
          </div>
          {isLoading ? (
            <div className="text-center text-gray-500 mt-10">Matching items...</div>
          ) : apiResults.length > 0 ? (
            <MatchResults csvData={mappedData} />
          ) : (
            <div className="text-center text-gray-500 mt-10">
              {mappedData.length > 0 ? 'No match results yet' : 'Process a CSV file to see matches'}
            </div>
          )}
        </div>
      </div>

      {isMapping && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            Applying mapping...
          </div>
        </div>
      )}
    </div>
  );
}

export default CsvViewer;