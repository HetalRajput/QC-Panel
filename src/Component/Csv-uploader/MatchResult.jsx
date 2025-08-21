import React, { useEffect, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { FaSort, FaSortUp, FaSortDown, FaTimes, FaFileExcel } from 'react-icons/fa';
import * as XLSX from 'xlsx';

const VerifyListener = ({ csvData }) => {
  // State management
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [products, setProducts] = useState([]); // Combined products
  const [socket, setSocket] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'none' });
  const [error, setError] = useState(null);
  const [showErrorPopup, setShowErrorPopup] = useState(false);

  // Initialize with CSV data if provided
  useEffect(() => {
    if (csvData && csvData.length > 0) {
      const initialProducts = csvData.map(item => ({
        ...item,
        timestamp: new Date().toISOString(),
        id: Date.now() + Math.random(),
        success: false,
        similarity: 0,
        message: 'Not Uploaded',
        mismatches: null,
        quantity: 0,
        status: 'not_uploaded',
        source: 'csv' // Track source of data
      }));
      setProducts(initialProducts);
    }
  }, [csvData]);

  // Handle socket connection and messages
  useEffect(() => {
    const newSocket = io("http://192.168.1.110:6500", {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    setSocket(newSocket);

    const handleConnect = () => {
      console.log("Connected to server");
      setConnectionStatus("connected");
    };

    const handleDisconnect = () => {
      console.log("Disconnected from server");
      setConnectionStatus("disconnected");
    };

    const handleConnectError = (err) => {
      console.error("Connection error:", err);
      setConnectionStatus("error");
    };

    const handleProductVerified = (data) => {
      try {
        console.log("Received verified product:", data);
        
        if (!data || !data.matched_product) {
          throw new Error("Invalid data format received from server");
        }

        const product = data.matched_product;
        if (!product.item && !product.item_code && !product.code) {
          throw new Error("Unknown product received - missing identification");
        }

        setProducts(prev => {
          const productKey = `${product.item || product.item_code || product.code}_${
            product.Batch || product.batch
          }_${data.success ? 'verified' : 'failed'}`;
          
          const existingProductIndex = prev.findIndex(p => {
            const pKey = `${p.item || p.item_code || p.code}_${p.Batch || p.batch}_${p.status}`;
            return pKey === productKey;
          });
          
          // If product exists with same status, update quantity
          if (existingProductIndex >= 0) {
            const updatedProducts = [...prev];
            const existingProduct = updatedProducts[existingProductIndex];
            
            // Update the existing product
            updatedProducts[existingProductIndex] = {
              ...existingProduct,
              ...product,
              timestamp: new Date().toISOString(),
              success: data.success,
              similarity: data.similarity,
              message: data.success ? 'Verified' : 'Failed',
              mismatches: data.mismatches,
              quantity: (existingProduct.quantity || 0) + 1,
              status: data.success ? 'verified' : 'failed',
              source: 'realtime'
            };
            
            // Move updated product to the beginning
            const updatedProduct = updatedProducts.splice(existingProductIndex, 1)[0];
            return [updatedProduct, ...updatedProducts].slice(0, 50);
          } 
          // If product doesn't exist, create a new entry
          else {
            const status = data.success ? 'verified' : 'failed';
            const formattedData = {
              ...product,
              timestamp: new Date().toISOString(),
              id: Date.now() + Math.random(),
              success: data.success,
              similarity: data.similarity,
              message: data.success ? 'Verified' : 'Failed',
              mismatches: data.mismatches,
              quantity: 1,
              status: status,
              source: 'realtime'
            };
            
            // Add new product at the beginning
            return [formattedData, ...prev].slice(0, 50);
          }
        });
      } catch (err) {
        console.error("Error processing product data:", err);
        setError(err.message);
        setShowErrorPopup(true);
      }
    };

    // Event listeners
    newSocket.on("connect", handleConnect);
    newSocket.on("disconnect", handleDisconnect);
    newSocket.on("connect_error", handleConnectError);
    newSocket.on("product_verified", handleProductVerified);

    // Cleanup
    return () => {
      newSocket.off("connect", handleConnect);
      newSocket.off("disconnect", handleDisconnect);
      newSocket.off("connect_error", handleConnectError);
      newSocket.off("product_verified", handleProductVerified);
      newSocket.disconnect();
    };
  }, []);

  // Close error popup
  const closeErrorPopup = useCallback(() => {
    setShowErrorPopup(false);
    setError(null);
  }, []);

  // Download all products (both verified and failed) as Excel
  const downloadExcel = useCallback(() => {
    try {
      // Filter verified and failed products (exclude not_uploaded)
      const exportProducts = products.filter(product => 
        product.status === 'verified' || product.status === 'failed'
      );
      
      if (exportProducts.length === 0) {
        setError("No products to download");
        setShowErrorPopup(true);
        return;
      }

      // Prepare data for Excel
      const excelData = exportProducts.map(product => ({
        'Timestamp': new Date(product.timestamp).toLocaleString(),
        'Item Code': product.item || product.item_code || product.code || "N/A",
        'Product Name': product.name || "Unknown Product",
        'Batch': product.Batch || product.batch || "N/A",
        'MRP': `₹${parseFloat(product.Mrp || product.mrp || 0).toFixed(2)}`,
        'Expiry': product.Expiry || product.expiry || product.EXPIRY || "N/A",
        'Pack': product.Pack || product.pack || "N/A",
        'Quantity': product.quantity || 0,
        'Status': product.status === 'verified' ? 'Verified' : 'Failed',
        'Similarity': product.similarity ? `${(product.similarity * 100).toFixed(2)}%` : "N/A",
        'Mismatches': product.mismatches ? JSON.stringify(product.mismatches) : "N/A",
        'Message': product.message || "N/A",
        'Source': product.source || "N/A"
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);
      
      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, "All Products");
      
      // Generate Excel file and trigger download
      const fileName = `product_verification_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
    } catch (err) {
      console.error("Error generating Excel file:", err);
      setError("Failed to generate Excel file");
      setShowErrorPopup(true);
    }
  }, [products]);

  // Sorting logic
  const sortedProducts = React.useMemo(() => {
    let productsToSort = [...products];
    
    // Default sort - verified/failed first, then by timestamp (newest first)
    if (sortConfig.direction === 'none') {
      return productsToSort.sort((a, b) => {
        // Priority: verified/failed > not_uploaded
        if (a.status !== 'not_uploaded' && b.status === 'not_uploaded') return -1;
        if (a.status === 'not_uploaded' && b.status !== 'not_uploaded') return 1;
        
        // Then sort by timestamp (newest first)
        return new Date(b.timestamp) - new Date(a.timestamp);
      });
    }

    // Custom sorting when a column is selected
    return productsToSort.sort((a, b) => {
      const aValue = sortConfig.key === 'similarity' ? (a.similarity || 0) :
                   sortConfig.key === 'Mrp' ? parseFloat(a.Mrp || a.mrp || 0) :
                   sortConfig.key === 'quantity' ? (a.quantity || 0) :
                   a[sortConfig.key];
      const bValue = sortConfig.key === 'similarity' ? (b.similarity || 0) :
                   sortConfig.key === 'Mrp' ? parseFloat(b.Mrp || b.mrp || 0) :
                   sortConfig.key === 'quantity' ? (b.quantity || 0) :
                   b[sortConfig.key];

      if (aValue < bValue) {
        return sortConfig.direction === 'ascending' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'ascending' ? 1 : -1;
      }
      return 0;
    });
  }, [products, sortConfig]);

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    } else if (sortConfig.key === key && sortConfig.direction === 'descending') {
      direction = 'none';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <FaSort className="ml-1 opacity-50" />;
    if (sortConfig.direction === 'ascending') return <FaSortUp className="ml-1" />;
    if (sortConfig.direction === 'descending') return <FaSortDown className="ml-1" />;
    return <FaSort className="ml-1" />;
  };

  // Helper functions
  const getStatusBadge = (product) => {
    switch(product.status) {
      case 'verified':
        return {
          text: "Verified",
          class: "bg-green-100 text-green-800"
        };
      case 'failed':
        return {
          text: "Failed",
          class: "bg-red-100 text-red-800"
        };
      case 'not_uploaded':
      default:
        return {
          text: "Not Uploaded",
          class: "bg-gray-100 text-gray-800"
        };
    }
  };

  const getSimilarityColor = (similarity) => {
    if (similarity >= 0.9) return "text-green-600 font-bold";
    if (similarity >= 0.7) return "text-yellow-600 font-medium";
    return "text-red-600";
  };

  // Table configuration
  const tableFields = [
    { key: 'timestamp', label: 'Timestamp', width: 'w-40' },
    { key: 'item', label: 'Item Code', width: 'w-32' },
    { key: 'name', label: 'Product Name', width: 'w-64' },
    { key: 'batch', label: 'Batch', width: 'w-24' },
    { key: 'mrp', label: 'MRP', width: 'w-24' },
    { key: 'Expiry', label: 'Expiry', width: 'w-24' },
    { key: 'pack', label: 'Pack', width: 'w-24' },
    { key: 'quantity', label: 'Qty', width: 'w-16' },
    { key: 'status', label: 'Status', width: 'w-24' },
    { key: 'similarity', label: 'Similarity', width: 'w-24' },
    { key: 'details', label: 'Details', width: 'w-64' }
  ];

  return (
    <div className="w-full mx-auto p-4 bg-gray-50 min-h-screen relative">
      {/* Error Popup */}
      {showErrorPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold text-red-600">Verification Error</h3>
              <button 
                onClick={closeErrorPopup}
                className="text-gray-500 hover:text-gray-700"
              >
                <FaTimes />
              </button>
            </div>
            <div className="mb-4">
              <p className="text-red-600">{error}</p>
              <p className="mt-2 text-gray-700">Please scan the product again.</p>
            </div>
            <div className="flex justify-end">
              <button
                onClick={closeErrorPopup}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-full mx-auto bg-white rounded-xl shadow-md overflow-hidden p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Product Verification</h2>
            <p className="text-sm text-gray-500 mt-1">
              Combined view of all products
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={downloadExcel}
              className="flex items-center bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700 transition-colors"
              title="Download all products as Excel"
            >
              <FaFileExcel className="mr-2" />
              Export Excel
            </button>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              connectionStatus === "connected"
                ? "bg-green-100 text-green-800"
                : connectionStatus === "error"
                ? "bg-red-100 text-red-800"
                : "bg-yellow-100 text-yellow-800"
            }`}>
              {connectionStatus.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Products Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {tableFields.map((field) => (
                  <th
                    key={field.key}
                    onClick={() => requestSort(field.key)}
                    className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 ${field.width}`}
                  >
                    <div className="flex items-center">
                      {field.label}
                      {getSortIcon(field.key)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedProducts.length > 0 ? (
                sortedProducts.map((product) => {
                  const status = getStatusBadge(product);
                  const similarity = product.similarity || 0;

                  return (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(product.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {product.item || product.item_code || product.code || "N/A"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="line-clamp-2">
                          {product.name || "Unknown Product"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.Batch || product.batch || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ₹{parseFloat(product.Mrp || product.mrp || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.Expiry || product.expiry || product.EXPIRY || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.Pack || product.pack || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${status.class}`}>
                          {status.text}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {product.status === 'not_uploaded' ? (
                          <span className="text-gray-500">-</span>
                        ) : (
                          <span className={`${getSimilarityColor(similarity)}`}>
                            {(similarity * 100).toFixed(2)}%
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {product.status === 'not_uploaded' ? (
                          <span className="text-blue-600">Not Uploaded</span>
                        ) : product.status === 'verified' ? (
                          <span className="text-green-600">✓ Verified successfully</span>
                        ) : (
                          <div className="space-y-1">
                            {product.message && <div className="text-red-600">{product.message}</div>}
                            {product.mismatches && Object.entries(product.mismatches).map(([key, value]) => (
                              <div key={key} className="text-red-600">
                                <span className="font-medium">{key}:</span> {value}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={tableFields.length} className="px-6 py-8 text-center text-sm text-gray-500">
                    {products.length === 0
                      ? "No products available. Please upload a CSV file or wait for verification results."
                      : "Not connected to server"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700">Legend</h3>
              <p className="text-xs text-gray-500 mt-1">Status indicators</p>
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center">
                <span className="w-3 h-3 bg-green-100 rounded-full mr-2 border border-green-500"></span>
                <span className="text-xs">Verified</span>
              </div>
              <div className="flex items-center">
                <span className="w-3 h-3 bg-red-100 rounded-full mr-2 border border-red-500"></span>
                <span className="text-xs">Failed</span>
              </div>
              <div className="flex items-center">
                <span className="w-3 h-3 bg-gray-100 rounded-full mr-2 border border-gray-500"></span>
                <span className="text-xs">Not Uploaded</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 text-xs text-gray-500 text-center">
          Showing {sortedProducts.length} products
        </div>
      </div>
    </div>
  );
};

export default VerifyListener;