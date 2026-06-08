import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, ScatterChart, Scatter, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, RadialBarChart, RadialBar
} from 'recharts';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import '../Design/StockReports.css'

const StockReports = () => {
  const [allData, setAllData] = useState([]);
  const [categorySummary, setCategorySummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activeDashboard, setActiveDashboard] = useState('overview');
  const [selectedMetric, setSelectedMetric] = useState('weight');
  const [selectedFabric, setSelectedFabric] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [rangeValue, setRangeValue] = useState(50);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // New filter states for inventory
  const [inventoryFilters, setInventoryFilters] = useState({
    fabric: '',
    shade: '',
    party: '',
    lotNo: '',
    store: '',
    status: '',
    batchStatus: '',
    minRolls: '',
    maxRolls: '',
    minWeight: '',
    maxWeight: '',
    fromDate: '',
    toDate: ''
  });

  const [showFilters, setShowFilters] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState({
    Timestamp: true,
    'Barcode ID': true,
    'Item Description': true,
    Unit: true,
    Shade: true,
    'Lot No': true,
    'Rect Date': true,
    Party: true,
    Store: true,
    'Issue No': true,
    'Issue Date': true,
    'MRN Pkgs': true,
    'Issue Pkgs': true,
    'ADJ Pkgs': true,
    'Bal Pkgs': true,
    'MRN WT': true,
    'Bal WT': true,
    'Generated Time': false,
    'Batch Status': true,
    Status: true,
    Remarks: false,
    'Total Returned': true
  });

  const API_BASE_URL = 'https://new-fabric-backend-1.onrender.com/api/google-sheets';

  // Enhanced Color Palettes
  const COLOR_PALETTES = {
    vibrant: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'],
    gradient: ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe', '#43e97b', '#38f9d7', '#fa709a', '#fee140'],
    sunset: ['#FF512F', '#DD2476', '#FF416C', '#FF4B2B', '#F9D423', '#FF4E50', '#F53844', '#42378F', '#FF8C00', '#FF0080'],
    ocean: ['#0061FF', '#60EFFF', '#00B4DB', '#0083B0', '#00C9FF', '#92FE9D', '#00B4DB', '#4A90E2', '#7F00FF', '#E100FF'],
    forest: ['#11998E', '#38EF7D', '#1CB5E0', '#000046', '#0B8793', '#360033', '#0F2027', '#203A43', '#2C5364', '#00B09B']
  };

  // Get unique values for filter dropdowns
  const uniqueValues = useMemo(() => {
    return {
      fabrics: [...new Set(allData.map(item => item['Item Description']).filter(Boolean))],
      shades: [...new Set(allData.map(item => item['Shade']).filter(Boolean))],
      parties: [...new Set(allData.map(item => item['Party']).filter(Boolean))],
      lots: [...new Set(allData.map(item => item['Lot No']).filter(Boolean))],
      stores: [...new Set(allData.map(item => item['Store']).filter(Boolean))],
      statuses: [...new Set(allData.map(item => item['Status']).filter(Boolean))],
      batchStatuses: [...new Set(allData.map(item => item['Batch Status']).filter(Boolean))]
    };
  }, [allData]);

  const fetchAllStockData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_BASE_URL}/search/barcode/all-data`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        const transformedData = result.data.map(row => ({
          'Timestamp': row.Timestamp || row['Timestamp'] || '',
          'Barcode ID': row['Barcode ID'] || row.barcodeId || '',
          'Item Description': row['Item Description'] || row.fabricName || row['Fabric Name'] || '',
          'Unit': row.Unit || row['Unit'] || 'KG',
          'Shade': row.Shade || row['Shade'] || '',
          'Lot No': row['Lot No'] || row.lotNumber || '',
          'Rect Date': row['Rect Date'] || row.rectDate || '',
          'Party': row.Party || row['Party'] || row.cmfName || '',
          'Store': row.Store || row['Store'] || '',
          'Issue No': row['Issue No'] || row.issueNo || '',
          'Issue Date': row['Issue Date'] || row.issueDate || '',
          'MRN Pkgs': parseFloat(row['MRN Pkgs'] || row.mrnPkgs || 0),
          'Issue Pkgs': parseFloat(row['Issue Pkgs'] || row.issuePkgs || 0),
          'ADJ Pkgs': parseFloat(row['ADJ Pkgs'] || row.adjPkgs || 0),
          'Bal Pkgs': parseFloat(row['Bal Pkgs'] || row.balPkgs || 0),
          'MRN WT': parseFloat(row['MRN WT'] || row.mrnWT || 0),
          'Bal WT': parseFloat(row['Bal WT'] || row.balWT || 0),
          'Generated Time': row['Generated Time'] || row.generatedTime || '',
          'Batch Status': row['Batch Status'] || row.batchStatus || '',
          'Status': row.Status || row['Status'] || '',
          'Remarks': row.Remarks || row['Remarks'] || '',
          'Total Returned': parseFloat(row['Total Returned'] || row.totalReturned || 0),
          'Original Barcode ID': row['Original Barcode ID'] || row.originalBarcodeId || ''
        }));
        
        setAllData(transformedData);
        setLastUpdated(new Date().toLocaleString());
        console.log(`✅ Loaded ${transformedData.length} records with 22 columns`);
      } else {
        throw new Error(result.message || 'No data received from API');
      }
      
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL]);

  const fetchCategorySummary = useCallback(async () => {
    try {
      let response = await fetch(`${API_BASE_URL}/category-summary`);
      
      if (!response.ok) {
        response = await fetch(`${API_BASE_URL}/sheet/CategorySummary`);
      }
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const transformedSummary = result.data.map(row => ({
            fabricName: row['Fabric Name'] || row.fabricName || '',
            shade: row['Shade'] || row.shade || '',
            totalRolls: parseFloat(row['Total Rolls'] || row.totalRolls || 0),
            totalWeight: parseFloat(row['Total Weight'] || row.totalWeight || 0),
            issuedRolls: parseFloat(row['Issued Rolls'] || row.issuedRolls || 0),
            issuedWeight: parseFloat(row['Issued Weight'] || row.issuedWeight || 0),
            availableRolls: parseFloat(row['Available Rolls'] || row.availableRolls || 0),
            availableWeight: parseFloat(row['Available Weight'] || row.availableWeight || 0)
          }));
          setCategorySummary(transformedSummary);
        }
      }
    } catch (err) {
      console.error('Error fetching Category Summary:', err);
    }
  }, [API_BASE_URL]);

  useEffect(() => {
    Promise.all([fetchAllStockData(), fetchCategorySummary()]);
    const interval = setInterval(() => {
      Promise.all([fetchAllStockData(), fetchCategorySummary()]);
    }, 300000);
    return () => clearInterval(interval);
  }, [fetchAllStockData, fetchCategorySummary]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, inventoryFilters]);

  // Enhanced filtering logic for inventory
  const filteredByAllFilters = useMemo(() => {
    let filtered = [...allData];

    if (filterStatus !== 'all') {
      if (filterStatus === 'in_stock') filtered = filtered.filter(item => item['Status'] === 'in_stock');
      else if (filterStatus === 'issued') filtered = filtered.filter(item => item['Status'] === 'issued');
      else if (filterStatus === 'partially_issued') filtered = filtered.filter(item => item['Status'] === 'partially_issued');
      else if (filterStatus === 'critical') filtered = filtered.filter(item => parseFloat(item['Bal Pkgs']) === 0);
      else if (filterStatus === 'low') filtered = filtered.filter(item => parseFloat(item['Bal Pkgs']) > 0 && parseFloat(item['Bal Pkgs']) < 10);
    }

    if (inventoryFilters.fabric) {
      filtered = filtered.filter(item => item['Item Description'] === inventoryFilters.fabric);
    }
    if (inventoryFilters.shade) {
      filtered = filtered.filter(item => item['Shade'] === inventoryFilters.shade);
    }
    if (inventoryFilters.party) {
      filtered = filtered.filter(item => item['Party'] === inventoryFilters.party);
    }
    if (inventoryFilters.lotNo) {
      filtered = filtered.filter(item => item['Lot No'] === inventoryFilters.lotNo);
    }
    if (inventoryFilters.store) {
      filtered = filtered.filter(item => item['Store'] === inventoryFilters.store);
    }
    if (inventoryFilters.status) {
      filtered = filtered.filter(item => item['Status'] === inventoryFilters.status);
    }
    if (inventoryFilters.batchStatus) {
      filtered = filtered.filter(item => item['Batch Status'] === inventoryFilters.batchStatus);
    }
    if (inventoryFilters.minRolls) {
      filtered = filtered.filter(item => parseFloat(item['Bal Pkgs']) >= parseFloat(inventoryFilters.minRolls));
    }
    if (inventoryFilters.maxRolls) {
      filtered = filtered.filter(item => parseFloat(item['Bal Pkgs']) <= parseFloat(inventoryFilters.maxRolls));
    }
    if (inventoryFilters.minWeight) {
      filtered = filtered.filter(item => parseFloat(item['Bal WT']) >= parseFloat(inventoryFilters.minWeight));
    }
    if (inventoryFilters.maxWeight) {
      filtered = filtered.filter(item => parseFloat(item['Bal WT']) <= parseFloat(inventoryFilters.maxWeight));
    }
    if (inventoryFilters.fromDate) {
      filtered = filtered.filter(item => new Date(item['Rect Date']) >= new Date(inventoryFilters.fromDate));
    }
    if (inventoryFilters.toDate) {
      filtered = filtered.filter(item => new Date(item['Rect Date']) <= new Date(inventoryFilters.toDate));
    }

    return filtered;
  }, [allData, filterStatus, inventoryFilters]);

  const filteredData = useMemo(() => {
    if (!searchTerm) return filteredByAllFilters;
    return filteredByAllFilters.filter(row => {
      return Object.values(row).some(value =>
        value && value.toString().toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [filteredByAllFilters, searchTerm]);

  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      const aNum = parseFloat(aVal);
      const bNum = parseFloat(bVal);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
      }
      const aStr = String(aVal || '');
      const bStr = String(bVal || '');
      return sortConfig.direction === 'asc' 
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
  }, [filteredData, sortConfig]);

  const exportToExcel = () => {
    const exportData = filteredData.map(row => {
      const exportRow = {};
      Object.keys(selectedColumns).forEach(col => {
        if (selectedColumns[col]) {
          exportRow[col] = row[col];
        }
      });
      return exportRow;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory Data');
    
    const maxWidth = Object.keys(exportData[0] || {}).map(col => ({
      wch: Math.max(col.length, ...exportData.map(row => String(row[col] || '').length), 10)
    }));
    ws['!cols'] = maxWidth;
    
    XLSX.writeFile(wb, `inventory_data_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF('landscape', 'mm', 'a4');
      
      doc.setFontSize(18);
      doc.setTextColor(30, 58, 138);
      doc.text('Inventory Report', 20, 20);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 30);
      doc.text(`Total Records: ${filteredData.length}`, 20, 36);
      doc.text(`Filters Applied: ${filterStatus !== 'all' ? filterStatus : 'None'}`, 20, 42);
      
      const visibleColumns = Object.keys(selectedColumns).filter(col => selectedColumns[col]);
      const tableHeaders = visibleColumns;
      const tableData = filteredData.slice(0, 500).map(row => 
        visibleColumns.map(col => {
          let value = row[col] || '-';
          if (typeof value === 'string' && value.length > 25) {
            value = value.substring(0, 22) + '...';
          }
          return String(value);
        })
      );
      
      if (typeof doc.autoTable === 'function') {
        doc.autoTable({
          head: [tableHeaders],
          body: tableData,
          startY: 50,
          theme: 'grid',
          styles: { 
            fontSize: 7, 
            cellPadding: 2,
            textColor: [51, 51, 51],
            lineColor: [200, 200, 200],
            lineWidth: 0.1
          },
          headStyles: { 
            fillColor: [30, 58, 138], 
            textColor: 255, 
            fontSize: 8,
            fontStyle: 'bold',
            halign: 'center'
          },
          alternateRowStyles: { 
            fillColor: [240, 248, 255] 
          },
          margin: { top: 50, left: 15, right: 15 },
          columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 'auto' }
          },
          overflow: 'linebreak'
        });
        
        doc.save(`inventory_report_${new Date().toISOString().split('T')[0]}.pdf`);
      } else {
        console.warn('autoTable not available, using fallback PDF generation');
        fallbackExportToPDF(tableHeaders, tableData);
      }
    } catch (error) {
      console.error('PDF Export Error:', error);
      alert('Error generating PDF. Please try again or use Excel export instead.');
    }
  };

  const fallbackExportToPDF = (headers, data) => {
    const doc = new jsPDF('landscape', 'mm', 'a4');
    
    doc.setFontSize(18);
    doc.text('Inventory Report', 20, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 30);
    doc.text(`Total Records: ${data.length}`, 20, 36);
    
    let yPos = 50;
    const pageHeight = doc.internal.pageSize.height;
    const lineHeight = 6;
    
    doc.setFillColor(30, 58, 138);
    doc.setTextColor(255);
    doc.setFontSize(8);
    
    let xPos = 20;
    const colWidths = headers.map(() => 30);
    
    headers.forEach((header, index) => {
      doc.rect(xPos, yPos - 4, colWidths[index], 6, 'F');
      doc.text(header, xPos + 2, yPos);
      xPos += colWidths[index];
    });
    
    yPos += lineHeight;
    doc.setTextColor(0);
    
    data.slice(0, 200).forEach((row, rowIndex) => {
      if (yPos > pageHeight - 20) {
        doc.addPage();
        yPos = 20;
      }
      
      xPos = 20;
      row.forEach((cell, colIndex) => {
        doc.rect(xPos, yPos - 4, colWidths[colIndex], 6);
        doc.text(String(cell).substring(0, 20), xPos + 2, yPos);
        xPos += colWidths[colIndex];
      });
      yPos += lineHeight;
    });
    
    doc.save(`inventory_report_fallback_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const resetFilters = () => {
    setInventoryFilters({
      fabric: '',
      shade: '',
      party: '',
      lotNo: '',
      store: '',
      status: '',
      batchStatus: '',
      minRolls: '',
      maxRolls: '',
      minWeight: '',
      maxWeight: '',
      fromDate: '',
      toDate: ''
    });
    setFilterStatus('all');
    setSearchTerm('');
    setRangeValue(50);
  };

  const handleFilterChange = (filterName, value) => {
    setInventoryFilters(prev => ({ ...prev, [filterName]: value }));
    setCurrentPage(1);
  };

  const toggleColumn = (column) => {
    setSelectedColumns(prev => ({ ...prev, [column]: !prev[column] }));
  };

  const selectAllColumns = () => {
    const allSelected = {};
    Object.keys(selectedColumns).forEach(col => { allSelected[col] = true; });
    setSelectedColumns(allSelected);
  };

  const deselectAllColumns = () => {
    const allDeselected = {};
    Object.keys(selectedColumns).forEach(col => { allDeselected[col] = false; });
    setSelectedColumns(allDeselected);
  };

  const totalItems = sortedData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = sortedData.slice(startIndex, endIndex);

  const handleSort = (key) => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc'
    });
    setCurrentPage(1);
  };

  const handleRefresh = () => {
    Promise.all([fetchAllStockData(), fetchCategorySummary()]);
    setCurrentPage(1);
    setSearchTerm('');
    setFilterStatus('all');
    resetFilters();
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const metrics = useMemo(() => {
    let totalWeight = 0;
    let totalRolls = 0;
    let totalMrnWeight = 0;
    let totalIssuedWeight = 0;
    let totalReturnedWeight = 0;
    let uniqueFabrics = new Set();
    let uniqueParties = new Set();
    let uniqueShades = new Set();
    let uniqueLots = new Set();
    let criticalStock = 0;
    let lowStock = 0;
    let mediumStock = 0;
    let highStock = 0;
    let totalMrnPkgs = 0;
    let totalIssuedPkgs = 0;
    
    let weightPerRoll = 0;
    let rollsPerFabric = 0;
    
    allData.forEach(item => {
      const balWeight = parseFloat(item['Bal WT']) || 0;
      const balRolls = parseFloat(item['Bal Pkgs']) || 0;
      const mrnWeight = parseFloat(item['MRN WT']) || 0;
      const mrnPkgs = parseFloat(item['MRN Pkgs']) || 0;
      const issuedPkgs = parseFloat(item['Issue Pkgs']) || 0;
      const issuedWeight = parseFloat(item['MRN WT']) - balWeight;
      const returned = parseFloat(item['Total Returned']) || 0;
      
      totalWeight += balWeight;
      totalRolls += balRolls;
      totalMrnWeight += mrnWeight;
      totalMrnPkgs += mrnPkgs;
      totalIssuedPkgs += issuedPkgs;
      totalIssuedWeight += issuedWeight;
      totalReturnedWeight += returned;
      
      if (balRolls === 0) criticalStock++;
      else if (balRolls < 10) lowStock++;
      else if (balRolls < 50) mediumStock++;
      else highStock++;
      
      if (item['Item Description']) uniqueFabrics.add(item['Item Description']);
      if (item['Party']) uniqueParties.add(item['Party']);
      if (item['Shade'] && item['Shade'] !== '-') uniqueShades.add(item['Shade']);
      if (item['Lot No']) uniqueLots.add(item['Lot No']);
    });
    
    weightPerRoll = totalRolls > 0 ? totalWeight / totalRolls : 0;
    rollsPerFabric = uniqueFabrics.size > 0 ? totalRolls / uniqueFabrics.size : 0;
    
    const utilizationRate = totalMrnWeight > 0 ? (totalIssuedWeight / totalMrnWeight) * 100 : 0;
    const returnRate = totalIssuedWeight > 0 ? (totalReturnedWeight / totalIssuedWeight) * 100 : 0;
    const stockHealthScore = ((highStock + mediumStock) / allData.length) * 100;
    
    return { 
      totalWeight: totalWeight.toFixed(1),
      totalRolls: totalRolls.toFixed(0),
      totalMrnWeight: totalMrnWeight.toFixed(1),
      totalIssuedWeight: totalIssuedWeight.toFixed(1),
      totalReturnedWeight: totalReturnedWeight.toFixed(1),
      utilizedWeight: (totalMrnWeight - totalWeight).toFixed(1),
      utilizationRate: utilizationRate.toFixed(1),
      returnRate: returnRate.toFixed(1),
      stockHealthScore: stockHealthScore.toFixed(1),
      weightPerRoll: weightPerRoll.toFixed(1),
      rollsPerFabric: rollsPerFabric.toFixed(1),
      uniqueFabrics: uniqueFabrics.size,
      uniqueParties: uniqueParties.size,
      uniqueShades: uniqueShades.size,
      uniqueLots: uniqueLots.size,
      totalRecords: allData.length,
      criticalStock,
      lowStock,
      mediumStock,
      highStock,
      totalMrnPkgs,
      totalIssuedPkgs
    };
  }, [allData]);

  // Data for various charts
  const stockDistribution = useMemo(() => {
    return [
      { name: 'Critical (0)', value: metrics.criticalStock, color: COLOR_PALETTES.vibrant[0] },
      { name: 'Low (1-10)', value: metrics.lowStock, color: COLOR_PALETTES.vibrant[1] },
      { name: 'Medium (11-50)', value: metrics.mediumStock, color: COLOR_PALETTES.vibrant[2] },
      { name: 'High (50+)', value: metrics.highStock, color: COLOR_PALETTES.vibrant[3] }
    ];
  }, [metrics]);

  const topFabrics = useMemo(() => {
    const fabricMap = new Map();
    allData.forEach(item => {
      const fabric = item['Item Description'];
      const weight = parseFloat(item['Bal WT']) || 0;
      const rolls = parseFloat(item['Bal Pkgs']) || 0;
      if (fabric && fabric !== '') {
        const existing = fabricMap.get(fabric) || { weight: 0, rolls: 0 };
        fabricMap.set(fabric, { 
          weight: existing.weight + weight, 
          rolls: existing.rolls + rolls 
        });
      }
    });
    return Array.from(fabricMap.entries())
      .map(([name, data], index) => ({ 
        name: name.length > 20 ? name.substring(0, 20) + '...' : name, 
        weight: data.weight,
        rolls: data.rolls,
        avgWeightPerRoll: data.rolls > 0 ? data.weight / data.rolls : 0,
        utilization: (data.weight / metrics.totalWeight) * 100,
        color: COLOR_PALETTES.gradient[index % COLOR_PALETTES.gradient.length]
      }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 10);
  }, [allData, metrics.totalWeight]);

  const monthlyTrend = useMemo(() => {
    const monthlyMap = new Map();
    allData.forEach(item => {
      const date = item['Rect Date'];
      if (date) {
        const month = new Date(date).toLocaleString('default', { month: 'short' });
        const weight = parseFloat(item['Bal WT']) || 0;
        const rolls = parseFloat(item['Bal Pkgs']) || 0;
        const mrn = parseFloat(item['MRN WT']) || 0;
        
        const existing = monthlyMap.get(month) || { weight: 0, rolls: 0, mrn: 0 };
        monthlyMap.set(month, {
          weight: existing.weight + weight,
          rolls: existing.rolls + rolls,
          mrn: existing.mrn + mrn
        });
      }
    });
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.map(month => {
      const data = monthlyMap.get(month) || { weight: 0, rolls: 0, mrn: 0 };
      return {
        month,
        weight: data.weight,
        rolls: data.rolls,
        mrn: data.mrn,
        utilization: data.mrn > 0 ? ((data.mrn - data.weight) / data.mrn * 100).toFixed(1) : 0
      };
    });
  }, [allData]);

  const supplierAnalysis = useMemo(() => {
    const supplierMap = new Map();
    allData.forEach(item => {
      const supplier = item['Party'];
      const weight = parseFloat(item['Bal WT']) || 0;
      const rolls = parseFloat(item['Bal Pkgs']) || 0;
      const mrn = parseFloat(item['MRN WT']) || 0;
      
      if (supplier && supplier !== '') {
        const existing = supplierMap.get(supplier) || { weight: 0, rolls: 0, mrn: 0, count: 0 };
        supplierMap.set(supplier, {
          weight: existing.weight + weight,
          rolls: existing.rolls + rolls,
          mrn: existing.mrn + mrn,
          count: existing.count + 1
        });
      }
    });
    return Array.from(supplierMap.entries())
      .map(([name, data], index) => ({ 
        name: name.length > 15 ? name.substring(0, 15) + '...' : name,
        fullName: name,
        weight: data.weight,
        rolls: data.rolls,
        mrn: data.mrn,
        count: data.count,
        utilization: data.mrn > 0 ? ((data.mrn - data.weight) / data.mrn * 100).toFixed(1) : 0,
        avgRollWeight: data.rolls > 0 ? data.weight / data.rolls : 0,
        color: COLOR_PALETTES.sunset[index % COLOR_PALETTES.sunset.length]
      }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 8);
  }, [allData]);

  const shadeDistribution = useMemo(() => {
    const shadeMap = new Map();
    allData.forEach(item => {
      const shade = item['Shade'];
      const weight = parseFloat(item['Bal WT']) || 0;
      if (shade && shade !== '' && shade !== '-') {
        shadeMap.set(shade, (shadeMap.get(shade) || 0) + weight);
      }
    });
    return Array.from(shadeMap.entries())
      .map(([name, value], index) => ({ 
        name: name.length > 12 ? name.substring(0, 12) + '...' : name, 
        value,
        color: COLOR_PALETTES.ocean[index % COLOR_PALETTES.ocean.length]
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [allData]);
const handleGoBack = () => {
  window.history.back();
};
  const statusDistribution = useMemo(() => {
    const statusMap = new Map();
    allData.forEach(item => {
      const status = item['Status'] || 'unknown';
      statusMap.set(status, (statusMap.get(status) || 0) + 1);
    });
    const statusColors = {
      'in_stock': COLOR_PALETTES.forest[0],
      'issued': COLOR_PALETTES.sunset[1],
      'partially_issued': COLOR_PALETTES.vibrant[2],
      'unknown': COLOR_PALETTES.gradient[3]
    };
    return Array.from(statusMap.entries()).map(([name, value]) => ({ 
      name: name === 'in_stock' ? 'In Stock' : name === 'issued' ? 'Issued' : name === 'partially_issued' ? 'Partially Issued' : name,
      value,
      color: statusColors[name] || COLOR_PALETTES.vibrant[0]
    }));
  }, [allData]);

  const weightVsRolls = useMemo(() => {
    return allData.slice(0, 200).map((item, index) => ({
      weight: parseFloat(item['Bal WT']) || 0,
      rolls: parseFloat(item['Bal Pkgs']) || 0,
      fabric: (item['Item Description'] || 'Unknown').substring(0, 15),
      color: COLOR_PALETTES.vibrant[index % COLOR_PALETTES.vibrant.length]
    }));
  }, [allData]);

  const healthRadar = useMemo(() => {
    return [
      { metric: 'Stock Level', value: metrics.stockHealthScore, fullMark: 100, color: COLOR_PALETTES.vibrant[0] },
      { metric: 'Utilization', value: parseFloat(metrics.utilizationRate), fullMark: 100, color: COLOR_PALETTES.vibrant[1] },
      { metric: 'Return Rate', value: 100 - parseFloat(metrics.returnRate), fullMark: 100, color: COLOR_PALETTES.vibrant[2] },
      { metric: 'Fabric Diversity', value: Math.min((metrics.uniqueFabrics / 50) * 100, 100), fullMark: 100, color: COLOR_PALETTES.vibrant[3] },
      { metric: 'Supplier Diversity', value: Math.min((metrics.uniqueParties / 20) * 100, 100), fullMark: 100, color: COLOR_PALETTES.vibrant[4] },
      { metric: 'Shade Variety', value: Math.min((metrics.uniqueShades / 30) * 100, 100), fullMark: 100, color: COLOR_PALETTES.vibrant[5] }
    ];
  }, [metrics]);

  const categoryPerformance = useMemo(() => {
    const fabricMap = new Map();
    categorySummary.forEach((item, index) => {
      if (item.fabricName) {
        const utilization = item.totalWeight > 0 ? (item.issuedWeight / item.totalWeight) * 100 : 0;
        fabricMap.set(item.fabricName, {
          name: item.fabricName,
          totalWeight: item.totalWeight,
          availableWeight: item.availableWeight,
          issuedWeight: item.issuedWeight,
          utilization: utilization,
          turnover: item.totalWeight > 0 ? item.issuedWeight / item.totalWeight : 0,
          color: COLOR_PALETTES.gradient[index % COLOR_PALETTES.gradient.length]
        });
      }
    });
    return Array.from(fabricMap.values())
      .sort((a, b) => b.availableWeight - a.availableWeight)
      .slice(0, 12);
  }, [categorySummary]);

  const weeklyMovement = useMemo(() => {
    const weekMap = new Map();
    allData.forEach(item => {
      const date = item['Rect Date'];
      if (date) {
        const weekNum = Math.floor(new Date(date).getTime() / (1000 * 60 * 60 * 24 * 7));
        const weekLabel = `Week ${(weekNum % 52) + 1}`;
        const weight = parseFloat(item['Bal WT']) || 0;
        const mrn = parseFloat(item['MRN WT']) || 0;
        
        const existing = weekMap.get(weekLabel) || { weight: 0, mrn: 0 };
        weekMap.set(weekLabel, {
          weight: existing.weight + weight,
          mrn: existing.mrn + mrn
        });
      }
    });
    return Array.from(weekMap.entries())
      .sort((a, b) => {
        const numA = parseInt(a[0].split(' ')[1]);
        const numB = parseInt(b[0].split(' ')[1]);
        return numA - numB;
      })
      .slice(-8)
      .map(([week, data]) => ({
        week,
        stock: data.weight,
        received: data.mrn,
        utilization: data.mrn > 0 ? ((data.mrn - data.weight) / data.mrn * 100).toFixed(1) : 0
      }));
  }, [allData]);

  const lotAnalysis = useMemo(() => {
    const lotMap = new Map();
    allData.forEach(item => {
      const lot = item['Lot No'];
      const weight = parseFloat(item['Bal WT']) || 0;
      const rolls = parseFloat(item['Bal Pkgs']) || 0;
      if (lot && lot !== '') {
        const existing = lotMap.get(lot) || { weight: 0, rolls: 0 };
        lotMap.set(lot, {
          weight: existing.weight + weight,
          rolls: existing.rolls + rolls
        });
      }
    });
    return Array.from(lotMap.entries())
      .map(([name, data], index) => ({ 
        name, 
        weight: data.weight, 
        rolls: data.rolls,
        color: COLOR_PALETTES.ocean[index % COLOR_PALETTES.ocean.length]
      }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 8);
  }, [allData]);

  const stockConcentration = useMemo(() => {
    const total = metrics.totalWeight;
    const top5Weight = topFabrics.slice(0, 5).reduce((sum, f) => sum + f.weight, 0);
    const top10Weight = topFabrics.slice(0, 10).reduce((sum, f) => sum + f.weight, 0);
    const othersWeight = total - top10Weight;
    
    return [
      { name: 'Top 5 Fabrics', value: (top5Weight / total) * 100, color: COLOR_PALETTES.vibrant[0] },
      { name: 'Top 6-10 Fabrics', value: ((top10Weight - top5Weight) / total) * 100, color: COLOR_PALETTES.vibrant[1] },
      { name: 'Others', value: (othersWeight / total) * 100, color: COLOR_PALETTES.vibrant[2] }
    ];
  }, [topFabrics, metrics.totalWeight]);

  const returnAnalysis = useMemo(() => {
    const returnMap = new Map();
    allData.forEach(item => {
      const party = item['Party'];
      const returned = parseFloat(item['Total Returned']) || 0;
      if (party && party !== '' && returned > 0) {
        returnMap.set(party, (returnMap.get(party) || 0) + returned);
      }
    });
    return Array.from(returnMap.entries())
      .map(([name, value], index) => ({ 
        name: name.substring(0, 15), 
        value,
        color: COLOR_PALETTES.sunset[index % COLOR_PALETTES.sunset.length]
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [allData]);

  const batchAnalysis = useMemo(() => {
    const batchMap = new Map();
    allData.forEach(item => {
      const batch = item['Batch Status'] || 'Unknown';
      batchMap.set(batch, (batchMap.get(batch) || 0) + 1);
    });
    const batchColors = {
      'Completed': COLOR_PALETTES.forest[0],
      'Pending': COLOR_PALETTES.sunset[1],
      'In Progress': COLOR_PALETTES.ocean[2],
      'Unknown': COLOR_PALETTES.gradient[3]
    };
    return Array.from(batchMap.entries()).map(([name, value], index) => ({ 
      name, 
      value,
      color: batchColors[name] || COLOR_PALETTES.vibrant[index % COLOR_PALETTES.vibrant.length]
    }));
  }, [allData]);

  const storeDistribution = useMemo(() => {
    const storeMap = new Map();
    allData.forEach(item => {
      const store = item['Store'];
      const weight = parseFloat(item['Bal WT']) || 0;
      if (store && store !== '') {
        storeMap.set(store, (storeMap.get(store) || 0) + weight);
      }
    });
    return Array.from(storeMap.entries())
      .map(([name, value], index) => ({ 
        name, 
        value,
        color: COLOR_PALETTES.gradient[index % COLOR_PALETTES.gradient.length]
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [allData]);

  // Mini bar chart data (top 5 fabrics by rolls)
  const miniBarData = useMemo(() => {
    return topFabrics.slice(0, 5).map((fabric, index) => ({
      name: fabric.name.substring(0, 10),
      rolls: fabric.rolls,
      weight: fabric.weight,
      color: COLOR_PALETTES.vibrant[index % COLOR_PALETTES.vibrant.length]
    }));
  }, [topFabrics]);

  // Progress bar data
  const progressData = useMemo(() => {
    return {
      utilization: parseFloat(metrics.utilizationRate),
      stockHealth: parseFloat(metrics.stockHealthScore),
      returnRate: parseFloat(metrics.returnRate),
      fillRate: Math.min((metrics.totalIssuedWeight / metrics.totalMrnWeight) * 100, 100)
    };
  }, [metrics]);

  // Gauge chart data (for stock health)
  const gaugeData = useMemo(() => {
    return [
      { name: 'Stock Health', value: parseFloat(metrics.stockHealthScore), fill: 'url(#gaugeGradient_stockflow)' }
    ];
  }, [metrics]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="stockflow_custom-tooltip">
          <p className="stockflow_tooltip-label">{label}</p>
          <p className="stockflow_tooltip-value">{payload[0].value.toFixed(1)} KG</p>
        </div>
      );
    }
    return null;
  };

  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pageNumbers.push(i);
        pageNumbers.push('...');
        pageNumbers.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pageNumbers.push(1);
        pageNumbers.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pageNumbers.push(i);
      } else {
        pageNumbers.push(1);
        pageNumbers.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pageNumbers.push(i);
        pageNumbers.push('...');
        pageNumbers.push(totalPages);
      }
    }
    return pageNumbers;
  };

  const handlePageChange = (page) => {
    if (page === '...') return;
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading && allData.length === 0) {
    return (
      <div className="stockflow_app-wrapper">
        <div className="stockflow_splash-screen">
          <div className="stockflow_splash-content">
            <div className="stockflow_splash-logo">📊</div>
            <div className="stockflow_splash-spinner"></div>
            <h2 className="stockflow_splash-title">StockFlow Analytics</h2>
            <p className="stockflow_splash-subtitle">Loading comprehensive inventory data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="stockflow_app-wrapper">
      <div className="stockflow_app-main">
        {/* Navigation Sidebar */}
        <aside className="stockflow_sidebar">
          <div className="stockflow_sidebar-header">
            <div className="stockflow_logo">
              <div className="stockflow_logo-icon">📊</div>
              <div className="stockflow_logo-text">
                <h1>StockFlow</h1>
                <p>Advanced Analytics</p>
              </div>
            </div>
          </div>

          <nav className="stockflow_sidebar-nav">
            <button className={`stockflow_nav-item ${activeDashboard === 'overview' ? 'stockflow_active' : ''}`} onClick={() => setActiveDashboard('overview')}>
              <span className="stockflow_nav-icon">📈</span>
              <span>Overview</span>
            </button>
            <button className={`stockflow_nav-item ${activeDashboard === 'inventory' ? 'stockflow_active' : ''}`} onClick={() => setActiveDashboard('inventory')}>
              <span className="stockflow_nav-icon">📋</span>
              <span>Inventory</span>
            </button>
            <button className={`stockflow_nav-item ${activeDashboard === 'analytics' ? 'stockflow_active' : ''}`} onClick={() => setActiveDashboard('analytics')}>
              <span className="stockflow_nav-icon">🎯</span>
              <span>Deep Analytics</span>
            </button>
            <button className={`stockflow_nav-item ${activeDashboard === 'suppliers' ? 'stockflow_active' : ''}`} onClick={() => setActiveDashboard('suppliers')}>
              <span className="stockflow_nav-icon">🏭</span>
              <span>Supplier Insights</span>
            </button>
            <button className={`stockflow_nav-item ${activeDashboard === 'performance' ? 'stockflow_active' : ''}`} onClick={() => setActiveDashboard('performance')}>
              <span className="stockflow_nav-icon">⚡</span>
              <span>Performance</span>
            </button>
          </nav>

          <div className="stockflow_sidebar-footer">
            <div className="stockflow_update-status">
              <span className="stockflow_status-dot"></span>
              <span className="stockflow_status-text">Live Updates</span>
            </div>
            <p className="stockflow_update-time">Updated: {lastUpdated || '--:--'}</p>
            <div className="stockflow_health-score">
              <span>Health Score</span>
              <span className="stockflow_score-value">{metrics.stockHealthScore}%</span>
            </div>
            <div className="stockflow_stats-summary">
              <div className="stockflow_summary-item"><span>Total Records:</span><strong>{allData.length}</strong></div>
              <div className="stockflow_summary-item"><span>Columns:</span><strong>22</strong></div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="stockflow_main-content">
      <header className="stockflow_content-header">
  <div className="stockflow_header-left">
    <button onClick={handleGoBack} className="stockflow_back-btn" style={{ 
      background: 'none', 
      border: 'none', 
      cursor: 'pointer', 
      fontSize: '14px',
      marginRight: '15px',
      padding: '8px 12px',
      borderRadius: '8px',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      backgroundColor: '#f0f0f0',
      transition: 'all 0.3s ease'
    }}>
      ← Back
    </button>
    <div>
      <h2 className="stockflow_page-title">
        {activeDashboard === 'overview' && 'Executive Dashboard'}
        {activeDashboard === 'inventory' && 'Inventory Management'}
        {activeDashboard === 'analytics' && 'Deep Analytics Center'}
        {activeDashboard === 'suppliers' && 'Supplier Intelligence'}
        {activeDashboard === 'performance' && 'Performance Metrics'}
      </h2>
      <p className="stockflow_page-subtitle">Complete 22-column inventory data with 20+ advanced visualizations</p>
    </div>
  </div>
  <div className="stockflow_header-right">
    <div className="stockflow_search-box">
      <span className="stockflow_search-icon">🔍</span>
      <input type="text" placeholder="Search by barcode, fabric, shade, party..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="stockflow_search-input" />
    </div>
    <button onClick={handleRefresh} className="stockflow_refresh-btn">⟳</button>
  </div>
</header>
          {/* Overview Dashboard */}
          {activeDashboard === 'overview' && (
            <>
              {/* KPI Cards Row */}
              <div className="stockflow_stats-grid">
                <div className="stockflow_stat-card" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                  <div className="stockflow_stat-icon-wrapper"><span className="stockflow_stat-icon">⚖️</span></div>
                  <div className="stockflow_stat-content">
                    <h3 className="stockflow_stat-value" style={{ color: 'white' }}>{metrics.totalWeight}</h3>
                    <p className="stockflow_stat-label" style={{ color: 'rgba(255,255,255,0.9)' }}>Total Stock (KG)</p>
                  </div>
                </div>
                <div className="stockflow_stat-card" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
                  <div className="stockflow_stat-icon-wrapper"><span className="stockflow_stat-icon">📦</span></div>
                  <div className="stockflow_stat-content">
                    <h3 className="stockflow_stat-value" style={{ color: 'white' }}>{metrics.totalRolls}</h3>
                    <p className="stockflow_stat-label" style={{ color: 'rgba(255,255,255,0.9)' }}>Total Rolls</p>
                  </div>
                </div>
                <div className="stockflow_stat-card" style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white' }}>
                  <div className="stockflow_stat-icon-wrapper"><span className="stockflow_stat-icon">🧵</span></div>
                  <div className="stockflow_stat-content">
                    <h3 className="stockflow_stat-value" style={{ color: 'white' }}>{metrics.uniqueFabrics}</h3>
                    <p className="stockflow_stat-label" style={{ color: 'rgba(255,255,255,0.9)' }}>Fabric Types</p>
                  </div>
                </div>
                <div className="stockflow_stat-card" style={{ background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', color: 'white' }}>
                  <div className="stockflow_stat-icon-wrapper"><span className="stockflow_stat-icon">🏭</span></div>
                  <div className="stockflow_stat-content">
                    <h3 className="stockflow_stat-value" style={{ color: 'white' }}>{metrics.uniqueParties}</h3>
                    <p className="stockflow_stat-label" style={{ color: 'rgba(255,255,255,0.9)' }}>Suppliers</p>
                  </div>
                </div>
                <div className="stockflow_stat-card" style={{ background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', color: 'white' }}>
                  <div className="stockflow_stat-icon-wrapper"><span className="stockflow_stat-icon">🎨</span></div>
                  <div className="stockflow_stat-content">
                    <h3 className="stockflow_stat-value" style={{ color: 'white' }}>{metrics.uniqueShades}</h3>
                    <p className="stockflow_stat-label" style={{ color: 'rgba(255,255,255,0.9)' }}>Shades</p>
                  </div>
                </div>
                <div className="stockflow_stat-card" style={{ background: 'linear-gradient(135deg, #FF512F 0%, #DD2476 100%)', color: 'white' }}>
                  <div className="stockflow_stat-icon-wrapper"><span className="stockflow_stat-icon">📊</span></div>
                  <div className="stockflow_stat-content">
                    <h3 className="stockflow_stat-value" style={{ color: 'white' }}>{metrics.utilizationRate}%</h3>
                    <p className="stockflow_stat-label" style={{ color: 'rgba(255,255,255,0.9)' }}>Utilization</p>
                  </div>
                </div>
              </div>

              {/* Progress Bar Section */}
              <div className="stockflow_progress-section">
                <h3 className="stockflow_section-title">📊 Key Performance Indicators</h3>
                <div className="stockflow_progress-grid">
                  <div className="stockflow_progress-card">
                    <div className="stockflow_progress-label">Material Utilization</div>
                    <div className="stockflow_progress-bar-container">
                      <div className="stockflow_progress-bar-fill" style={{ width: `${progressData.utilization}%`, background: 'linear-gradient(90deg, #667eea, #764ba2)' }}>
                        <span className="stockflow_progress-value">{progressData.utilization.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="stockflow_progress-card">
                    <div className="stockflow_progress-label">Stock Health Score</div>
                    <div className="stockflow_progress-bar-container">
                      <div className="stockflow_progress-bar-fill" style={{ width: `${progressData.stockHealth}%`, background: 'linear-gradient(90deg, #43e97b, #38f9d7)' }}>
                        <span className="stockflow_progress-value">{progressData.stockHealth.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="stockflow_progress-card">
                    <div className="stockflow_progress-label">Return Rate</div>
                    <div className="stockflow_progress-bar-container">
                      <div className="stockflow_progress-bar-fill" style={{ width: `${progressData.returnRate}%`, background: 'linear-gradient(90deg, #fa709a, #fee140)' }}>
                        <span className="stockflow_progress-value">{progressData.returnRate.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="stockflow_progress-card">
                    <div className="stockflow_progress-label">Fill Rate</div>
                    <div className="stockflow_progress-bar-container">
                      <div className="stockflow_progress-bar-fill" style={{ width: `${progressData.fillRate}%`, background: 'linear-gradient(90deg, #4facfe, #00f2fe)' }}>
                        <span className="stockflow_progress-value">{progressData.fillRate.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Gauge Chart & Range Slider Section */}
              <div className="stockflow_charts-row">
                <div className="stockflow_chart-container-wrapper">
                  <div className="stockflow_chart-header">
                    <h3 className="stockflow_chart-title">📊 Stock Health Gauge</h3>
                    <p className="stockflow_chart-subtitle">Overall inventory health indicator</p>
                  </div>
                  <div className="stockflow_chart-content">
                    <ResponsiveContainer width="100%" height={280}>
                      <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="100%" barSize={20} data={gaugeData} startAngle={180} endAngle={0}>
                        <defs>
                          <linearGradient id="gaugeGradient_stockflow" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#FF512F" />
                            <stop offset="50%" stopColor="#F9D423" />
                            <stop offset="100%" stopColor="#43e97b" />
                          </linearGradient>
                        </defs>
                        <RadialBar minAngle={15} background clockWise={true} dataKey="value" cornerRadius={10} fill="url(#gaugeGradient_stockflow)" />
                        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="stockflow_gauge-label">
                          <tspan x="50%" dy="-10" fontSize="32" fontWeight="bold" fill="url(#gaugeGradient_stockflow)">{gaugeData[0]?.value}%</tspan>
                          <tspan x="50%" dy="25" fontSize="12" fill="#64748b">Health Score</tspan>
                        </text>
                        <Tooltip />
                      </RadialBarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="stockflow_chart-container-wrapper">
                  <div className="stockflow_chart-header">
                    <h3 className="stockflow_chart-title">🎛️ Stock Range Filter</h3>
                    <p className="stockflow_chart-subtitle">Filter by stock level threshold</p>
                  </div>
                  <div className="stockflow_range-slider-container">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={rangeValue}
                      onChange={(e) => setRangeValue(parseInt(e.target.value))}
                      className="stockflow_range-slider"
                      style={{ background: `linear-gradient(90deg, #667eea ${rangeValue}%, #e2e8f0 ${rangeValue}%)` }}
                    />
                    <div className="stockflow_range-values">
                      <span>Min Stock: 0</span>
                      <span className="stockflow_range-current">Threshold: {rangeValue} rolls</span>
                      <span>Max: 100+</span>
                    </div>
                    <p className="stockflow_range-info">
                      Items below {rangeValue} rolls: {
                        allData.filter(item => parseFloat(item['Bal Pkgs']) < rangeValue && parseFloat(item['Bal Pkgs']) > 0).length
                      } items
                    </p>
                  </div>
                </div>
              </div>

              {/* Donut Chart (Pie with innerRadius) */}
              <div className="stockflow_charts-row">
                <div className="stockflow_chart-container-wrapper">
                  <div className="stockflow_chart-header">
                    <h3 className="stockflow_chart-title">🍩 Stock Level Distribution (Donut)</h3>
                    <p className="stockflow_chart-subtitle">Inventory health breakdown</p>
                  </div>
                  <div className="stockflow_chart-content">
                    <ResponsiveContainer width="100%" height={320}>
                      <PieChart>
                        <Pie 
                          data={stockDistribution} 
                          cx="50%" 
                          cy="50%" 
                          innerRadius={70} 
                          outerRadius={110} 
                          paddingAngle={3} 
                          dataKey="value" 
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {stockDistribution.map((entry, index) => (
                            <Cell key={index} fill={entry.color} stroke="#fff" strokeWidth={2} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="stockflow_chart-container-wrapper">
                  <div className="stockflow_chart-header">
                    <h3 className="stockflow_chart-title">📊 Top 10 Fabrics by Stock (Horizontal Bar)</h3>
                    <p className="stockflow_chart-subtitle">Highest inventory value</p>
                  </div>
                  <div className="stockflow_chart-content">
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={topFabrics} layout="vertical" margin={{ left: 120 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" width={110} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Bar dataKey="weight" radius={[0, 8, 8, 0]}>
                          {topFabrics.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Area Chart & Multi-Line Chart */}
              <div className="stockflow_charts-row">
                <div className="stockflow_chart-container-wrapper">
                  <div className="stockflow_chart-header">
                    <h3 className="stockflow_chart-title">📈 Monthly Stock Trend (Area Chart)</h3>
                    <p className="stockflow_chart-subtitle">12-month inventory movement</p>
                  </div>
                  <div className="stockflow_chart-content">
                    <ResponsiveContainer width="100%" height={320}>
                      <AreaChart data={monthlyTrend}>
                        <defs>
                          <linearGradient id="areaGradient_stockflow" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#667eea" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#764ba2" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Area type="monotone" dataKey="weight" stroke="#667eea" strokeWidth={3} fill="url(#areaGradient_stockflow)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="stockflow_chart-container-wrapper">
                  <div className="stockflow_chart-header">
                    <h3 className="stockflow_chart-title">📈 Monthly Trend: Stock vs Received (Multi-Line)</h3>
                    <p className="stockflow_chart-subtitle">Comparison of stock and received goods</p>
                  </div>
                  <div className="stockflow_chart-content">
                    <ResponsiveContainer width="100%" height={320}>
                      <LineChart data={monthlyTrend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="weight" stroke="#667eea" strokeWidth={3} name="Current Stock" dot={{ r: 4, fill: "#667eea" }} />
                        <Line type="monotone" dataKey="mrn" stroke="#43e97b" strokeWidth={3} name="Received Goods" dot={{ r: 4, fill: "#43e97b" }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Mini Bar Chart & Calendar Widget */}
              <div className="stockflow_charts-row">
                <div className="stockflow_chart-container-wrapper">
                  <div className="stockflow_chart-header">
                    <h3 className="stockflow_chart-title">📊 Top 5 Fabrics by Rolls (Mini Bar)</h3>
                    <p className="stockflow_chart-subtitle">Quick view of highest inventory fabrics</p>
                  </div>
                  <div className="stockflow_mini-bar-container">
                    {miniBarData.map((item, idx) => (
                      <div key={idx} className="stockflow_mini-bar-item">
                        <div className="stockflow_mini-bar-label">{item.name}</div>
                        <div className="stockflow_mini-bar-wrapper">
                          <div 
                            className="stockflow_mini-bar-fill" 
                            style={{ 
                              width: `${(item.rolls / Math.max(...miniBarData.map(d => d.rolls))) * 100}%`,
                              background: `linear-gradient(90deg, ${item.color}, ${item.color}88)`
                            }}
                          >
                            <span className="stockflow_mini-bar-value">{item.rolls}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="stockflow_chart-container-wrapper">
                  <div className="stockflow_chart-header">
                    <h3 className="stockflow_chart-title">📅 Calendar Widget</h3>
                    <p className="stockflow_chart-subtitle">Select date for filtered view</p>
                  </div>
                  <div className="stockflow_calendar-widget">
                    <div className="stockflow_calendar-header">
                      <button className="stockflow_calendar-nav" onClick={() => {
                        const newDate = new Date(selectedDate);
                        newDate.setMonth(newDate.getMonth() - 1);
                        setSelectedDate(newDate.toISOString().split('T')[0]);
                      }}>‹</button>
                      <span className="stockflow_calendar-month">
                        {new Date(selectedDate).toLocaleString('default', { month: 'long', year: 'numeric' })}
                      </span>
                      <button className="stockflow_calendar-nav" onClick={() => {
                        const newDate = new Date(selectedDate);
                        newDate.setMonth(newDate.getMonth() + 1);
                        setSelectedDate(newDate.toISOString().split('T')[0]);
                      }}>›</button>
                    </div>
                    <div className="stockflow_calendar-weekdays">
                      {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                        <div key={day} className="stockflow_calendar-weekday">{day}</div>
                      ))}
                    </div>
                    <div className="stockflow_calendar-days">
                      {Array.from({ length: 35 }, (_, i) => {
                        const date = new Date(selectedDate);
                        date.setDate(1);
                        const firstDay = date.getDay();
                        const dayNumber = i - firstDay + 1;
                        const isValid = dayNumber > 0 && dayNumber <= new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
                        const isToday = isValid && dayNumber === new Date().getDate() && date.getMonth() === new Date().getMonth();
                        return (
                          <div 
                            key={i} 
                            className={`stockflow_calendar-day ${!isValid ? 'stockflow_invalid' : ''} ${isToday ? 'stockflow_today' : ''}`}
                            onClick={() => isValid && setSelectedDate(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`)}
                          >
                            {isValid ? dayNumber : ''}
                          </div>
                        );
                      })}
                    </div>
                    <div className="stockflow_calendar-note">
                      Selected: {selectedDate}
                    </div>
                  </div>
                </div>
              </div>

              {/* Rounded Bar Chart & Column Chart */}
              <div className="stockflow_charts-row">
                <div className="stockflow_chart-container-wrapper">
                  <div className="stockflow_chart-header">
                    <h3 className="stockflow_chart-title">📊 Status Distribution (Rounded Bar)</h3>
                    <p className="stockflow_chart-subtitle">In Stock vs Issued vs Partially Issued</p>
                  </div>
                  <div className="stockflow_chart-content">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={statusDistribution} barSize={60}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                          {statusDistribution.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="stockflow_chart-container-wrapper">
                  <div className="stockflow_chart-header">
                    <h3 className="stockflow_chart-title">📊 Stock Concentration (Column Chart)</h3>
                    <p className="stockflow_chart-subtitle">80/20 Pareto distribution</p>
                  </div>
                  <div className="stockflow_chart-content">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={stockConcentration}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-15} textAnchor="end" height={60} />
                        <YAxis label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft' }} />
                        <Tooltip formatter={(value) => `${value.toFixed(1)}%`} />
                        <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                          {stockConcentration.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Status Cards */}
              <div className="stockflow_status-cards-grid">
                <div className="stockflow_status-card" style={{ borderLeft: `4px solid ${COLOR_PALETTES.vibrant[0]}` }}>
                  <div className="stockflow_status-card-icon">📦</div>
                  <div className="stockflow_status-card-content">
                    <h4>Total Inventory</h4>
                    <p className="stockflow_status-card-value">{metrics.totalRolls} Rolls</p>
                    <span className="stockflow_status-card-badge stockflow_success">{metrics.totalWeight} KG</span>
                  </div>
                </div>
                <div className="stockflow_status-card" style={{ borderLeft: `4px solid ${COLOR_PALETTES.sunset[0]}` }}>
                  <div className="stockflow_status-card-icon">⚠️</div>
                  <div className="stockflow_status-card-content">
                    <h4>Critical Stock</h4>
                    <p className="stockflow_status-card-value">{metrics.criticalStock} Items</p>
                    <span className="stockflow_status-card-badge stockflow_critical">Zero Rolls</span>
                  </div>
                </div>
                <div className="stockflow_status-card" style={{ borderLeft: `4px solid ${COLOR_PALETTES.ocean[2]}` }}>
                  <div className="stockflow_status-card-icon">📤</div>
                  <div className="stockflow_status-card-content">
                    <h4>Issued Items</h4>
                    <p className="stockflow_status-card-value">{metrics.totalIssuedPkgs.toFixed(0)} Rolls</p>
                    <span className="stockflow_status-card-badge stockflow_info">{metrics.totalIssuedWeight} KG</span>
                  </div>
                </div>
                <div className="stockflow_status-card" style={{ borderLeft: `4px solid ${COLOR_PALETTES.gradient[1]}` }}>
                  <div className="stockflow_status-card-icon">🔄</div>
                  <div className="stockflow_status-card-content">
                    <h4>Return Rate</h4>
                    <p className="stockflow_status-card-value">{metrics.returnRate}%</p>
                    <span className="stockflow_status-card-badge stockflow_warning">{metrics.totalReturnedWeight} KG Returned</span>
                  </div>
                </div>
              </div>

              <div className="stockflow_info-card">
                <h3 className="stockflow_info-title">📋 Complete Data Structure - 22 Columns</h3>
                <p className="stockflow_info-text">Your inventory data contains all the following columns for comprehensive tracking</p>
                <div className="stockflow_column-tags">
                  <span className="stockflow_column-tag">Timestamp</span>
                  <span className="stockflow_column-tag">Barcode ID</span>
                  <span className="stockflow_column-tag">Item Description</span>
                  <span className="stockflow_column-tag">Unit</span>
                  <span className="stockflow_column-tag">Shade</span>
                  <span className="stockflow_column-tag">Lot No</span>
                  <span className="stockflow_column-tag">Rect Date</span>
                  <span className="stockflow_column-tag">Party</span>
                  <span className="stockflow_column-tag">Store</span>
                  <span className="stockflow_column-tag">Issue No</span>
                  <span className="stockflow_column-tag">Issue Date</span>
                  <span className="stockflow_column-tag">MRN Pkgs</span>
                  <span className="stockflow_column-tag">Issue Pkgs</span>
                  <span className="stockflow_column-tag">ADJ Pkgs</span>
                  <span className="stockflow_column-tag">Bal Pkgs</span>
                  <span className="stockflow_column-tag">MRN WT</span>
                  <span className="stockflow_column-tag">Bal WT</span>
                  <span className="stockflow_column-tag">Generated Time</span>
                  <span className="stockflow_column-tag">Batch Status</span>
                  <span className="stockflow_column-tag">Status</span>
                  <span className="stockflow_column-tag">Remarks</span>
                  <span className="stockflow_column-tag">Total Returned</span>
                </div>
              </div>
            </>
          )}

          {/* Deep Analytics Dashboard */}
          {activeDashboard === 'analytics' && (
            <>
              <div className="stockflow_charts-row">
                <div className="stockflow_chart-container-wrapper">
                  <div className="stockflow_chart-header">
                    <h3 className="stockflow_chart-title">🎨 Shade Distribution (Donut)</h3>
                    <p className="stockflow_chart-subtitle">Popular color variations by weight</p>
                  </div>
                  <div className="stockflow_chart-content">
                    <ResponsiveContainer width="100%" height={350}>
                      <PieChart>
                        <Pie 
                          data={shadeDistribution} 
                          cx="50%" 
                          cy="50%" 
                          innerRadius={60} 
                          outerRadius={110} 
                          dataKey="value" 
                          label={({ name }) => name.length > 8 ? name.substring(0, 8) + '...' : name}
                        >
                          {shadeDistribution.map((entry, index) => (
                            <Cell key={index} fill={entry.color} stroke="#fff" strokeWidth={2} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="stockflow_chart-container-wrapper">
                  <div className="stockflow_chart-header">
                    <h3 className="stockflow_chart-title">📐 Weight vs Rolls Correlation (Scatter)</h3>
                    <p className="stockflow_chart-subtitle">Scatter plot analysis - weight distribution</p>
                  </div>
                  <div className="stockflow_chart-content">
                    <ResponsiveContainer width="100%" height={350}>
                      <ScatterChart>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" dataKey="rolls" name="Rolls" unit=" rolls" />
                        <YAxis type="number" dataKey="weight" name="Weight" unit=" KG" />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                        <Scatter name="Items" data={weightVsRolls} fill="url(#scatterGradient_stockflow)" />
                        <defs>
                          <linearGradient id="scatterGradient_stockflow" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#667eea" />
                            <stop offset="100%" stopColor="#764ba2" />
                          </linearGradient>
                        </defs>
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="stockflow_charts-row">
                <div className="stockflow_chart-container-wrapper">
                  <div className="stockflow_chart-header">
                    <h3 className="stockflow_chart-title">📅 Weekly Stock Movement (Composed)</h3>
                    <p className="stockflow_chart-subtitle">8-week inventory flow with utilization overlay</p>
                  </div>
                  <div className="stockflow_chart-content">
                    <ResponsiveContainer width="100%" height={350}>
                      <ComposedChart data={weeklyMovement}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="week" angle={-45} textAnchor="end" height={60} />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" domain={[0, 100]} />
                        <Tooltip />
                        <Legend />
                        <Bar yAxisId="left" dataKey="stock" fill="url(#barGradient1_stockflow)" name="Current Stock (KG)" radius={[8, 8, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="utilization" stroke="#43e97b" name="Utilization %" strokeWidth={3} dot={{ r: 4, fill: "#43e97b" }} />
                        <defs>
                          <linearGradient id="barGradient1_stockflow" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#667eea" />
                            <stop offset="100%" stopColor="#764ba2" />
                          </linearGradient>
                        </defs>
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="stockflow_chart-container-wrapper">
                  <div className="stockflow_chart-header">
                    <h3 className="stockflow_chart-title">🏪 Store Distribution (Horizontal Bar)</h3>
                    <p className="stockflow_chart-subtitle">Stock by location</p>
                  </div>
                  <div className="stockflow_chart-content">
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={storeDistribution} layout="vertical" margin={{ left: 80 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="name" width={80} />
                        <Tooltip formatter={(value) => `${value.toFixed(1)} KG`} />
                        <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                          {storeDistribution.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="stockflow_charts-row">
                <div className="stockflow_chart-container-wrapper">
                  <div className="stockflow_chart-header">
                    <h3 className="stockflow_chart-title">🔢 Lot Analysis</h3>
                    <p className="stockflow_chart-subtitle">Top lots by inventory value</p>
                  </div>
                  <div className="stockflow_chart-content">
                    <ResponsiveContainer width="100%" height={350}>
                      <ComposedChart data={lotAnalysis}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip />
                        <Legend />
                        <Bar yAxisId="left" dataKey="weight" fill="url(#barGradient2_stockflow)" name="Weight (KG)" radius={[8, 8, 0, 0]}>
                          {lotAnalysis.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Bar>
                        <Line yAxisId="right" type="monotone" dataKey="rolls" stroke="#fa709a" name="Rolls" strokeWidth={3} dot={{ r: 3, fill: "#fa709a" }} />
                        <defs>
                          <linearGradient id="barGradient2_stockflow" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#4facfe" />
                            <stop offset="100%" stopColor="#00f2fe" />
                          </linearGradient>
                        </defs>
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="stockflow_chart-container-wrapper">
                  <div className="stockflow_chart-header">
                    <h3 className="stockflow_chart-title">🏷️ Batch Status Distribution (Donut)</h3>
                    <p className="stockflow_chart-subtitle">Batch-wise item count</p>
                  </div>
                  <div className="stockflow_chart-content">
                    <ResponsiveContainer width="100%" height={350}>
                      <PieChart>
                        <Pie 
                          data={batchAnalysis} 
                          cx="50%" 
                          cy="50%" 
                          innerRadius={60} 
                          outerRadius={100} 
                          dataKey="value" 
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {batchAnalysis.map((entry, index) => (
                            <Cell key={index} fill={entry.color} stroke="#fff" strokeWidth={2} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Inventory Health Radar */}
              <div className="stockflow_charts-row">
                <div className="stockflow_chart-container-wrapper stockflow_full-width">
                  <div className="stockflow_chart-header">
                    <h3 className="stockflow_chart-title">🎯 Inventory Health Radar</h3>
                    <p className="stockflow_chart-subtitle">6-dimensional performance analysis</p>
                  </div>
                  <div className="stockflow_chart-content">
                    <ResponsiveContainer width="100%" height={400}>
                      <RadarChart data={healthRadar}>
                        <PolarGrid stroke="#e2e8f0" />
                        <PolarAngleAxis dataKey="metric" tick={{ fill: '#475569', fontSize: 11 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} />
                        <Radar name="Performance" dataKey="value" stroke="#667eea" fill="#667eea" fillOpacity={0.6} />
                        <Tooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Supplier Insights Dashboard */}
          {activeDashboard === 'suppliers' && (
            <>
              <div className="stockflow_charts-row">
                <div className="stockflow_chart-container-wrapper stockflow_full-width">
                  <div className="stockflow_chart-header">
                    <h3 className="stockflow_chart-title">🏭 Supplier Stock Contribution (Composed)</h3>
                    <p className="stockflow_chart-subtitle">Comparative analysis by weight and utilization</p>
                  </div>
                  <div className="stockflow_chart-content">
                    <ResponsiveContainer width="100%" height={400}>
                      <ComposedChart data={supplierAnalysis}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" domain={[0, 100]} />
                        <Tooltip />
                        <Legend />
                        <Bar yAxisId="left" dataKey="weight" radius={[8, 8, 0, 0]}>
                          {supplierAnalysis.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Bar>
                        <Line yAxisId="right" type="monotone" dataKey="utilization" stroke="#43e97b" name="Utilization %" strokeWidth={3} dot={{ r: 4, fill: "#43e97b" }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="stockflow_charts-row">
                <div className="stockflow_chart-container-wrapper">
                  <div className="stockflow_chart-header">
                    <h3 className="stockflow_chart-title">🔄 Return Rate Analysis</h3>
                    <p className="stockflow_chart-subtitle">Top suppliers by returned weight</p>
                  </div>
                  <div className="stockflow_chart-content">
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={returnAnalysis} layout="vertical" margin={{ left: 80 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="name" width={100} />
                        <Tooltip formatter={(value) => `${value.toFixed(1)} KG`} />
                        <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                          {returnAnalysis.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="stockflow_chart-container-wrapper">
                  <div className="stockflow_chart-header">
                    <h3 className="stockflow_chart-title">📊 Supplier Performance Metrics</h3>
                    <p className="stockflow_chart-subtitle">Average roll weight by supplier</p>
                  </div>
                  <div className="stockflow_chart-content">
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={supplierAnalysis}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                        <YAxis />
                        <Tooltip formatter={(value) => `${value.toFixed(1)} KG`} />
                        <Bar dataKey="avgRollWeight" fill="url(#avgWeightGradient_stockflow)" name="Avg Roll Weight (KG)" radius={[8, 8, 0, 0]} />
                        <defs>
                          <linearGradient id="avgWeightGradient_stockflow" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#fa709a" />
                            <stop offset="100%" stopColor="#fee140" />
                          </linearGradient>
                        </defs>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="stockflow_suppliers-grid">
                {supplierAnalysis.slice(0, 6).map((supplier, idx) => (
                  <div key={idx} className="stockflow_supplier-card" style={{ borderLeft: `4px solid ${supplier.color}` }}>
                    <div className="stockflow_supplier-avatar" style={{ background: `linear-gradient(135deg, ${supplier.color}, ${supplier.color}88)` }}>{supplier.name.charAt(0).toUpperCase()}</div>
                    <div className="stockflow_supplier-info">
                      <h4 className="stockflow_supplier-name">{supplier.fullName}</h4>
                      <p className="stockflow_supplier-stats">{supplier.weight.toFixed(0)} KG | {supplier.rolls.toFixed(0)} rolls</p>
                      <div className="stockflow_supplier-progress">
                        <div className="stockflow_supplier-progress-bar" style={{ width: `${Math.min((supplier.weight / supplierAnalysis[0]?.weight) * 100, 100)}%`, background: supplier.color }}></div>
                      </div>
                      <div className="stockflow_supplier-details">
                        <span>Utilization: {supplier.utilization}%</span>
                        <span>Avg Roll: {supplier.avgRollWeight.toFixed(1)} KG</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Performance Dashboard */}
          {activeDashboard === 'performance' && (
            <>
              <div className="stockflow_charts-row">
                <div className="stockflow_chart-container-wrapper stockflow_full-width">
                  <div className="stockflow_chart-header">
                    <h3 className="stockflow_chart-title">📊 Category Performance Matrix</h3>
                    <p className="stockflow_chart-subtitle">Fabric-wise stock vs utilization analysis</p>
                  </div>
                  <div className="stockflow_table-responsive">
                    <table className="stockflow_analytics-table">
                      <thead>
                        <tr>
                          <th>Fabric Name</th>
                          <th>Total Weight (KG)</th>
                          <th>Available (KG)</th>
                          <th>Issued (KG)</th>
                          <th>Utilization %</th>
                          <th>Turnover Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categoryPerformance.map((item, idx) => (
                          <tr key={idx}>
                            <td className="stockflow_fabric-name-cell">{item.name}</td>
                            <td>{item.totalWeight.toFixed(1)}</td>
                            <td className="stockflow_available-cell">{item.availableWeight.toFixed(1)}</td>
                            <td>{item.issuedWeight.toFixed(1)}</td>
                            <td>
                              <div className="stockflow_progress-wrapper">
                                <div className="stockflow_progress-bar-custom">
                                  <div className="stockflow_progress-fill-custom" style={{ width: `${item.utilization}%`, background: item.color }}></div>
                                </div>
                                <span className="stockflow_progress-percent">{item.utilization.toFixed(1)}%</span>
                              </div>
                            </td>
                            <td>{item.turnover.toFixed(2)}x</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="stockflow_stats-grid">
                <div className="stockflow_stat-card" style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white' }}>
                  <div className="stockflow_stat-icon-wrapper"><span className="stockflow_stat-icon">⚡</span></div>
                  <div className="stockflow_stat-content">
                    <h3 className="stockflow_stat-value" style={{ color: 'white' }}>{metrics.utilizationRate}%</h3>
                    <p className="stockflow_stat-label" style={{ color: 'rgba(255,255,255,0.9)' }}>Material Utilization</p>
                  </div>
                </div>
                <div className="stockflow_stat-card" style={{ background: 'linear-gradient(135deg, #fa709a, #fee140)', color: 'white' }}>
                  <div className="stockflow_stat-icon-wrapper"><span className="stockflow_stat-icon">🔄</span></div>
                  <div className="stockflow_stat-content">
                    <h3 className="stockflow_stat-value" style={{ color: 'white' }}>{metrics.returnRate}%</h3>
                    <p className="stockflow_stat-label" style={{ color: 'rgba(255,255,255,0.9)' }}>Return Rate</p>
                  </div>
                </div>
                <div className="stockflow_stat-card" style={{ background: 'linear-gradient(135deg, #43e97b, #38f9d7)', color: 'white' }}>
                  <div className="stockflow_stat-icon-wrapper"><span className="stockflow_stat-icon">📊</span></div>
                  <div className="stockflow_stat-content">
                    <h3 className="stockflow_stat-value" style={{ color: 'white' }}>{metrics.stockHealthScore}%</h3>
                    <p className="stockflow_stat-label" style={{ color: 'rgba(255,255,255,0.9)' }}>Stock Health Score</p>
                  </div>
                </div>
                <div className="stockflow_stat-card" style={{ background: 'linear-gradient(135deg, #4facfe, #00f2fe)', color: 'white' }}>
                  <div className="stockflow_stat-icon-wrapper"><span className="stockflow_stat-icon">⚖️</span></div>
                  <div className="stockflow_stat-content">
                    <h3 className="stockflow_stat-value" style={{ color: 'white' }}>{metrics.weightPerRoll}</h3>
                    <p className="stockflow_stat-label" style={{ color: 'rgba(255,255,255,0.9)' }}>Avg Weight/Roll (KG)</p>
                  </div>
                </div>
              </div>

              <div className="stockflow_charts-row">
                <div className="stockflow_chart-container-wrapper stockflow_full-width">
                  <div className="stockflow_chart-header">
                    <h3 className="stockflow_chart-title">📈 Monthly Performance Breakdown (Composed)</h3>
                    <p className="stockflow_chart-subtitle">Weight, Rolls, and Utilization trends</p>
                  </div>
                  <div className="stockflow_chart-content">
                    <ResponsiveContainer width="100%" height={400}>
                      <ComposedChart data={monthlyTrend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" domain={[0, 100]} />
                        <Tooltip />
                        <Legend />
                        <Bar yAxisId="left" dataKey="weight" fill="url(#weightGradient_stockflow)" name="Stock Weight (KG)" radius={[8, 8, 0, 0]} />
                        <Bar yAxisId="left" dataKey="mrn" fill="url(#mrnGradient_stockflow)" name="Received Weight (KG)" radius={[8, 8, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="utilization" stroke="#43e97b" name="Utilization %" strokeWidth={3} dot={{ r: 4, fill: "#43e97b" }} />
                        <defs>
                          <linearGradient id="weightGradient_stockflow" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#667eea" />
                            <stop offset="100%" stopColor="#764ba2" />
                          </linearGradient>
                          <linearGradient id="mrnGradient_stockflow" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#4facfe" />
                            <stop offset="100%" stopColor="#00f2fe" />
                          </linearGradient>
                        </defs>
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="stockflow_charts-row">
                <div className="stockflow_chart-container-wrapper">
                  <div className="stockflow_chart-header">
                    <h3 className="stockflow_chart-title">📊 Stock Efficiency Metrics (Column)</h3>
                    <p className="stockflow_chart-subtitle">Rolls per fabric analysis</p>
                  </div>
                  <div className="stockflow_chart-content">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={topFabrics.slice(0, 6)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="rolls" fill="url(#rollsGradient_stockflow)" name="Number of Rolls" radius={[8, 8, 0, 0]} />
                        <defs>
                          <linearGradient id="rollsGradient_stockflow" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#f093fb" />
                            <stop offset="100%" stopColor="#f5576c" />
                          </linearGradient>
                        </defs>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="stockflow_chart-container-wrapper">
                  <div className="stockflow_chart-header">
                    <h3 className="stockflow_chart-title">⚖️ Average Roll Weight by Fabric</h3>
                    <p className="stockflow_chart-subtitle">Weight distribution analysis</p>
                  </div>
                  <div className="stockflow_chart-content">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={topFabrics.slice(0, 6)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                        <YAxis />
                        <Tooltip formatter={(value) => `${value.toFixed(1)} KG`} />
                        <Bar dataKey="avgWeightPerRoll" fill="url(#avgWeightGradient2_stockflow)" name="Avg Weight per Roll (KG)" radius={[8, 8, 0, 0]} />
                        <defs>
                          <linearGradient id="avgWeightGradient2_stockflow" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#FF512F" />
                            <stop offset="100%" stopColor="#DD2476" />
                          </linearGradient>
                        </defs>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* INVENTORY SECTION WITH ADVANCED FILTERS AND EXPORT */}
          {activeDashboard === 'inventory' && (
            <>
              {/* Export Buttons */}
              <div className="stockflow_export-buttons-container">
                <button onClick={exportToExcel} className="stockflow_export-btn stockflow_excel-btn">
                  📊 Export to Excel
                </button>
                <button onClick={exportToPDF} className="stockflow_export-btn stockflow_pdf-btn">
                  📄 Export to PDF
                </button>
                <button onClick={() => setShowFilters(!showFilters)} className="stockflow_export-btn stockflow_filter-toggle-btn">
                  🔍 {showFilters ? 'Hide Filters' : 'Show Filters'}
                </button>
              </div>

              {/* Advanced Filters Panel */}
              {showFilters && (
                <div className="stockflow_filters-panel">
                  <div className="stockflow_filters-header">
                    <h3>Advanced Filters</h3>
                    <button onClick={resetFilters} className="stockflow_reset-filters-btn">Reset All Filters</button>
                  </div>
                  <div className="stockflow_filters-grid">
                    <div className="stockflow_filter-group-item">
                      <label>Fabric Name</label>
                      <select value={inventoryFilters.fabric} onChange={(e) => handleFilterChange('fabric', e.target.value)}>
                        <option value="">All Fabrics</option>
                        {uniqueValues.fabrics.map(fabric => <option key={fabric} value={fabric}>{fabric}</option>)}
                      </select>
                    </div>
                    <div className="stockflow_filter-group-item">
                      <label>Shade</label>
                      <select value={inventoryFilters.shade} onChange={(e) => handleFilterChange('shade', e.target.value)}>
                        <option value="">All Shades</option>
                        {uniqueValues.shades.map(shade => <option key={shade} value={shade}>{shade}</option>)}
                      </select>
                    </div>
                    <div className="stockflow_filter-group-item">
                      <label>Supplier/Party</label>
                      <select value={inventoryFilters.party} onChange={(e) => handleFilterChange('party', e.target.value)}>
                        <option value="">All Parties</option>
                        {uniqueValues.parties.map(party => <option key={party} value={party}>{party}</option>)}
                      </select>
                    </div>
                    <div className="stockflow_filter-group-item">
                      <label>Lot Number</label>
                      <select value={inventoryFilters.lotNo} onChange={(e) => handleFilterChange('lotNo', e.target.value)}>
                        <option value="">All Lots</option>
                        {uniqueValues.lots.map(lot => <option key={lot} value={lot}>{lot}</option>)}
                      </select>
                    </div>
                    <div className="stockflow_filter-group-item">
                      <label>Store</label>
                      <select value={inventoryFilters.store} onChange={(e) => handleFilterChange('store', e.target.value)}>
                        <option value="">All Stores</option>
                        {uniqueValues.stores.map(store => <option key={store} value={store}>{store}</option>)}
                      </select>
                    </div>
                    <div className="stockflow_filter-group-item">
                      <label>Status</label>
                      <select value={inventoryFilters.status} onChange={(e) => handleFilterChange('status', e.target.value)}>
                        <option value="">All Status</option>
                        {uniqueValues.statuses.map(status => <option key={status} value={status}>{status}</option>)}
                      </select>
                    </div>
                    <div className="stockflow_filter-group-item">
                      <label>Batch Status</label>
                      <select value={inventoryFilters.batchStatus} onChange={(e) => handleFilterChange('batchStatus', e.target.value)}>
                        <option value="">All Batch Status</option>
                        {uniqueValues.batchStatuses.map(batch => <option key={batch} value={batch}>{batch}</option>)}
                      </select>
                    </div>
                    <div className="stockflow_filter-group-item">
                      <label>Min Rolls (Bal Pkgs)</label>
                      <input type="number" placeholder="Min" value={inventoryFilters.minRolls} onChange={(e) => handleFilterChange('minRolls', e.target.value)} />
                    </div>
                    <div className="stockflow_filter-group-item">
                      <label>Max Rolls (Bal Pkgs)</label>
                      <input type="number" placeholder="Max" value={inventoryFilters.maxRolls} onChange={(e) => handleFilterChange('maxRolls', e.target.value)} />
                    </div>
                    <div className="stockflow_filter-group-item">
                      <label>Min Weight (KG)</label>
                      <input type="number" placeholder="Min" value={inventoryFilters.minWeight} onChange={(e) => handleFilterChange('minWeight', e.target.value)} />
                    </div>
                    <div className="stockflow_filter-group-item">
                      <label>Max Weight (KG)</label>
                      <input type="number" placeholder="Max" value={inventoryFilters.maxWeight} onChange={(e) => handleFilterChange('maxWeight', e.target.value)} />
                    </div>
                    <div className="stockflow_filter-group-item">
                      <label>From Date</label>
                      <input type="date" value={inventoryFilters.fromDate} onChange={(e) => handleFilterChange('fromDate', e.target.value)} />
                    </div>
                    <div className="stockflow_filter-group-item">
                      <label>To Date</label>
                      <input type="date" value={inventoryFilters.toDate} onChange={(e) => handleFilterChange('toDate', e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              {/* Column Visibility Controls */}
              <div className="stockflow_column-controls">
                <div className="stockflow_column-controls-header">
                  <span>Show/Hide Columns:</span>
                  <button onClick={selectAllColumns} className="stockflow_column-control-btn">Select All</button>
                  <button onClick={deselectAllColumns} className="stockflow_column-control-btn">Deselect All</button>
                </div>
                <div className="stockflow_column-toggles">
                  {Object.keys(selectedColumns).map(col => (
                    <label key={col} className="stockflow_column-toggle">
                      <input type="checkbox" checked={selectedColumns[col]} onChange={() => toggleColumn(col)} />
                      <span>{col}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Quick Filters */}
              <div className="stockflow_inventory-controls">
                <div className="stockflow_filter-group">
                  <button className={`stockflow_filter-btn ${filterStatus === 'all' ? 'stockflow_active' : ''}`} onClick={() => setFilterStatus('all')}>All Items</button>
                  <button className={`stockflow_filter-btn ${filterStatus === 'in_stock' ? 'stockflow_active' : ''}`} onClick={() => setFilterStatus('in_stock')}>In Stock</button>
                  <button className={`stockflow_filter-btn ${filterStatus === 'issued' ? 'stockflow_active' : ''}`} onClick={() => setFilterStatus('issued')}>Issued</button>
                  <button className={`stockflow_filter-btn ${filterStatus === 'partially_issued' ? 'stockflow_active' : ''}`} onClick={() => setFilterStatus('partially_issued')}>Partially Issued</button>
                  <button className={`stockflow_filter-btn ${filterStatus === 'critical' ? 'stockflow_active' : ''}`} onClick={() => setFilterStatus('critical')}>Critical (0 Rolls)</button>
                  <button className={`stockflow_filter-btn ${filterStatus === 'low' ? 'stockflow_active' : ''}`} onClick={() => setFilterStatus('low')}>Low Stock (&lt;10)</button>
                </div>
                <div className="stockflow_results-info">
                  Showing {startIndex + 1} - {Math.min(endIndex, totalItems)} of {totalItems} items
                  {filteredData.length !== allData.length && <span className="stockflow_filtered-badge"> (Filtered)</span>}
                </div>
              </div>

              {/* Inventory Table */}
              <div className="stockflow_table-wrapper-custom">
                <table className="stockflow_inventory-table-custom">
                  <thead>
                    <tr>
                      {selectedColumns.Timestamp && <th onClick={() => handleSort('Timestamp')}>Timestamp {sortConfig.key === 'Timestamp' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>}
                      {selectedColumns['Barcode ID'] && <th onClick={() => handleSort('Barcode ID')}>Barcode ID {sortConfig.key === 'Barcode ID' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>}
                      {selectedColumns['Item Description'] && <th onClick={() => handleSort('Item Description')}>Item Description {sortConfig.key === 'Item Description' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>}
                      {selectedColumns.Unit && <th onClick={() => handleSort('Unit')}>Unit</th>}
                      {selectedColumns.Shade && <th onClick={() => handleSort('Shade')}>Shade</th>}
                      {selectedColumns['Lot No'] && <th onClick={() => handleSort('Lot No')}>Lot No</th>}
                      {selectedColumns['Rect Date'] && <th onClick={() => handleSort('Rect Date')}>Rect Date</th>}
                      {selectedColumns.Party && <th onClick={() => handleSort('Party')}>Party</th>}
                      {selectedColumns.Store && <th onClick={() => handleSort('Store')}>Store</th>}
                      {selectedColumns['Issue No'] && <th onClick={() => handleSort('Issue No')}>Issue No</th>}
                      {selectedColumns['Issue Date'] && <th onClick={() => handleSort('Issue Date')}>Issue Date</th>}
                      {selectedColumns['MRN Pkgs'] && <th onClick={() => handleSort('MRN Pkgs')}>MRN Pkgs</th>}
                      {selectedColumns['Issue Pkgs'] && <th onClick={() => handleSort('Issue Pkgs')}>Issue Pkgs</th>}
                      {selectedColumns['ADJ Pkgs'] && <th onClick={() => handleSort('ADJ Pkgs')}>ADJ Pkgs</th>}
                      {selectedColumns['Bal Pkgs'] && <th onClick={() => handleSort('Bal Pkgs')}>Bal Pkgs</th>}
                      {selectedColumns['MRN WT'] && <th onClick={() => handleSort('MRN WT')}>MRN WT</th>}
                      {selectedColumns['Bal WT'] && <th onClick={() => handleSort('Bal WT')}>Bal WT</th>}
                      {selectedColumns['Generated Time'] && <th onClick={() => handleSort('Generated Time')}>Generated Time</th>}
                      {selectedColumns['Batch Status'] && <th onClick={() => handleSort('Batch Status')}>Batch Status</th>}
                      {selectedColumns.Status && <th onClick={() => handleSort('Status')}>Status</th>}
                      {selectedColumns.Remarks && <th onClick={() => handleSort('Remarks')}>Remarks</th>}
                      {selectedColumns['Total Returned'] && <th onClick={() => handleSort('Total Returned')}>Total Returned</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {currentItems.length > 0 ? (
                      currentItems.map((row, idx) => {
                        const balPkgs = parseFloat(row['Bal Pkgs']);
                        let statusClass = '';
                        let statusText = '';
                        if (balPkgs === 0) { statusClass = 'stockflow_badge-critical'; statusText = 'Critical'; }
                        else if (balPkgs < 10) { statusClass = 'stockflow_badge-low'; statusText = 'Low'; }
                        else if (balPkgs < 50) { statusClass = 'stockflow_badge-medium'; statusText = 'Medium'; }
                        else { statusClass = 'stockflow_badge-high'; statusText = 'High'; }
                        
                        return (
                          <tr key={idx}>
                            {selectedColumns.Timestamp && <td className="stockflow_timestamp-cell">{row['Timestamp'] ? new Date(row['Timestamp']).toLocaleString() : '-'}</td>}
                            {selectedColumns['Barcode ID'] && <td className="stockflow_barcode-cell">{row['Barcode ID'] || '-'}</td>}
                            {selectedColumns['Item Description'] && <td className="stockflow_fabric-cell">{row['Item Description'] || '-'}</td>}
                            {selectedColumns.Unit && <td>{row['Unit'] || '-'}</td>}
                            {selectedColumns.Shade && <td>{row['Shade'] || '-'}</td>}
                            {selectedColumns['Lot No'] && <td>{row['Lot No'] || '-'}</td>}
                            {selectedColumns['Rect Date'] && <td>{formatDate(row['Rect Date'])}</td>}
                            {selectedColumns.Party && <td>{row['Party'] || '-'}</td>}
                            {selectedColumns.Store && <td>{row['Store'] || '-'}</td>}
                            {selectedColumns['Issue No'] && <td>{row['Issue No'] || '-'}</td>}
                            {selectedColumns['Issue Date'] && <td>{formatDate(row['Issue Date'])}</td>}
                            {selectedColumns['MRN Pkgs'] && <td>{parseFloat(row['MRN Pkgs']).toFixed(0)}</td>}
                            {selectedColumns['Issue Pkgs'] && <td>{parseFloat(row['Issue Pkgs']).toFixed(0)}</td>}
                            {selectedColumns['ADJ Pkgs'] && <td>{parseFloat(row['ADJ Pkgs']).toFixed(0)}</td>}
                            {selectedColumns['Bal Pkgs'] && <td className={balPkgs === 0 ? 'stockflow_critical-value' : ''}>{parseFloat(row['Bal Pkgs']).toFixed(0)}</td>}
                            {selectedColumns['MRN WT'] && <td>{parseFloat(row['MRN WT']).toFixed(1)}</td>}
                            {selectedColumns['Bal WT'] && <td>{parseFloat(row['Bal WT']).toFixed(1)}</td>}
                            {selectedColumns['Generated Time'] && <td>{row['Generated Time'] || '-'}</td>}
                            {selectedColumns['Batch Status'] && <td><span className={`stockflow_batch-status ${(row['Batch Status'] || '').toLowerCase()}`}>{row['Batch Status'] || '-'}</span></td>}
                            {selectedColumns.Status && <td><span className={`stockflow_stock-status ${row['Status'] || ''}`}>{row['Status'] === 'in_stock' ? 'In Stock' : row['Status'] === 'issued' ? 'Issued' : row['Status'] === 'partially_issued' ? 'Partially Issued' : row['Status'] || '-'}</span></td>}
                            {selectedColumns.Remarks && <td className="stockflow_remarks-cell">{row['Remarks'] || '-'}</td>}
                            {selectedColumns['Total Returned'] && <td>{parseFloat(row['Total Returned']).toFixed(1)}</td>}
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={Object.values(selectedColumns).filter(v => v).length} className="stockflow_no-data-cell">No records found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="stockflow_pagination-container">
                  <div className="stockflow_pagination-info">
                    <select value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))} className="stockflow_items-per-page">
                      <option value={10}>10 per page</option>
                      <option value={25}>25 per page</option>
                      <option value={50}>50 per page</option>
                      <option value={100}>100 per page</option>
                    </select>
                    <span className="stockflow_total-items">Total: {totalItems} items</span>
                  </div>
                  <div className="stockflow_pagination-controls">
                    <button onClick={() => handlePageChange(1)} disabled={currentPage === 1} className="stockflow_pagination-btn">« First</button>
                    <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="stockflow_pagination-btn">‹ Prev</button>
                    <div className="stockflow_pagination-numbers">
                      {getPageNumbers().map((page, index) => (
                        <button
                          key={index}
                          onClick={() => handlePageChange(page)}
                          className={`stockflow_pagination-number ${currentPage === page ? 'stockflow_active' : ''} ${page === '...' ? 'stockflow_dots' : ''}`}
                          disabled={page === '...'}
                        >
                          {page}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="stockflow_pagination-btn">Next ›</button>
                    <button onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages} className="stockflow_pagination-btn">Last »</button>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default StockReports;