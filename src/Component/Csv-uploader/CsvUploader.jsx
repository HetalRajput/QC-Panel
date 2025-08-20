import React, { useState } from 'react';
import { FaFileUpload, FaFileCsv, FaTimes, FaCheck, FaFileDownload, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import FieldMapper from './FieldMapper';
import CsvTable from './CsvTable';

function CsvUploader() {
  const [file, setFile] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [showMapper, setShowMapper] = useState(false);
  const [fieldMap, setFieldMap] = useState({});
  const [mappedData, setMappedData] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isPanelExpanded, setIsPanelExpanded] = useState(true);

  
  // Updated fixedFields to include expiry
  const fixedFields = ['item', 'name', 'batch', 'mrp', 'pack', 'expiry'];

  // Handle field mapping changes
  const handleFieldMapChange = (field, value) => {
    setFieldMap(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Apply mapping to create final dataset
  const applyMapping = () => {
    const mapped = csvData.map(item => ({
      item: fieldMap['item'] ? item[fieldMap['item']] : '',
      name: fieldMap['name'] ? item[fieldMap['name']] : '',
      batch: fieldMap['batch'] ? item[fieldMap['batch']] : '',
      mrp: fieldMap['mrp'] ? item[fieldMap['mrp']] : '',
      pack: fieldMap['pack'] ? item[fieldMap['pack']] : '',
      expiry: fieldMap['expiry'] ? item[fieldMap['expiry']] : 'N/A' // Default to 'N/A' if not mapped
    }));
    setMappedData(mapped);
  };

  // Handle file upload
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFile(file);
      parseCsv(file);
    }
  };

  // Parse CSV file
  const parseCsv = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(header => header.trim());
      const data = lines.slice(1).map(line => {
        const values = line.split(',');
        return headers.reduce((obj, header, i) => {
          obj[header] = values[i] ? values[i].trim() : '';
          return obj;
        }, {});
      });
      setCsvHeaders(headers);
      setCsvData(data);
      setShowMapper(true);
    };
    reader.readAsText(file);
  };

  // Handle drag and drop
  const handleDragEnter = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        setFile(file);
        parseCsv(file);
      }
    }
  };

  // Remove file
  const handleRemoveFile = () => {
    setFile(null);
    setCsvData([]);
    setCsvHeaders([]);
    setShowMapper(false);
    setFieldMap({});
    setMappedData([]);
  };

  // Download processed data
  const handleDownload = () => {
    const headers = Object.keys(mappedData[0] || {});
    const csvContent = [
      headers.join(','),
      ...mappedData.map(row => headers.map(field => row[field]).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'processed_data.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Panel - Collapsible */}
      <div className={`relative ${isPanelExpanded ? 'w-1/3' : 'w-16'} transition-all duration-300 ease-in-out`}>
        <div className={`h-full p-4 overflow-y-auto bg-white shadow-md ${isPanelExpanded ? 'w-full' : 'w-16'}`}>
          {/* Toggle Button */}
          <button
            onClick={() => setIsPanelExpanded(!isPanelExpanded)}
            className="absolute -right-3 top-1/2 z-10 bg-white border border-gray-300 rounded-full w-6 h-6 flex items-center justify-center shadow-md hover:bg-gray-100 transition-colors"
          >
            {isPanelExpanded ? <FaChevronLeft size={12} /> : <FaChevronRight size={12} />}
          </button>

          {isPanelExpanded ? (
            <>
              {/* Drop Zone */}
              <div
                className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                  isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
                }`}
                onDragEnter={handleDragEnter}
                onDragOver={(e) => e.preventDefault()}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {!file ? (
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <FaFileUpload className="text-3xl text-blue-500" />
                    <p className="text-sm font-medium text-gray-700">Drag & drop CSV file</p>
                    <p className="text-xs text-gray-500">or</p>
                    <label className="px-3 py-1 text-sm bg-blue-500 text-white rounded-md cursor-pointer hover:bg-blue-600 transition-colors">
                      Browse
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-2 bg-white rounded-md shadow-sm">
                    <div className="flex items-center space-x-2">
                      <FaFileCsv className="text-xl text-green-500" />
                      <div className="truncate max-w-xs">
                        <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                        <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(2)} KB</p>
                      </div>
                    </div>
                    <button
                      onClick={handleRemoveFile}
                      className="p-1 text-gray-500 hover:text-red-500 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <FaTimes size={12} />
                    </button>
                  </div>
                )}
              </div>

              {/* Field Mapper */}
              {showMapper && (
                <div className="mt-4 bg-white p-4 rounded-lg shadow-sm">
                  <FieldMapper
                    csvHeaders={csvHeaders}
                    fixedFields={fixedFields}
                    fieldMap={fieldMap}
                    onFieldMapChange={handleFieldMapChange}
                    onSaveMapping={applyMapping}
                    csvData={csvData}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center pt-4 space-y-4">
              <FaFileUpload 
                className="text-xl text-blue-500 cursor-pointer" 
                onClick={() => document.getElementById('csv-upload-collapsed').click()}
              />
              <input
                id="csv-upload-collapsed"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              {file && (
                <div className="flex flex-col items-center">
                  <FaFileCsv className="text-xl text-green-500" />
                  <button
                    onClick={handleRemoveFile}
                    className="mt-1 p-1 text-gray-500 hover:text-red-500 rounded-full"
                  >
                    <FaTimes size={10} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel */}
      <div className={`flex-1 p-6 bg-white overflow-y-auto ${isPanelExpanded ? '' : 'ml-16'}`}>
        {mappedData.length > 0 ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-800">
                Processed Data ({mappedData.length} rows)
              </h2>
              <button
                onClick={handleDownload}
                className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
              >
                <FaFileDownload />
                <span>Download CSV</span>
              </button>
            </div>
            <CsvTable data={mappedData} fields={fixedFields} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <p className="text-lg">Upload and map a CSV file to view data</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default CsvUploader;