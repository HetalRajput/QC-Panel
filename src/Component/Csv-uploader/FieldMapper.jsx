import React, { useState, useRef, useEffect } from 'react';
import { FaCheck, FaArrowUp, FaArrowDown } from 'react-icons/fa';
import axios from 'axios';

function FieldMapper({ csvHeaders, fixedFields, fieldMap, onFieldMapChange, onSaveMapping, csvData, SelectedCustomer }) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const [showModal, setShowModal] = useState(false);
  const [currentField, setCurrentField] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiResponse, setApiResponse] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [mappedColumns, setMappedColumns] = useState({});
  const selectRefs = useRef([]);
  const modalRef = useRef(null);

  // Add Expiry to the fields to display
  const allFields = [...fixedFields];

  useEffect(() => {
    selectRefs.current = selectRefs.current.slice(0, allFields.length);
  }, [allFields]);

  // Fetch mapped columns when SelectedCustomer changes
  useEffect(() => {
    const fetchMappedColumns = async () => {
      if (SelectedCustomer && SelectedCustomer.VCode) {
        try {
          setIsLoading(true);
          const response = await axios.get(
            `http://jemapps.in/api/ocr/get-mapped-column?SuppCode=${SelectedCustomer.VCode}`
          );
          
          if (response.data && typeof response.data === 'object') {
            setMappedColumns(response.data);
            console.log('Fetched mapped columns:', response.data);
            
            // Create a mapping between the API response fields and our field names
            const fieldNameMapping = {
              'Code': 'item',
              'Name': 'name',
              'Batch': 'batch',
              'MRP': 'mrp',
              'Pack': 'pack',
              'Expiry': 'Expiry',
              'Quantity': 'quantity',
              'Fquantity': 'freequantity'
            };

            // Apply the mapped columns to the fieldMap
            const newFieldMap = {};
            Object.entries(response.data).forEach(([apiField, column]) => {
              const ourField = fieldNameMapping[apiField];
              if (column && ourField && allFields.includes(ourField)) {
                newFieldMap[ourField] = column;
              }
            });
            
            // Update the parent component's fieldMap
            Object.entries(newFieldMap).forEach(([field, column]) => {
              onFieldMapChange(field, column);
            });
          }
        } catch (error) {
          console.error('Error fetching mapped columns:', error);
          setApiError('Failed to load saved field mappings');
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchMappedColumns();
  }, [SelectedCustomer]);

  const handleKeyDown = (e, field, index) => {
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        if (index > 0) {
          selectRefs.current[index - 1].focus();
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (index < allFields.length - 1) {
          selectRefs.current[index + 1].focus();
        }
        break;
      case 'Enter':
        e.preventDefault();
        setCurrentField(field);
        setShowModal(true);
        break;
      default:
        break;
    }
  };

  const handleModalKeyDown = (e) => {
    if (e.key === 'Escape') {
      setShowModal(false);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const options = modalRef.current.querySelectorAll('option');
      const currentIndex = Array.from(options).findIndex(opt => opt.selected);
      
      if (e.key === 'ArrowUp' && currentIndex > 0) {
        options[currentIndex - 1].selected = true;
      } else if (e.key === 'ArrowDown' && currentIndex < options.length - 1) {
        options[currentIndex + 1].selected = true;
      }
    } else if (e.key === 'Enter') {
      const select = modalRef.current.querySelector('select');
      onFieldMapChange(currentField, select.value);
      setShowModal(false);
    }
  };

  const handleSaveMapping = async () => {
    // First call the original onSaveMapping function
    onSaveMapping();
    
    try {
      setIsLoading(true);
      setApiError(null);
      
      // Prepare the data for the insert API call
      console.log('Field Map before saving >>>>>>>>>>>>>>:', fieldMap);
      
      const mappingData = {
        SuppCode: SelectedCustomer?.VCode || "",
        Code: fieldMap['item'] || "",
        Name: fieldMap['name'] || "",
        Batch: fieldMap['batch'] || "",
        MRP: fieldMap['mrp'] || "",
        Expiry: fieldMap['Expiry'] || "",
        Pack: fieldMap['pack'] || "",
        Quantity: fieldMap['quantity'] || "",
        Fquantity: fieldMap['freequantity'] || "",  // Changed from fieldMap['fquantity']
      };


      console.log('Saving mapping data<<<<<<<<<<<<<<<<<:', mappingData);
      
      // Call the insert API
      const response = await axios.post(
        'http://jemapps.in/api/ocr/insert-map-csv-column',
        mappingData,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      setApiResponse(response.data);
      console.log('Mapping saved successfully:', response.data);

      // Also send the processed data to the other endpoint
      const apiData = csvData.map(item => {
        // Get the mapped field names from fieldMap with fallbacks
        const itemCodeField = fieldMap['item'] || 'code';
        const nameField = fieldMap['name'] || 'item name';
        const mrpField = fieldMap['mrp'] || 'mrp';
        const batchField = fieldMap['batch'] || 'batch';
        const packField = fieldMap['pack'] || 'pack';
        const expiryField = fieldMap['Expiry'] || 'EXPIRY';

        // Convert field names to lowercase for case-insensitive matching
        const lowerCaseItem = Object.fromEntries(
          Object.entries(item).map(([key, value]) => [key.toLowerCase(), value])
        );

        return {
          item_code: lowerCaseItem[itemCodeField.toLowerCase()] || '',
          name: lowerCaseItem[nameField.toLowerCase()] || '',
          Mrp: parseFloat(lowerCaseItem[mrpField.toLowerCase()]) || 0,
          Batch: lowerCaseItem[batchField.toLowerCase()] || '',
          Pack: lowerCaseItem[packField.toLowerCase()] || '',
          Expiry: lowerCaseItem[expiryField.toLowerCase()] || 'N/A'
        };
      });

      const processResponse = await axios.post(
        'http://192.168.1.110:6500/api/ocr/process_json', 
        apiData,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('Data processed successfully:', processResponse.data);

    } catch (error) {
      console.error('API Error:', error);
      setApiError(error.message || 'Failed to save field mappings');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-gray-800">Map CSV Fields</h3>
      
      <div className="space-y-4">
        {allFields.map((field, index) => (
          <div key={field} className="flex items-center justify-between">
            <label className="w-1/4 text-sm font-medium text-gray-700 capitalize">
              {field.replace('_', ' ')}
              {field === 'Expiry'}
            </label>
            <div className="relative w-3/4">
              <select
                ref={el => selectRefs.current[index] = el}
                value={fieldMap[field] || ''}
                onChange={(e) => onFieldMapChange(field, e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, field, index)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">-- Select {field === 'Expiry' || ''} --</option>
                {csvHeaders.map((header) => (
                  <option key={header} value={header}>
                    {header}
                  </option>
                ))}
              </select>
              <div className="absolute right-2 top-2 flex flex-col">
                <button 
                  onClick={() => index > 0 && selectRefs.current[index - 1].focus()}
                  className="text-gray-500 hover:text-gray-700"
                >
                </button>
                <button 
                  onClick={() => index < allFields.length - 1 && selectRefs.current[index + 1].focus()}
                  className="text-gray-500 hover:text-gray-700"
                >
                  
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowModal(false)}
        >
          <div 
            ref={modalRef}
            className="bg-white p-6 rounded-lg shadow-lg w-96"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleModalKeyDown}
          >
            <h4 className="text-lg font-medium mb-4">Select field for: {currentField}</h4>
            <select
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm mb-4"
              value={fieldMap[currentField] || ''}
              onChange={(e) => {
                onFieldMapChange(currentField, e.target.value);
                setShowModal(false);
              }}
            >
              <option value="">-- Select --</option>
              {csvHeaders.map((header) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </select>
            <div className="flex justify-between">
              <button 
                className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button 
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                onClick={() => {
                  const select = modalRef.current.querySelector('select');
                  onFieldMapChange(currentField, select.value);
                  setShowModal(false);
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={handleSaveMapping}
        disabled={isLoading}
        className="flex items-center justify-center w-full px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400"
      >
        {isLoading ? (
          'Saving...'
        ) : (
          <>
            <FaCheck className="mr-2" />
            Apply Mapping
          </>
        )}
      </button>

      {apiError && (
        <div className="p-4 text-red-700 bg-red-100 rounded-md">
          Error: {apiError}
        </div>
      )}

      {apiResponse && (
        <div className="p-4 text-green-700 bg-green-100 rounded-md">
          Field mappings saved successfully!
        </div>
      )}
    </div>
  );
}

export default FieldMapper;