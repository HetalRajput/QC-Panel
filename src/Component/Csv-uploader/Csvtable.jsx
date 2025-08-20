import React from 'react';
import { FaSort, FaSortUp, FaSortDown } from 'react-icons/fa';

function CsvTable({ data, fields }) {
  const [sortConfig, setSortConfig] = React.useState({
    key: null,
    direction: 'none'
  });

  const sortedData = React.useMemo(() => {
    if (sortConfig.direction === 'none') return data;
    s
    return [...data].sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'ascending' ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === 'ascending' ? 1 : -1;
      }
      return 0;
    });
  }, [data, sortConfig]);

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
    if (sortConfig.key !== key) return <FaSort className="ml-1" />;
    if (sortConfig.direction === 'ascending') return <FaSortUp className="ml-1" />;
    if (sortConfig.direction === 'descending') return <FaSortDown className="ml-1" />;
    return <FaSort className="ml-1" />;
  };

  if (!data || data.length === 0) {
    return <div className="p-4 text-gray-500 text-center">No data to display</div>;
  }

  return (
    <div className="overflow-x-auto shadow-md rounded-lg">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {fields.map(field => (
              <th 
                key={field}
                onClick={() => requestSort(field)}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center">
                  {field}
                  {getSortIcon(field)}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sortedData.map((row, index) => (
            <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              {fields.map(field => (
                <td 
                  key={`${index}-${field}`} 
                  className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                >
                  {row[field] || '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default CsvTable;