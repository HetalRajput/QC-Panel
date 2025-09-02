import React, { useEffect, useState, useCallback } from "react";
import { FaSort, FaSortUp, FaSortDown, FaTimes, FaFileExcel, FaExclamationTriangle, FaDownload } from 'react-icons/fa';
import * as XLSX from 'xlsx';
import axios from 'axios';
import { initializeSocket, getSocket, disconnectSocket } from '../../Utility/ConnectionService'

const VerifyListener = ({ csvData, selectedCustomer }) => {


    console.log("CSV Data >>>>>>> :", csvData);
    


  // State management
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [products, setProducts] = useState([]); // Combined products
  const [socket, setSocket] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'none' });
  const [error, setError] = useState(null);
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [overQuantityProduct, setOverQuantityProduct] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [token ,setToken] = useState('');
  
 
    useEffect(() => {
      const storedToken = localStorage.getItem("token");
      
      if (storedToken) {
        setToken(storedToken);
      }
    }, []);

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
        scanned_quantity: 0,
        status: 'not_uploaded',
        source: 'csv' // Track source of data
      }));
      setProducts(initialProducts);
    }
  }, [csvData]);

  // Check if scanned quantity exceeds allowed quantity (quantity + freequantity) for the same item code
  const checkQuantityExceeded = useCallback((products, itemCode, newScannedQuantity) => {
    // Find the CSV product to get the allowed quantity
    const csvProduct = products.find(p =>
      (p.item_code || p.item || p.code) === itemCode && p.source === 'csv'
    );

    if (!csvProduct) return false;

    // Calculate total scanned quantity for this item code across all statuses
    const totalScanned = products
      .filter(p => (p.item_code || p.item || p.code) === itemCode && p.source !== 'csv')
      .reduce((sum, p) => sum + (p.scanned_quantity || 0), 0);

    const totalAllowed = (csvProduct.quantity || 0) + (csvProduct.freequantity || 0);

    // Check if adding the new quantity would exceed the limit
    return (totalScanned + newScannedQuantity) > totalAllowed;
  }, []);

  // Get total scanned quantity for an item code
  const getTotalScannedQuantity = useCallback((products, itemCode) => {
    return products
      .filter(p => (p.item_code || p.item || p.code) === itemCode && p.source !== 'csv')
      .reduce((sum, p) => sum + (p.scanned_quantity || 0), 0);
  }, []);

  // Get allowed quantity for an item code
  const getAllowedQuantity = useCallback((products, itemCode) => {
    const csvProduct = products.find(p =>
      (p.item_code || p.item || p.code) === itemCode && p.source === 'csv'
    );

    if (!csvProduct) return 0;

    return (csvProduct.quantity || 0) + (csvProduct.freequantity || 0);
  }, []);

   


    
  // Handle socket connection and messages
  useEffect(() => {
    if (!token) return; // Don't initialize socket until token is available

    const newSocket = initializeSocket(token);
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
          const itemCode = product.item || product.item_code || product.code;
          const productKey = `${itemCode}_${product.Batch || product.batch
            }_${data.success ? 'verified' : 'failed'}`;

          // Check if adding this product would exceed the allowed quantity
          const quantityExceeded = checkQuantityExceeded(prev, itemCode, 1);

          if (quantityExceeded) {
            const csvProduct = prev.find(p =>
              (p.item_code || p.item || p.code) === itemCode && p.source === 'csv'
            );

            setOverQuantityProduct({
              ...product,
              quantity: csvProduct?.quantity || 0,
              freequantity: csvProduct?.freequantity || 0,
              scanned_quantity: getTotalScannedQuantity(prev, itemCode) + 1
            });
            return prev; // Don't update if quantity is exceeded
          }

          // If product is verified, create a single entry
          if (data.success) {
            const existingProductIndex = prev.findIndex(p => {
              const pKey = `${p.item || p.item_code || p.code}_${p.Batch || p.batch}_${p.status}`;
              return pKey === productKey;
            });

            // If product exists with same status, update scanned quantity
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
                scanned_quantity: (existingProduct.scanned_quantity || 0) + 1,
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

              // Find the original CSV product to get quantity and freequantity
              const csvProduct = prev.find(p =>
                (p.item_code || p.item || p.code) === itemCode && p.source === 'csv'
              );

              const formattedData = {
                ...product,
                quantity: csvProduct ? csvProduct.quantity : 0,
                freequantity: csvProduct ? csvProduct.freequantity : 0,
                timestamp: new Date().toISOString(),
                id: Date.now() + Math.random(),
                success: data.success,
                similarity: data.similarity,
                message: data.success ? 'Verified' : 'Failed',
                mismatches: data.mismatches,
                scanned_quantity: 1,
                status: status,
                source: 'realtime'
              };

              // Add new product at the beginning
              return [formattedData, ...prev].slice(0, 50);
            }
          }
          // If product failed, create multiple entries for each mismatch reason
          else {
            const newProducts = [];
            const timestamp = new Date().toISOString();

            // Find the original CSV product to get quantity and freequantity
            const csvProduct = prev.find(p =>
              (p.item_code || p.item || p.code) === itemCode && p.source === 'csv'
            );

            // Create a separate entry for each mismatch
            if (data.mismatches) {
              Object.entries(data.mismatches).forEach(([reason, details]) => {
                const mismatchId = `${itemCode}_${product.Batch || product.batch}_${reason}`;

                // Check if this specific mismatch already exists
                const existingMismatchIndex = prev.findIndex(p =>
                  p.id === mismatchId && p.status === 'failed'
                );

                if (existingMismatchIndex >= 0) {
                  // Update existing mismatch entry
                  const updatedProducts = [...prev];
                  const existingProduct = updatedProducts[existingMismatchIndex];

                  updatedProducts[existingMismatchIndex] = {
                    ...existingProduct,
                    timestamp: timestamp,
                    scanned_quantity: (existingProduct.scanned_quantity || 0) + 1,
                    message: `Failed: ${reason} mismatch`
                  };

                  newProducts.push(updatedProducts[existingMismatchIndex]);
                } else {
                  // Create new mismatch entry
                  newProducts.push({
                    ...product,
                    quantity: csvProduct ? csvProduct.quantity : 0,
                    freequantity: csvProduct ? csvProduct.freequantity : 0,
                    timestamp: timestamp,
                    id: mismatchId,
                    success: false,
                    similarity: data.similarity,
                    message: `Failed: ${reason} mismatch`,
                    mismatches: { [reason]: details },
                    scanned_quantity: 1,
                    status: 'failed',
                    source: 'realtime',
                    failureReason: reason
                  });
                }
              });
            } else {
              // If no specific mismatches, create a general failed entry
              newProducts.push({
                ...product,
                quantity: csvProduct ? csvProduct.quantity : 0,
                freequantity: csvProduct ? csvProduct.freequantity : 0,
                timestamp: timestamp,
                id: `${itemCode}_${product.Batch || product.batch}_general`,
                success: false,
                similarity: data.similarity,
                message: 'Failed: General mismatch',
                mismatches: data.mismatches,
                scanned_quantity: 1,
                status: 'failed',
                source: 'realtime',
                failureReason: 'general'
              });
            }

            // Add new products at the beginning and limit to 50 entries
            return [...newProducts, ...prev].slice(0, 50);
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
      // Don't disconnect socket here as it's managed by the service
    };
  }, [checkQuantityExceeded, getTotalScannedQuantity, token]);

  // Close error popup
  const closeErrorPopup = useCallback(() => {
    setShowErrorPopup(false);
    setError(null);
  }, []);

  // Close over quantity popup
  const closeOverQuantityPopup = useCallback(() => {
    setOverQuantityProduct(null);
  }, []);

  // Download all products (both verified and failed) as Excel


  // Export report to server API - Fixed to handle CSV response
  const exportReportToServer = useCallback(async () => {
    try {
      setIsExporting(true);

      // Filter verified and failed products (exclude not_uploaded)
      const exportProducts = products.filter(product =>
        product.status === 'verified' || product.status === 'failed'
      );

      if (exportProducts.length === 0) {
        setError("No products to export");
        setShowErrorPopup(true);
        setIsExporting(false);
        return;
      }

      // Format data according to the required API structure
      const reportData = exportProducts.map(product => {
        // Find the original CSV product to get all the required fields
        const csvProduct = products.find(p =>
          (p.item_code || p.item || p.code) === (product.item || product.item_code || product.code) &&
          p.source === 'csv'
        );

        // Helper function to convert values to proper types
        const getNumericValue = (value, defaultValue = 0) => {
          if (value === undefined || value === null || value === "N/A") return defaultValue;
          const num = parseFloat(value);
          return isNaN(num) ? defaultValue : num;
        };

        // Helper function to get string values
        const getStringValue = (value, defaultValue = "N/A") => {
          if (value === undefined || value === null) return defaultValue;
          return String(value);
        };

        // Use CSV data as base, then override with scanned product data where available
        return {
          BillNo: getStringValue(csvProduct?.['Bill No'] || csvProduct?.BillNo || product.BillNo),
          CGST: getNumericValue(csvProduct?.CGST || product.CGST || product.cgst),
          Discount: getNumericValue(csvProduct?.DIS || csvProduct?.Discount || product.Discount || product.DIS || product.discount),
          Expiry: getStringValue(product.Expiry || product.expiry || product.EXPIRY || csvProduct?.Expiry),
          FTrate: getNumericValue(csvProduct?.FTRate || csvProduct?.FTrate || product.FTrate || product.FTrate || product.ftrate),
          HSNCode: getStringValue(csvProduct?.HSNCODE || product.HSNCODE || product.HSNCode),
          IGST: getNumericValue(csvProduct?.IGST || product.IGST || product.igst),
          SGST: getNumericValue(csvProduct?.SGST || product.SGST || product.sgst),
          SRate: getNumericValue(csvProduct?.SRate || product.SRate || product.Srate || product.srate),
          Scm1: getNumericValue(csvProduct?.Scm1 || product.Scm1 || product.scm1),
          Scm2: getNumericValue(csvProduct?.Scm2 || product.Scm2 || product.scm2),
          ScmPer: getNumericValue(csvProduct?.ScmPer || product.ScmPer || product.scmPer || product.SCMPer),
          batch: getStringValue(product.Batch || product.batch || csvProduct?.batch),
          freequantity: getNumericValue(product.freequantity || csvProduct?.freequantity),
          item: getStringValue(product.item || product.item_code || product.code || csvProduct?.item),
          mrp: getNumericValue(product.Mrp || product.mrp || csvProduct?.mrp),
          name: getStringValue(product.name || csvProduct?.name, "Unknown Product"),
          pack: getStringValue(product.Pack || product.pack || csvProduct?.pack),
          quantity: getNumericValue(product.quantity || csvProduct?.quantity),
          SuppCode: getStringValue(csvProduct?.SuppCode || product.SuppCode || product.suppCode || selectedCustomer?.VCode || "N/A"),
        };
      });

      console.log("Report data to be sent:", reportData);

      // Try sending the data as a direct array first
      try {
        const response = await axios.post(
          'http://jemapps.in/api/ocr/generate-easysol-report',
          reportData,
          {
            headers: {
              'Content-Type': 'application/json',
            },
            responseType: 'blob'
          }
        );

        // Handle successful response - check if it's CSV
        const contentType = response.headers['content-type'];
        const blob = new Blob([response.data], { type: contentType });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;

        const date = new Date().toISOString().split('T')[0];
        
        // Determine file extension based on content type
        const fileExtension = contentType.includes('csv') ? 'csv' : 'xlsx';
        a.download = `easysol-report-${date}.${fileExtension}`;

        document.body.appendChild(a);
        a.click();

        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        console.log('Report exported successfully');

      } catch (arrayError) {
        // If array format fails, try with dataArray wrapper
        console.log('Array format failed, trying with dataArray wrapper...');

        const response = await axios.post(
          'http://jemapps.in/api/ocr/generate-easysol-report',
          { dataArray: reportData },
          {
            headers: {
              'Content-Type': 'application/json',
            },
            responseType: 'blob'
          }
        );

        // Handle successful response - check if it's CSV
        const contentType = response.headers['content-type'];
        const blob = new Blob([response.data], { type: contentType });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;

        const date = new Date().toISOString().split('T')[0];
        
        // Determine file extension based on content type
        const fileExtension = contentType.includes('csv') ? 'csv' : 'xlsx';
        a.download = `easysol-report-${date}.${fileExtension}`;

        document.body.appendChild(a);
        a.click();

        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        console.log('Report exported successfully with dataArray wrapper');
      }

    } catch (err) {
      console.error("Error exporting report:", err);

      let errorMessage = "Failed to export report: ";
      if (err.response) {
        if (err.response.data instanceof Blob) {
          const blobText = await err.response.data.text();
          try {
            const errorData = JSON.parse(blobText);
            errorMessage += errorData.message || `Server error ${err.response.status}`;
          } catch {
            errorMessage += `Server error ${err.response.status}`;
          }
        } else {
          errorMessage += err.response.data.message || `Server error ${err.response.status}`;
        }
      } else if (err.request) {
        errorMessage += "No response from server";
      } else {
        errorMessage += err.message;
      }

      setError(errorMessage);
      setShowErrorPopup(true);
    } finally {
      setIsExporting(false);
    }
  }, [products, selectedCustomer]);

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
            sortConfig.key === 'freequantity' ? (a.freequantity || 0) :
              sortConfig.key === 'scanned_quantity' ? (a.scanned_quantity || 0) :
                a[sortConfig.key];
      const bValue = sortConfig.key === 'similarity' ? (b.similarity || 0) :
        sortConfig.key === 'Mrp' ? parseFloat(b.Mrp || b.mrp || 0) :
          sortConfig.key === 'quantity' ? (b.quantity || 0) :
            sortConfig.key === 'freequantity' ? (b.freequantity || 0) :
              sortConfig.key === 'scanned_quantity' ? (b.scanned_quantity || 0) :
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
    switch (product.status) {
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

  // Check if quantity is exceeded for a product
  const isQuantityExceeded = (product) => {
    const itemCode = product.item || product.item_code || product.code;
    const totalScanned = getTotalScannedQuantity(products, itemCode);
    const allowed = getAllowedQuantity(products, itemCode);

    return totalScanned > allowed;
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
    { key: 'freequantity', label: 'Free Qty', width: 'w-20' },
    { key: 'scanned_quantity', label: 'Scanned Qty', width: 'w-24' },
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

      {/* Over Quantity Popup */}
      {overQuantityProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold text-yellow-600 flex items-center">
                <FaExclamationTriangle className="mr-2" />
                Quantity Exceeded
              </h3>
              <button
                onClick={closeOverQuantityPopup}
                className="text-gray-500 hover:text-gray-700"
              >
                <FaTimes />
              </button>
            </div>
            <div className="mb-4">
              <p className="text-yellow-700 font-medium">
                Scanned quantity exceeds allowed limit for:
              </p>
              <div className="mt-2 p-3 bg-yellow-50 rounded-md">
                <p className="font-semibold">{overQuantityProduct.name}</p>
                <p className="text-sm">Item Code: {overQuantityProduct.item || overQuantityProduct.item_code || overQuantityProduct.code || "N/A"}</p>
                <p className="text-sm">Batch: {overQuantityProduct.Batch || overQuantityProduct.batch || "N/A"}</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-gray-500">Allowed Quantity:</p>
                    <p className="font-bold">{(overQuantityProduct.quantity || 0) + (overQuantityProduct.freequantity || 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Total Scanned Quantity:</p>
                    <p className="font-bold text-red-600">{overQuantityProduct.scanned_quantity}</p>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-sm text-gray-600">
                Please verify the quantity or contact supervisor.
              </p>
            </div>
            <div className="flex justify-end">
              <button
                onClick={closeOverQuantityPopup}
                className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              >
                Acknowledge
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
              onClick={exportReportToServer}
              disabled={isExporting}
              className="flex items-center bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
              title="Export report to server"
            >
              {isExporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Exporting...
                </>
              ) : (
                <>
                  <FaDownload className="mr-2" />
                  Export Report
                </>
              )}
            </button>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${connectionStatus === "connected"
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
                  const quantityExceeded = isQuantityExceeded(product);
                  const itemCode = product.item || product.item_code || product.code;
                  const totalScanned = getTotalScannedQuantity(products, itemCode);
                  const allowed = getAllowedQuantity(products, itemCode);

                  return (
                    <tr key={product.id} className={`hover:bg-gray-50 ${quantityExceeded ? 'bg-yellow-50' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(product.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {itemCode || "N/A"}
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        {product.quantity || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        {product.freequantity || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-medium">
                        <div className={`${quantityExceeded ? 'text-red-600' : 'text-gray-500'}`}>
                          {product.scanned_quantity || 0}
                          {quantityExceeded && (
                            <FaExclamationTriangle className="inline-block ml-1 text-yellow-500" title="Quantity exceeded" />
                          )}
                          {product.source !== 'csv' && (
                            <div className="text-xs text-gray-400 mt-1">
                              Total: {totalScanned}/{allowed}
                            </div>
                          )}
                        </div>
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
              <div className="flex items-center">
                <span className="w-3 h-3 bg-yellow-100 rounded-full mr-2 border border-yellow-500"></span>
                <span className="text-xs">Quantity Exceeded</span>
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