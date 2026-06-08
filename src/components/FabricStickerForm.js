import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../Design/FabricStickerForm.css'

const FabricStickerForm = () => {
  const navigate = useNavigate();
  
  // Get logged in user data
  const [loggedInUser, setLoggedInUser] = useState(null);
  
  // Main Form Data
  const [formData, setFormData] = useState({
    cmfName: '',
    fabricName: '',
    group: '',
    shade: '',
    weight: '',
    lotNumber: '',
    billNumber: '',
    location: '',
    receivedPerson: '',
    authorizedPerson: '',
    date: new Date().toISOString().split('T')[0]
  });

  // Batch processing states
  const [batchMode, setBatchMode] = useState(false);
  const [totalRollsInBatch, setTotalRollsInBatch] = useState(1);
  const [currentRollNumber, setCurrentRollNumber] = useState(0);
  const [completedRolls, setCompletedRolls] = useState([]);
  const [batchInfo, setBatchInfo] = useState(null);
  const [batchActive, setBatchActive] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  
  const [submittedData, setSubmittedData] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentWeight, setCurrentWeight] = useState('0.00');
  const [isReading, setIsReading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [errorMessage, setErrorMessage] = useState('');
  const [isWeightStable, setIsWeightStable] = useState(false);
  const [lastStableWeight, setLastStableWeight] = useState('0.00');
  const [rollCount, setRollCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastPrintedRoll, setLastPrintedRoll] = useState(null);
  
  // Track if waiting for roll removal
  const [waitingForRollRemoval, setWaitingForRollRemoval] = useState(false);
  
  // UI Instructions
  const [uiInstruction, setUiInstruction] = useState('');
  const [instructionType, setInstructionType] = useState('info');
  
  // Weight tracking
  const [consecutiveSameWeight, setConsecutiveSameWeight] = useState(0);
  const [weightHistory, setWeightHistory] = useState([]);
  
  // Refs for tracking - Optimized memory management
  const lastWeightRef = useRef(null);
  const consecutiveCountRef = useRef(0);
  const weightBufferRef = useRef([]);
  const stableWeightValueRef = useRef(null);
  const isDisconnectingRef = useRef(false);
  const readLoopActiveRef = useRef(false);
  const abortControllerRef = useRef(null);
  
  // Batch info data
  const [batchNumber, setBatchNumber] = useState('');
  const [batchDate, setBatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [batchTime, setBatchTime] = useState(new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  const [purchaseOrderNo, setPurchaseOrderNo] = useState('');
  const [deliveryNoteNo, setDeliveryNoteNo] = useState('');
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');
  
  // Sequential barcode tracking
  const [nextBarcodeId, setNextBarcodeId] = useState(null);
  const [barcodeSequence, setBarcodeSequence] = useState({
    current: 0,
    next: 1,
    lastGenerated: null
  });
  const [isLoadingSequence, setIsLoadingSequence] = useState(true);
  
  // Print service states
  const [printServiceStatus, setPrintServiceStatus] = useState('connecting');
  const [printQueueLength, setPrintQueueLength] = useState(0);
  const [lastPrintStatus, setLastPrintStatus] = useState(null);
  const [wsReady, setWsReady] = useState(false);
  
  // Mobile menu state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  
  // Refs for cleanup - Optimized
  const stickerRef = useRef(null);
  const iframeRef = useRef(null);
  const portRef = useRef(null);
  const readerRef = useRef(null);
  const weightStableTimeoutRef = useRef(null);
  const autoPrintTimeoutRef = useRef(null);
  const demoIntervalRef = useRef(null);
  const timeIntervalRef = useRef(null);
  const serialReadIntervalRef = useRef(null);
  
  // WebSocket reference
  const wsRef = useRef(null);
  const isMounted = useRef(true);
  const lastPrintTriggerRef = useRef(0);

  // Update UI instruction
  const updateInstruction = (message, type = 'info') => {
    if (!isMounted.current) return;
    setUiInstruction(message);
    setInstructionType(type);
    console.log(`📢 UI: ${message}`);
  };

  // Load logged in user data
  useEffect(() => {
    isMounted.current = true;
    const userData = localStorage.getItem('user');
    if (userData && isMounted.current) {
      setLoggedInUser(JSON.parse(userData));
    } else if (isMounted.current) {
      navigate('/login');
    }
    
    return () => {
      isMounted.current = false;
      // Cleanup all resources on unmount
      cleanupAllResources();
    };
  }, [navigate]);

  // Centralized cleanup function
  const cleanupAllResources = async () => {
    console.log('🧹 Starting comprehensive cleanup...');
    
    // Clear all timeouts and intervals
    if (weightStableTimeoutRef.current) {
      clearTimeout(weightStableTimeoutRef.current);
      weightStableTimeoutRef.current = null;
    }
    
    if (autoPrintTimeoutRef.current) {
      clearTimeout(autoPrintTimeoutRef.current);
      autoPrintTimeoutRef.current = null;
    }
    
    if (timeIntervalRef.current) {
      clearInterval(timeIntervalRef.current);
      timeIntervalRef.current = null;
    }
    
    if (demoIntervalRef.current) {
      clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
    }
    
    if (serialReadIntervalRef.current) {
      clearInterval(serialReadIntervalRef.current);
      serialReadIntervalRef.current = null;
    }
    
    // Cancel any ongoing operations
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    // Disconnect scale properly
    await disconnectScale();
    
    // Clear all buffers
    if (weightBufferRef.current) {
      weightBufferRef.current = [];
    }
    
    lastWeightRef.current = null;
    stableWeightValueRef.current = null;
    consecutiveCountRef.current = 0;
    isDisconnectingRef.current = false;
    readLoopActiveRef.current = false;
    
    console.log('✅ Cleanup completed');
  };

  // Update current time every second
  useEffect(() => {
    timeIntervalRef.current = setInterval(() => {
      if (isMounted.current) {
        setBatchTime(new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    }, 1000);
    
    return () => {
      if (timeIntervalRef.current) {
        clearInterval(timeIntervalRef.current);
        timeIntervalRef.current = null;
      }
    };
  }, []);

  // Load the next sequential barcode ID from backend
  const loadNextBarcodeId = async () => {
    if (!isMounted.current) return;
    
    try {
      setIsLoadingSequence(true);
      const response = await axios.get('https://new-fabric-backend-1.onrender.com/api/google-sheets/next-barcode-id', {
        timeout: 5000
      });
      
      if (response.data.success && isMounted.current) {
        const { barcodeId, numericId, lastId } = response.data.data;
        setNextBarcodeId(barcodeId);
        setBarcodeSequence({
          current: lastId || 0,
          next: numericId,
          lastGenerated: barcodeId
        });
        console.log(`📋 Loaded next barcode ID: ${barcodeId} (Sequence: ${numericId})`);
        return barcodeId;
      } else if (isMounted.current) {
        console.error('Failed to get next barcode ID, using fallback');
        return getFallbackBarcodeId();
      }
    } catch (error) {
      console.error('Error loading next barcode ID:', error);
      return getFallbackBarcodeId();
    } finally {
      if (isMounted.current) {
        setIsLoadingSequence(false);
      }
    }
  };

  // Fallback method if API fails
  const getFallbackBarcodeId = () => {
    const fallbackId = String(Date.now()).slice(-6);
    console.warn('Using fallback barcode ID:', fallbackId);
    return fallbackId;
  };

  // Function to get next sequential barcode ID
  const getNextSequentialBarcodeId = async () => {
    try {
      const response = await axios.get('https://new-fabric-backend-1.onrender.com/api/google-sheets/next-barcode-id', {
        timeout: 5000
      });
      
      if (response.data.success && isMounted.current) {
        const { barcodeId, numericId } = response.data.data;
        setBarcodeSequence(prev => ({
          current: numericId - 1,
          next: numericId,
          lastGenerated: barcodeId
        }));
        console.log(`🔢 Generated sequential barcode: ${barcodeId} (No. ${numericId})`);
        return barcodeId;
      } else {
        throw new Error('Failed to get sequential ID');
      }
    } catch (error) {
      console.error('Error getting sequential barcode:', error);
      const fallbackId = String(Date.now()).slice(-6);
      console.warn('Using fallback barcode ID:', fallbackId);
      return fallbackId;
    }
  };

  // Show notification helper
  const showNotification = (message, type = 'info') => {
    if (!isMounted.current) return;
    
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#1a237e'};
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      z-index: 10000;
      animation: slideIn 0.3s ease-out;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification && notification.remove) {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
          if (notification && notification.remove) notification.remove();
        }, 300);
      }
    }, 3000);
  };

  // Save offline data helper
  const saveOfflineData = async (data, rollNumber) => {
    if (!isMounted.current) return;
    
    const offlineData = JSON.parse(localStorage.getItem('offlineFabricData') || '[]');
    offlineData.push({ 
      ...data, 
      rollNumber: rollNumber,
      offlineSavedAt: new Date().toISOString()
    });
    localStorage.setItem('offlineFabricData', JSON.stringify(offlineData));
    console.log(`💾 Data saved offline (${offlineData.length} items pending sync)`);
  };

  // Log batch completion
  const logBatchCompletion = async (totalProcessed) => {
    if (!batchInfo || !isMounted.current) return;
    
    try {
      await axios.post('https://new-fabric-backend-1.onrender.com/api/batch/complete', {
        batchId: `BATCH-${Date.now()}`,
        batchNumber: batchNumber,
        batchDate: batchDate,
        batchStartTime: batchTime,
        lotNumber: batchInfo.lotNumber,
        totalRolls: totalRollsInBatch,
        processedRolls: totalProcessed,
        status: 'completed',
        completedAt: new Date().toISOString(),
        completedBy: batchInfo.receivedPerson || 'System',
        purchaseOrderNo: purchaseOrderNo,
        deliveryNoteNo: deliveryNoteNo,
        supplierInvoiceNo: supplierInvoiceNo
      }, { timeout: 5000 });
      console.log('✓ Batch completion logged');
    } catch (error) {
      console.log('Could not log batch completion:', error);
    }
  };

  // Show category summary
  const showCategorySummary = async () => {
    if (!isMounted.current) return;
    
    try {
      const response = await axios.get('https://new-fabric-backend-1.onrender.com/api/google-sheets/inventory-summary', {
        timeout: 5000
      });
      if (response.data.success && response.data.data.length > 0 && isMounted.current) {
        const summary = response.data.data;
        const topItems = summary.slice(0, 3);
        const message = topItems.map(item => 
          `${item.fabricName} - ${item.shade}: ${item.availableRolls} rolls (${item.availableWeight} KG)`
        ).join('\n');
        
        console.log('📊 Current Inventory Summary:\n', message);
      }
    } catch (error) {
      console.error('Error fetching category summary:', error);
    }
  };

  // Store data in Google Sheets
  const storeDataInGoogleSheets = async (data, rollNumber) => {
    try {
      const API_URL = 'https://new-fabric-backend-1.onrender.com/api/google-sheets/store-fabric-data';
      
      const payload = {
        barcodeId: data.uniqueBarcodeId,
        batchNumber: batchNumber,
        batchDate: batchDate,
        batchTime: batchTime,
        cmfName: data.cmfName,
        fabricName: data.fabricName,
        shade: data.shade,
        lotNumber: data.lotNumber,
        group: data.group || '',
         billNumber: data.billNumber || formData.billNumber || '',
        date: data.date || new Date().toISOString().split('T')[0],
        location: data.location || '',
        receivedPerson: data.receivedPerson || '',
        authorizedPerson: data.authorizedPerson || '',
        rollNumber: rollNumber,
        batchTotal: data.totalRolls || totalRollsInBatch,
        batchStatus: 'completed',
        weight: data.weight,
        generatedAt: data.generatedAt || new Date().toLocaleTimeString(),
        timestamp: data.timestamp || new Date().toISOString(),
        status: 'in_stock',
        purchaseOrderNo: purchaseOrderNo || '',
        deliveryNoteNo: deliveryNoteNo || '',
        supplierInvoiceNo: supplierInvoiceNo || ''
      };
      
      console.log('📤 SAVING TO GOOGLE SHEETS:', {
        batchNumber: payload.batchNumber,
        batchDate: payload.batchDate,
        barcodeId: payload.barcodeId,
        cmfName: payload.cmfName,
        fabricName: payload.fabricName,
        lotNumber: payload.lotNumber,
        weight: payload.weight
      });
      
      const response = await axios.post(API_URL, payload, {
        timeout: 15000,
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.data.success && isMounted.current) {
        console.log(`✅ SUCCESS: Roll ${rollNumber} saved to Google Sheets with barcode: ${data.uniqueBarcodeId}`);
        showNotification(`✓ Roll ${rollNumber} saved (Barcode: ${data.uniqueBarcodeId})`, 'success');
        
        const storedRolls = JSON.parse(localStorage.getItem('fabricRolls') || '[]');
        storedRolls.push(payload);
        localStorage.setItem('fabricRolls', JSON.stringify(storedRolls));
        
        return true;
      } else {
        console.error('❌ Backend returned error:', response.data);
        showNotification(`⚠️ Save failed: ${response.data.message}`, 'error');
        return false;
      }
      
    } catch (error) {
      console.error('❌ NETWORK ERROR:', error);
      
      if (error.code === 'ECONNREFUSED') {
        showNotification('❌ Backend server not running on port 5000!', 'error');
      } else if (error.code === 'ERR_NETWORK') {
        showNotification('❌ Cannot connect to backend. Please start server.', 'error');
      } else if (error.response) {
        showNotification(`❌ Server error: ${error.response.status}`, 'error');
      } else {
        showNotification(`❌ Error: ${error.message}`, 'error');
      }
      
      await saveOfflineData(data, rollNumber);
      
      return false;
    }
  };

  // Stop batch function
  const stopBatch = async () => {
    if (!batchActive || !isMounted.current) return;
    
    setShowStopConfirm(false);
    setWaitingForRollRemoval(false);
    
    const actualRollsProcessed = currentRollNumber;
    const expectedRolls = totalRollsInBatch;
    const cancelledRolls = expectedRolls - actualRollsProcessed;
    
    const summary = {
      batchStopped: true,
      stoppedAt: new Date().toISOString(),
      expectedRolls: expectedRolls,
      actualRollsProcessed: actualRollsProcessed,
      cancelledRolls: cancelledRolls,
      completedRolls: completedRolls,
      batchInfo: batchInfo,
      batchNumber: batchNumber,
      batchDate: batchDate,
      note: `${cancelledRolls} rolls were CANCELLED/DELETED - not marked as pending`
    };
    
    console.log('Batch stopped - Pending rolls DELETED:', summary);
    
    const stoppedBatches = JSON.parse(localStorage.getItem('completedBatches') || '[]');
    stoppedBatches.push(summary);
    localStorage.setItem('completedBatches', JSON.stringify(stoppedBatches));
    
    showNotification(
      `✓ Batch completed! Processed ${actualRollsProcessed} of ${expectedRolls} rolls. ${cancelledRolls} rolls were CANCELLED (not saved).`, 
      'success'
    );
    
    try {
      await axios.post('https://new-fabric-backend-1.onrender.com/api/batch/complete', {
        ...summary,
        message: `${cancelledRolls} rolls cancelled/deleted - not saved to database`
      }, { timeout: 5000 });
    } catch (error) {
      console.log('Could not sync batch completion to backend:', error);
    }
    
    setBatchActive(false);
    setBatchMode(false);
    updateInstruction('Batch completed. Click "New Batch" to start again', 'success');
    
    setTimeout(() => {
      if (isMounted.current) {
        const userMessage = window.confirm(
          `✅ Batch Summary:\n\n` +
          `Batch Number: ${batchNumber}\n` +
          `Date: ${batchDate}\n` +
          `✓ Successfully Processed: ${actualRollsProcessed} rolls\n` +
          `✗ CANCELLED / DELETED: ${cancelledRolls} rolls\n` +
          `📦 Total Expected: ${expectedRolls} rolls\n\n` +
          `Note: ${cancelledRolls} rolls were NOT saved to database.\n\n` +
          `Do you want to start a new batch?`
        );
        
        if (userMessage) {
          handleReset();
        }
      }
    }, 500);
  };

  const cancelStopBatch = () => {
    setShowStopConfirm(false);
  };

  // Connect to Python Print Service
  useEffect(() => {
    connectToPrintService();
    loadNextBarcodeId();
    
    return () => {
      if (wsRef.current) {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.close();
        }
        wsRef.current = null;
      }
      if (autoPrintTimeoutRef.current) {
        clearTimeout(autoPrintTimeoutRef.current);
        autoPrintTimeoutRef.current = null;
      }
      if (weightStableTimeoutRef.current) {
        clearTimeout(weightStableTimeoutRef.current);
        weightStableTimeoutRef.current = null;
      }
      if (demoIntervalRef.current) {
        clearInterval(demoIntervalRef.current);
        demoIntervalRef.current = null;
      }
    };
  }, []);

const connectToPrintService = () => {
  // Get the correct hostname - use window.location.hostname for the current connection
  // If accessed via localhost, use localhost. If accessed via IP, still use localhost for WebSocket
  // Because the print service is running on the same machine as the browser
  const wsHost = 'localhost'; // Always use localhost for WebSocket since print service is on same machine
  const WS_URL = `ws://${wsHost}:8765`;
  
  console.log('🔌 Connecting to print service at:', WS_URL);
  console.log('Current page URL:', window.location.href);
  console.log('Using WebSocket host:', wsHost);
  
  // Add connection timeout
  const connectionTimeout = setTimeout(() => {
    if (wsRef.current && wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('❌ Connection timeout after 5 seconds');
      if (isMounted.current) {
        setPrintServiceStatus('error');
        setErrorMessage('Connection timeout - print service not responding');
        updateInstruction('❌ Print service connection timeout. Make sure print_service.py is running.', 'error');
      }
    }
  }, 5000);
  
  try {
    wsRef.current = new WebSocket(WS_URL);
    
    wsRef.current.onopen = () => {
      clearTimeout(connectionTimeout);
      console.log('✅ WebSocket connection established to', WS_URL);
      if (isMounted.current) {
        setPrintServiceStatus('connected');
        updateInstruction('✅ Connected to print service!', 'success');
        showNotification('Print service connected successfully!', 'success');
      }
      
      // Send authentication
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'auth',
          token: 'fabric-print-secret-key-2024'
        }));
      }
    };
    
    wsRef.current.onmessage = (event) => {
      if (!isMounted.current) return;
      
      try {
        const response = JSON.parse(event.data);
        console.log('📨 Received from print service:', response.type);
        
        switch(response.type) {
          case 'auth_success':
            console.log('✅ Authentication successful');
            setPrintServiceStatus('ready');
            setWsReady(true);
            showNotification('✓ Print service ready!', 'success');
            updateInstruction('✅ Print service ready! Start a batch to begin', 'success');
            break;
            
          case 'auth_failed':
            console.error('❌ Authentication failed');
            setPrintServiceStatus('error');
            setWsReady(false);
            setErrorMessage('Print service authentication failed');
            showNotification('❌ Print service auth failed!', 'error');
            break;
            
          case 'print_result':
            console.log('Print result:', response);
            if (response.success) {
              console.log('✅ Print successful:', response.message);
              setLastPrintStatus({ success: true, message: response.message });
              showNotification(`✓ Sticker printed successfully!`, 'success');
            } else {
              console.error('❌ Print failed:', response.message);
              setLastPrintStatus({ success: false, message: response.message });
              showNotification(`✗ Print failed: ${response.message}`, 'error');
            }
            break;
            
          case 'status':
            console.log('📊 Service status:', response);
            setPrintQueueLength(response.queue_length || 0);
            break;
            
          case 'error':
            console.error('❌ Service error:', response.message);
            showNotification(`Error: ${response.message}`, 'error');
            break;
            
          default:
            console.log('Unknown message type:', response);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    wsRef.current.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      clearTimeout(connectionTimeout);
      if (isMounted.current) {
        setPrintServiceStatus('error');
        setWsReady(false);
        setErrorMessage(`WebSocket error: ${error.message || 'Connection failed'}`);
        updateInstruction('❌ Cannot connect to print service. Make sure print_service.py is running on port 8765', 'error');
        showNotification('⚠️ Print service offline! Run: python print_service.py', 'error');
      }
    };
    
    wsRef.current.onclose = (event) => {
      console.log('🔌 Disconnected from print service, code:', event.code, 'reason:', event.reason);
      clearTimeout(connectionTimeout);
      if (isMounted.current) {
        setPrintServiceStatus('disconnected');
        setWsReady(false);
        updateInstruction('⚠️ Print service disconnected. Run: python print_service.py', 'warning');
      }
      
      // Auto-reconnect after 5 seconds
      setTimeout(() => {
        if (isMounted.current && (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)) {
          console.log('🔄 Attempting to reconnect...');
          connectToPrintService();
        }
      }, 5000);
    };
    
  } catch (error) {
    console.error('Failed to create WebSocket:', error);
    clearTimeout(connectionTimeout);
    if (isMounted.current) {
      setPrintServiceStatus('error');
      setWsReady(false);
      showNotification('Failed to connect to print service', 'error');
    }
  }
};
  const printViaPythonService = (stickerData) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.log('WebSocket state:', wsRef.current?.readyState);
      showNotification('Print service not connected. Please check if service is running.', 'error');
      return false;
    }
    
    if (printServiceStatus !== 'ready') {
      showNotification('Print service not ready. Please wait for connection.', 'error');
      return false;
    }
    
    try {
      wsRef.current.send(JSON.stringify({
        type: 'print',
        data: stickerData
      }));
      return true;
    } catch (error) {
      console.error('Failed to send print job:', error);
      showNotification('Failed to send print job.', 'error');
      return false;
    }
  };

  // Reset tracking for new roll
  const resetTracking = () => {
    console.log('🔄 Resetting tracking for next roll...');
    
    if (weightStableTimeoutRef.current) {
      clearTimeout(weightStableTimeoutRef.current);
      weightStableTimeoutRef.current = null;
    }
    
    if (autoPrintTimeoutRef.current) {
      clearTimeout(autoPrintTimeoutRef.current);
      autoPrintTimeoutRef.current = null;
    }
    
    lastWeightRef.current = null;
    consecutiveCountRef.current = 0;
    stableWeightValueRef.current = null;
    setIsWeightStable(false);
    setLastStableWeight('0.00');
    weightBufferRef.current = [];
    
    console.log('✅ Tracking reset complete');
  };

  // Smooth weight readings
  const smoothWeightReadings = (newWeight) => {
    weightBufferRef.current.push(parseFloat(newWeight));
    if (weightBufferRef.current.length > 3) {
      weightBufferRef.current.shift();
    }
    
    if (weightBufferRef.current.length === 3) {
      const avg = weightBufferRef.current.reduce((a, b) => a + b, 0) / 3;
      return avg.toFixed(2);
    }
    
    return newWeight;
  };

  // Weight extraction with validation
  const extractWeightFromData = (data) => {
    const patterns = [
      /(\d+\.\d{2,3})\s*(?:kg|KG)?/,
      /(\d+\.\d{1,2})\s*(?:kg|KG)?/,
      /(\d{1,3}\.\d{2})/,
      /(\d+\.?\d*)\s*$/
    ];
    
    for (const pattern of patterns) {
      const match = data.match(pattern);
      if (match && match[1]) {
        let weight = parseFloat(match[1]);
        
        if (!isNaN(weight) && weight >= 0.5 && weight <= 60) {
          weight = Math.round(weight * 100) / 100;
          return weight.toFixed(2);
        }
      }
    }
    return null;
  };

  // Enhanced stopReading function with better cleanup
  const stopReading = async () => {
    console.log('🛑 Stopping serial reading...');
    readLoopActiveRef.current = false;
    
    if (readerRef.current) {
      try {
        await readerRef.current.cancel();
        readerRef.current.releaseLock();
        console.log('✅ Reader cancelled and lock released');
      } catch (error) {
        console.error('Error canceling reader:', error);
      }
      readerRef.current = null;
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  };

  // Enhanced disconnect function with proper resource cleanup
  const disconnectScale = async () => {
    if (isDisconnectingRef.current) {
      console.log('⚠️ Already disconnecting, please wait...');
      showNotification('Already disconnecting, please wait...', 'warning');
      return;
    }
    
    isDisconnectingRef.current = true;
    console.log('🔌 Disconnecting scale with proper memory cleanup...');
    updateInstruction('Disconnecting scale... Please wait', 'warning');
    
    // Clear all timeouts first
    if (weightStableTimeoutRef.current) {
      clearTimeout(weightStableTimeoutRef.current);
      weightStableTimeoutRef.current = null;
    }
    
    if (autoPrintTimeoutRef.current) {
      clearTimeout(autoPrintTimeoutRef.current);
      autoPrintTimeoutRef.current = null;
    }
    
    // Stop reading loop
    await stopReading();
    
    // Small delay to ensure read loop is fully stopped
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Close and release the port
    if (portRef.current) {
      try {
        if (portRef.current.readable) {
          console.log('Closing readable stream...');
          await portRef.current.readable.cancel();
        }
        
        await portRef.current.close();
        console.log('✅ Port closed successfully');
        portRef.current = null;
      } catch (error) {
        console.error('Error closing port:', error);
        portRef.current = null;
      }
    }
    
    // Clear all buffers and state
    if (weightBufferRef.current) {
      weightBufferRef.current = [];
    }
    
    lastWeightRef.current = null;
    stableWeightValueRef.current = null;
    consecutiveCountRef.current = 0;
    readLoopActiveRef.current = false;
    
    if (readerRef.current) {
      try {
        await readerRef.current.cancel();
        readerRef.current.releaseLock();
      } catch (error) {
        console.error('Error canceling reader:', error);
      }
      readerRef.current = null;
    }
    
    // Reset UI state
    if (isMounted.current) {
      setIsConnected(false);
      setConnectionStatus('disconnected');
      setCurrentWeight('0.00');
      setIsWeightStable(false);
      setConsecutiveSameWeight(0);
      setWeightHistory([]);
      setWaitingForRollRemoval(false);
      setErrorMessage('');
      updateInstruction('Scale disconnected. Click "Connect USB Scale" to reconnect', 'info');
      showNotification('Scale disconnected successfully!', 'success');
    }
    
    isDisconnectingRef.current = false;
    console.log('✅ Scale fully disconnected and memory cleaned up');
    
    await new Promise(resolve => setTimeout(resolve, 100));
  };

  // Reset serial connection function
  const resetSerialConnection = async () => {
    console.log('🔄 Resetting serial connection...');
    updateInstruction('Resetting serial connection...', 'warning');
    
    await disconnectScale();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    if (isMounted.current) {
      setCurrentWeight('0.00');
      setConnectionStatus('disconnected');
      setIsConnected(false);
      setErrorMessage('');
      updateInstruction('Serial connection reset. You can now reconnect the scale.', 'success');
      showNotification('Serial connection reset successfully!', 'success');
    }
    
    console.log('✅ Serial connection reset complete');
  };

  // Enhanced startReading function with better error handling
  const startReading = async (port) => {
    if (readLoopActiveRef.current) {
      console.log('⚠️ Read loop already active, stopping previous...');
      await stopReading();
    }
    
    const decoder = new TextDecoder();
    let buffer = '';
    let lastReadTime = 0;
    const MIN_READ_INTERVAL = 150;
    let consecutiveEmptyReads = 0;
    readLoopActiveRef.current = true;
    
    console.log('📡 Starting serial reader with optimized memory management');
    
    try {
      while (port.readable && isMounted.current && readLoopActiveRef.current && !isDisconnectingRef.current) {
        readerRef.current = port.readable.getReader();
        
        try {
          while (true && isMounted.current && readLoopActiveRef.current && !isDisconnectingRef.current) {
            const { value, done } = await readerRef.current.read();
            
            if (done) {
              console.log('🔴 Serial stream ended');
              break;
            }
            
            const now = Date.now();
            if (now - lastReadTime < MIN_READ_INTERVAL) {
              continue;
            }
            lastReadTime = now;
            
            const text = decoder.decode(value);
            buffer += text;
            
            let lines = buffer.split(/\r?\n|\r/);
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine) {
                consecutiveEmptyReads++;
                if (consecutiveEmptyReads > 10) {
                  buffer = '';
                  consecutiveEmptyReads = 0;
                }
                continue;
              }
              
              consecutiveEmptyReads = 0;
              
              const weight = extractWeightFromData(trimmedLine);
              if (weight !== null && !isNaN(weight)) {
                updateWeightDisplay(weight);
              }
            }
            
            if (buffer.length > 500) {
              console.log('🧹 Clearing large buffer:', buffer.length, 'chars');
              buffer = '';
            }
          }
        } catch (error) {
          if (error.name === 'AbortError') {
            console.log('Reading aborted gracefully');
            break;
          }
          console.error('❌ Reading error:', error);
        } finally {
          if (readerRef.current) {
            readerRef.current.releaseLock();
            readerRef.current = null;
          }
        }
      }
    } catch (error) {
      console.error('❌ Stream error:', error);
    } finally {
      readLoopActiveRef.current = false;
      console.log('📡 Stopped reading from scale');
    }
  };

const startDemoMode = () => {
  if (!isMounted.current) return;
  
  let index = 0;
  const demoWeights = ['12.50', '15.75', '18.20', '22.35', '25.60', '28.45'];
  
  // Reset all tracking
  resetTracking();
  setWaitingForRollRemoval(false);
  setCurrentWeight('0.00');
  setLastStableWeight('0.00');
  
  // Set demo mode status
  setConnectionStatus('demo');
  setIsConnected(true);
  
  // Clear any existing interval
  if (demoIntervalRef.current) {
    clearInterval(demoIntervalRef.current);
  }
  
  updateInstruction('🎮 Demo mode active! Fill the form and click "Start Batch" to begin', 'info');
  showNotification('Demo mode activated! Start a batch to see simulated weights.', 'success');
  
  demoIntervalRef.current = setInterval(() => {
    if (!isMounted.current) return;
    
    // Always show demo weights when batch is active
    if (batchActive) {
      // Check if we're ready for a new roll (not processing, not waiting, and not completed all rolls)
      if (!waitingForRollRemoval && !isProcessing && currentRollNumber < totalRollsInBatch) {
        const weight = demoWeights[index % demoWeights.length];
        console.log(`🎮 Demo mode: Simulating weight ${weight} KG for roll ${currentRollNumber + 1}`);
        updateWeightDisplay(weight);
        index++;
      } 
      // When waiting for roll removal (after print) - reset to 0
      else if (waitingForRollRemoval && !isProcessing) {
        setCurrentWeight('0.00');
        console.log('🎮 Demo mode: Roll printed - ready for next roll');
      }
      // When batch is complete
      else if (currentRollNumber >= totalRollsInBatch) {
        console.log('🎮 Demo mode: Batch complete!');
        updateInstruction('🎉 Batch complete! Click "New Batch" to start again', 'success');
      }
    } else {
      // Batch not active - just show 0
      setCurrentWeight('0.00');
      console.log('🎮 Demo mode: Waiting for batch to start...');
    }
  }, 2500);
};
const stopDemoMode = () => {
  console.log('🛑 Stopping demo mode...');
  
  if (demoIntervalRef.current) {
    clearInterval(demoIntervalRef.current);
    demoIntervalRef.current = null;
  }
  
  setConnectionStatus('disconnected');
  setIsConnected(false);
  setCurrentWeight('0.00');
  updateInstruction('Demo mode stopped. Click "Connect USB Scale" to use physical scale.', 'info');
  showNotification('Demo mode deactivated', 'info');
  
  // Also disconnect scale if it was connected
  disconnectScale();
};

  const connectToScale = async () => {
    if (isDisconnectingRef.current) {
      showNotification('Please wait, still disconnecting...', 'warning');
      return;
    }
    
    setErrorMessage('');
    setConnectionStatus('connecting');
    updateInstruction('Connecting to scale... Please select the USB device', 'info');
    
    try {
      if ('serial' in navigator) {
        const port = await navigator.serial.requestPort();
        
        await port.open({ 
          baudRate: 9600,
          dataBits: 8,
          stopBits: 1,
          parity: 'none',
          flowControl: 'none',
          bufferSize: 255
        });
        
        console.log('✅ Scale connected with settings:');
        console.log('   Baud Rate: 9600');
        console.log('   Data Bits: 8');
        console.log('   Stop Bits: 1');
        console.log('   Parity: none');
        
        portRef.current = port;
        setIsConnected(true);
        setConnectionStatus('connected');
        updateInstruction('✅ Scale connected! Start a batch to begin', 'success');
        showNotification('Scale connected successfully!', 'success');
        
        startReading(port);
      } else {
        throw new Error('Web Serial API not supported. Please use Chrome or Edge browser.');
      }
    } catch (error) {
      console.error('Connection error:', error);
      setErrorMessage(error.message || 'Failed to connect to weighing scale');
      setConnectionStatus('error');
      setIsConnected(false);
      updateInstruction(`❌ Connection failed: ${error.message}`, 'error');
    }
  };
  
  // Start batch process
  const startBatchProcess = async () => {
    console.log('🚀 START BATCH PROCESS CALLED');
    
    if (!isMounted.current) return;
    
    let currentBatchNumber = batchNumber;
    if (!currentBatchNumber) {
      currentBatchNumber = `BATCH-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${String(Date.now()).slice(-6)}`;
      setBatchNumber(currentBatchNumber);
      console.log('📦 Generated batch number:', currentBatchNumber);
    }
    
    if (!formData.cmfName) {
      showNotification("CMF Name is required for batch processing.", "error");
      updateInstruction("❌ Please enter CMF Name", "error");
      return;
    }
    
    if (!formData.fabricName) {
      showNotification("Fabric Name is required for batch processing.", "error");
      updateInstruction("❌ Please enter Fabric Name", "error");
      return;
    }
    
    if (!formData.lotNumber) {
      showNotification("Lot Number is required for batch processing.", "error");
      updateInstruction("❌ Please enter Lot Number", "error");
      return;
    }
    
    if (!formData.shade) {
      showNotification("Shade is required for batch processing.", "error");
      updateInstruction("❌ Please enter Shade", "error");
      return;
    }
    
    if (!totalRollsInBatch || totalRollsInBatch < 1) {
      showNotification("Please enter total number of rolls in batch.", "error");
      updateInstruction("❌ Please enter total number of rolls", "error");
      return;
    }
    
    showNotification("Loading next barcode sequence from database...", "info");
    updateInstruction("📋 Loading barcode sequence...", "info");
    await loadNextBarcodeId();
    
    const batchInfoData = {
      cmfName: formData.cmfName,
      fabricName: formData.fabricName,
      group: formData.group,
      shade: formData.shade,
      lotNumber: formData.lotNumber,
      billNumber: formData.billNumber,
      date: formData.date,
      location: formData.location || 'WAREHOUSE',
      receivedPerson: formData.receivedPerson || 'System',
      authorizedPerson: formData.authorizedPerson || 'System'
    };
    
    console.log('📦 Batch Info:', batchInfoData);
    console.log('📦 Total Rolls:', totalRollsInBatch);
    
    setBatchInfo(batchInfoData);
    setSubmittedData(batchInfoData);
    setBatchActive(true);
    setCurrentRollNumber(0);
    setCompletedRolls([]);
    setBatchMode(false);
    setWaitingForRollRemoval(false);
    resetTracking();
    
    setCurrentWeight('0.00');
    setLastStableWeight('0.00');
    
    const nextIdDisplay = nextBarcodeId || 'loading...';
    const successMessage = `✅ Batch started! Batch Number: ${currentBatchNumber}, Expected ${totalRollsInBatch} rolls. Next barcode: ${nextIdDisplay}`;
    
    console.log(successMessage);
    updateInstruction(`✅ Batch started! Place roll 1 of ${totalRollsInBatch} on the scale`, 'success');
    showNotification(successMessage, 'success');
    
    setTimeout(() => {
      console.log('📊 Batch Active Status:', true);
      console.log('📊 Current Roll:', 0, '/', totalRollsInBatch);
    }, 100);
  };

  // PRINT FUNCTION - called by Enter key
  const handlePrint = async () => {
    console.log('🖨️ PRINT TRIGGERED');
    
    if (isProcessing) {
      showNotification('Already processing, please wait...', 'warning');
      return;
    }
    
    if (!batchActive) {
      showNotification('Please start a batch first', 'warning');
      return;
    }
    
    if (currentRollNumber >= totalRollsInBatch) {
      showNotification('All rolls already processed', 'warning');
      return;
    }
    
    const currentWeightNum = parseFloat(currentWeight);
    if (currentWeightNum < 1.0) {
      showNotification(`Weight ${currentWeight} KG is too low. Please place roll on scale.`, 'warning');
      return;
    }
    
    if (waitingForRollRemoval) {
      showNotification('Please remove the previous roll first', 'warning');
      return;
    }
    
    setWaitingForRollRemoval(true);
    setIsProcessing(true);
    updateInstruction(`🖨️ Printing sticker for roll ${currentRollNumber + 1}...`, 'info');
    
    try {
      const barcodeId = await getNextSequentialBarcodeId();
      const currentTime = new Date();
      const timeString = currentTime.toLocaleTimeString();
      const dateString = currentTime.toISOString().split('T')[0];
      
      const stickerData = {
        cmfName: batchInfo.cmfName,
        fabricName: batchInfo.fabricName,
        group: batchInfo.group,
        shade: batchInfo.shade,
        weight: currentWeight,
        lotNumber: batchInfo.lotNumber,
        billNumber: batchInfo.billNumber,
        date: batchInfo.date || dateString,
        location: batchInfo.location,
        receivedPerson: batchInfo.receivedPerson,
        authorizedPerson: batchInfo.authorizedPerson,
        rollNumber: currentRollNumber + 1,
        totalRolls: totalRollsInBatch,
        uniqueBarcodeId: barcodeId,
        generatedAt: timeString,
        timestamp: currentTime.toISOString(),
        status: 'in_stock'
      };
      
      console.log('📦 Sticker Data:', stickerData);
      
      const stored = await storeDataInGoogleSheets(stickerData, currentRollNumber + 1);
      
      if (stored) {
        console.log('✅ Data saved to Google Sheets');
        setSubmittedData(stickerData);
        
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && printServiceStatus === 'ready') {
          printViaPythonService(stickerData);
          showNotification(`✓ Roll ${currentRollNumber + 1} sticker printed!`, 'success');
          updateInstruction(`✅ Roll ${currentRollNumber + 1} printed!`, 'success');
        } else {
          console.log('⚠️ Print service not available');
          showNotification('⚠️ Data saved but print service not available', 'warning');
        }
        
        setCompletedRolls(prev => [...prev, {
          rollNumber: currentRollNumber + 1,
          weight: currentWeight,
          barcodeId: barcodeId,
          timestamp: timeString,
          fabricName: batchInfo.fabricName,
          shade: batchInfo.shade
        }]);
        
        const newRollNumber = currentRollNumber + 1;
        setCurrentRollNumber(newRollNumber);
        setLastPrintedRoll(newRollNumber);
        
        setCurrentWeight('0.00');
        setFormData(prev => ({ ...prev, weight: '0.00' }));
        
        if (newRollNumber >= totalRollsInBatch) {
          showNotification(`🎉 Batch complete!`, 'success');
          setBatchActive(false);
          setWaitingForRollRemoval(false);
          await logBatchCompletion(newRollNumber);
          updateInstruction('🎉 Batch completed! Start a new batch to continue', 'success');
        } else {
          showNotification(`✅ Roll ${newRollNumber} done! Ready for next roll`, 'success');
          updateInstruction(`✅ Roll ${newRollNumber} printed! Place roll ${newRollNumber + 1} of ${totalRollsInBatch} on the scale`, 'success');
          setWaitingForRollRemoval(false);
        }
      }
    } catch (error) {
      console.error('❌ Print error:', error);
      showNotification('Error printing', 'error');
      setWaitingForRollRemoval(false);
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
        console.log('✅ Processing flag reset');
      }, 2000);
    }
  };

  // Update weight display
  const updateWeightDisplay = (weight) => {
    const currentWeightNum = parseFloat(weight);
    
    console.log('⚡ WEIGHT UPDATE:', weight, 'KG');
    console.log('Current state - Processing:', isProcessing, 'Waiting:', waitingForRollRemoval);
    
    if (isProcessing) {
      console.log('⏳ Processing - ignoring weight update');
      return;
    }
    
    if (waitingForRollRemoval) {
      console.log('⏳ Waiting for roll removal - ignoring weight');
      return;
    }
    
    setCurrentWeight(weight);
    setFormData(prev => ({ ...prev, weight: weight }));
    
    if (batchActive && currentWeightNum >= 1.0 && currentRollNumber < totalRollsInBatch) {
      updateInstruction(`✅ Weight: ${weight} KG. Press ENTER to print sticker!`, 'success');
      showNotification(`Weight detected: ${weight} KG. Press ENTER to print`, 'info');
    } else if (batchActive && currentRollNumber < totalRollsInBatch && currentWeightNum < 1.0 && currentWeightNum > 0) {
      updateInstruction(`⚠️ Weight (${weight} KG) is too low. Please ensure roll is properly placed.`, 'warning');
    }
  };

  // ENTER key listener for printing
  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.key === 'Enter') {
        console.log('⌨️ ENTER key pressed');
        event.preventDefault();
        event.stopPropagation();
        
        const weightNum = parseFloat(currentWeight);
        if (batchActive && !isProcessing && !waitingForRollRemoval && weightNum >= 1.0 && currentRollNumber < totalRollsInBatch) {
          console.log('✅ ENTER - Printing!');
          handlePrint();
        } else {
          console.log('❌ ENTER ignored - Conditions not met');
          if (!batchActive) {
            showNotification('Please start a batch first', 'warning');
          } else if (waitingForRollRemoval) {
            showNotification('Please wait - processing previous roll', 'warning');
          } else if (weightNum < 1.0) {
            showNotification(`Weight ${currentWeight} KG is too low. Please place roll on scale.`, 'warning');
          } else if (currentRollNumber >= totalRollsInBatch) {
            showNotification('All rolls completed! Start new batch', 'warning');
          }
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [batchActive, isProcessing, waitingForRollRemoval, currentWeight, currentRollNumber, totalRollsInBatch]);

  // Keyboard shortcut for resetting serial connection (Ctrl+Shift+R)
  useEffect(() => {
    const handleResetShortcut = (event) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'R') {
        event.preventDefault();
        console.log('🔧 Reset shortcut triggered');
        resetSerialConnection();
      }
    };
    
    window.addEventListener('keydown', handleResetShortcut);
    return () => window.removeEventListener('keydown', handleResetShortcut);
  }, []);

const handleChange = (e) => {
  const { name, value } = e.target;
  
  // Convert to uppercase for all text inputs except date field
  let processedValue = value;
  
  // Check if it's not the date field
  if (name !== 'date') {
    processedValue = value.toUpperCase();
  }
  
  setFormData(prev => ({ ...prev, [name]: processedValue }));
};

  // Sync offline data when back online
  useEffect(() => {
    const syncOfflineData = async () => {
      if (!isMounted.current) return;
      
      const offlineData = JSON.parse(localStorage.getItem('offlineFabricData') || '[]');
      if (offlineData.length > 0 && navigator.onLine) {
        showNotification(`🔄 Syncing ${offlineData.length} offline records to Google Sheets...`, 'info');
        
        let successCount = 0;
        let failCount = 0;
        
        for (const data of offlineData) {
          try {
            const { offlineSavedAt, ...cleanData } = data;
            
            const response = await axios.post('https://new-fabric-backend-1.onrender.com/api/google-sheets/store-fabric-data', cleanData, {
              timeout: 10000
            });
            
            if (response.data.success) {
              successCount++;
              console.log(`✓ Synced roll ${data.rollNumber}: ${data.barcodeId}`);
            } else {
              failCount++;
            }
          } catch (error) {
            failCount++;
            console.error('Failed to sync offline data:', error);
          }
        }
        
        if (successCount > 0 && isMounted.current) {
          localStorage.removeItem('offlineFabricData');
          showNotification(`✓ Synced ${successCount} records to Google Sheets (${failCount} failed)`, 'success');
          await showCategorySummary();
          await loadNextBarcodeId();
        } else if (failCount > 0 && isMounted.current) {
          showNotification(`⚠️ Failed to sync ${failCount} records. Will retry later.`, 'warning');
        }
      }
    };
    
    window.addEventListener('online', syncOfflineData);
    return () => window.removeEventListener('online', syncOfflineData);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await startBatchProcess();
  };
  
  const handleGoBack = () => {
    if (batchActive) {
      const confirmStop = window.confirm('Batch is in progress. Stopping will CANCEL all unprocessed rolls. Are you sure?');
      if (confirmStop) {
        stopBatch();
        navigate(-1);
      }
    } else {
      const hasUnsavedChanges = Object.values(formData).some(value => 
        value !== '' && value !== new Date().toISOString().split('T')[0]
      );
      
      if (hasUnsavedChanges) {
        const confirmLeave = window.confirm('You have unsaved changes. Are you sure you want to leave?');
        if (confirmLeave) {
          navigate(-1);
        }
      } else {
        navigate(-1);
      }
    }
  };

  const handleGoHome = () => {
    if (batchActive) {
      const confirmStop = window.confirm('Batch is in progress. Stopping will CANCEL all unprocessed rolls. Are you sure?');
      if (confirmStop) {
        stopBatch();
        navigate('/');
      }
    } else {
      const hasUnsavedChanges = Object.values(formData).some(value => 
        value !== '' && value !== new Date().toISOString().split('T')[0]
      );
      
      if (hasUnsavedChanges) {
        const confirmLeave = window.confirm('You have unsaved changes. Are you sure you want to leave?');
        if (confirmLeave) {
          navigate('/');
        }
      } else {
        navigate('/');
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('isAuthenticated');
    navigate('/login');
  };

  const handleReset = async () => {
    if (!isMounted.current) return;
    
    if (window.confirm('Do you want to start a new batch?')) {
      setBatchNumber('');
      setBatchDate(new Date().toISOString().split('T')[0]);
      setBatchTime(new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setPurchaseOrderNo('');
      setDeliveryNoteNo('');
      setSupplierInvoiceNo('');
      setWaitingForRollRemoval(false);
      
      setFormData({
        cmfName: '',
        fabricName: '',
        group: '',
        shade: '',
        weight: '',
        lotNumber: '',
        billNumber: '',
        date: new Date().toISOString().split('T')[0],
        location: '',
        receivedPerson: '',
        authorizedPerson: ''
      });
      setSubmittedData(null);
      setCurrentWeight('0.00');
      setLastStableWeight('0.00');
      setIsWeightStable(false);
      setBatchMode(false);
      setBatchActive(false);
      setTotalRollsInBatch(1);
      setCurrentRollNumber(0);
      setCompletedRolls([]);
      setBatchInfo(null);
      setShowStopConfirm(false);
      setNextBarcodeId(null);
      setBarcodeSequence({
        current: 0,
        next: 1,
        lastGenerated: null
      });
      setConsecutiveSameWeight(0);
      setWeightHistory([]);
      consecutiveCountRef.current = 0;
      lastWeightRef.current = null;
      stableWeightValueRef.current = null;
      updateInstruction('Ready to start a new batch. Fill in the details and click "Start Batch"', 'info');
      await loadNextBarcodeId();
    }
  };

  // Get instruction color based on type
  const getInstructionColor = () => {
    switch(instructionType) {
      case 'success': return '#10b981';
      case 'error': return '#ef4444';
      case 'warning': return '#f59e0b';
      default: return '#1a237e';
    }
  };

  // Debug function to check batch status
// Debug function to check batch status
const checkBatchStatus = () => {
  console.log('🔍 BATCH STATUS CHECK:');
  console.log('batchActive:', batchActive);
  console.log('currentRollNumber:', currentRollNumber);
  console.log('totalRollsInBatch:', totalRollsInBatch);
  console.log('batchInfo:', batchInfo);
  console.log('waitingForRollRemoval:', waitingForRollRemoval);
  console.log('isProcessing:', isProcessing);
  console.log('connectionStatus:', connectionStatus);
  console.log('isConnected:', isConnected);
  
  // Show appropriate message based on mode
  if (connectionStatus === 'demo') {
    updateInstruction(`🎮 Demo Mode Active | Batch: ${batchActive ? 'YES' : 'NO'} | Roll: ${currentRollNumber}/${totalRollsInBatch}`, 'info');
    showNotification(`🎮 Demo Mode: Batch ${batchActive ? 'Active' : 'Inactive'} - Roll ${currentRollNumber}/${totalRollsInBatch}`, batchActive ? 'success' : 'warning');
  } else if (connectionStatus === 'connected') {
    updateInstruction(`📊 Scale Connected | Batch: ${batchActive ? 'YES' : 'NO'} | Roll: ${currentRollNumber}/${totalRollsInBatch}`, 'info');
    showNotification(`Scale Connected: Batch ${batchActive ? 'Active' : 'Inactive'} - Roll ${currentRollNumber}/${totalRollsInBatch}`, batchActive ? 'success' : 'info');
  } else {
    updateInstruction(`⚡ No Scale | Batch: ${batchActive ? 'YES' : 'NO'} | Roll: ${currentRollNumber}/${totalRollsInBatch}`, 'info');
    showNotification(`Batch ${batchActive ? 'Active' : 'Inactive'} - Roll ${currentRollNumber}/${totalRollsInBatch}`, batchActive ? 'success' : 'info');
  }
};

  // Component definitions
  const StickerPreview = ({ data }) => {
    if (!data || !data.uniqueBarcodeId) return null;
    
    return (
      <div style={{ 
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 999,
        background: 'white',
        padding: '8px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        border: '2px solid #10b981'
      }}>
        <div style={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '4px', textAlign: 'center' }}>
          Last Printed Sticker
        </div>
        <div style={{ fontSize: '16px', fontWeight: 'bold', fontFamily: 'monospace', textAlign: 'center', color: '#f59e0b' }}>
          {data.uniqueBarcodeId}
        </div>
        <div style={{ fontSize: '10px', textAlign: 'center', marginTop: '4px' }}>
          Roll {data.rollNumber} | {data.weight}KG
        </div>
        <div style={{ fontSize: '9px', textAlign: 'center', marginTop: '2px', color: '#6b7280' }}>
          {data.fabricName} - {data.shade}
        </div>
      </div>
    );
  };

  const BatchProgress = () => {
    if (!batchActive && completedRolls.length === 0) return null;
    
    const progress = (currentRollNumber / totalRollsInBatch) * 100;
    const remainingRolls = totalRollsInBatch - currentRollNumber;
    
    return (
      <div style={{
        position: 'fixed',
        top: '80px',
        right: '20px',
        zIndex: 1000,
        background: 'white',
        padding: '16px',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        minWidth: '320px',
        border: '2px solid #1a237e'
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '12px', color: '#1a237e' }}>
          📦 Batch Progress
        </div>
        <div style={{ marginBottom: '8px', padding: '8px', background: '#e8eaf6', borderRadius: '6px' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#1a237e' }}>{batchNumber}</div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Date: {batchDate} | Time: {batchTime}</div>
        </div>
        
        <div style={{ 
          marginBottom: '12px', 
          padding: '8px', 
          background: '#fff3e0', 
          borderRadius: '6px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '11px', fontWeight: '600', color: '#e65100' }}>Next Barcode ID</div>
          <div style={{ 
            fontSize: '24px', 
            fontWeight: 'bold', 
            fontFamily: 'monospace',
            color: '#f59e0b',
            letterSpacing: '2px'
          }}>
            {isLoadingSequence ? '...' : (nextBarcodeId || 'Loading')}
          </div>
          <div style={{ fontSize: '10px', color: '#ef6c00' }}>
            Sequential #{barcodeSequence.next}
          </div>
        </div>
        
        <div style={{ marginBottom: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
            <span>Progress</span>
            <span>{currentRollNumber} of {totalRollsInBatch} rolls</span>
          </div>
          <div style={{
            background: '#e2e8f0',
            height: '8px',
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <div style={{
              background: 'linear-gradient(90deg, #1a237e, #283593)',
              height: '100%',
              width: `${progress}%`,
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
        
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          fontSize: '11px', 
          marginTop: '8px',
          marginBottom: '12px',
          padding: '4px',
          background: '#f1f5f9',
          borderRadius: '4px'
        }}>
          <span style={{ color: '#1a237e' }}>✅ Completed: {currentRollNumber}</span>
          <span style={{ color: '#ef4444' }}>⏳ Remaining: {remainingRolls}</span>
        </div>
        
        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
          Last printed: Roll {lastPrintedRoll || '—'}
        </div>
        
        {batchActive && (
          <div style={{ marginTop: '12px' }}>
            {!showStopConfirm ? (
              <button
                onClick={() => setShowStopConfirm(true)}
                style={{
                  width: '100%',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '12px',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#dc2626'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#ef4444'}
              >
                ⛔ Stop & Cancel Remaining Rolls
              </button>
            ) : (
              <div style={{
                background: '#fee2e2',
                padding: '8px',
                borderRadius: '6px',
                border: '1px solid #ef4444'
              }}>
                <div style={{ fontSize: '11px', color: '#991b1b', marginBottom: '8px', fontWeight: '500' }}>
                  ⚠️ This will CANCEL/DELETE the remaining {remainingRolls} rolls. 
                  Only {currentRollNumber} completed rolls will be saved.
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={stopBatch}
                    style={{
                      flex: 1,
                      background: '#ef4444',
                      color: 'white',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      fontSize: '11px'
                    }}
                  >
                    Yes, Cancel & Stop
                  </button>
                  <button
                    onClick={cancelStopBatch}
                    style={{
                      flex: 1,
                      background: '#e2e8f0',
                      color: '#475569',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      fontSize: '11px'
                    }}
                  >
                    No, Continue Batch
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        
        {completedRolls.length > 0 && (
          <details style={{ marginTop: '12px' }}>
            <summary style={{ cursor: 'pointer', color: '#1a237e', fontSize: '11px', fontWeight: '500' }}>
              🏷️ Completed Barcode IDs ({completedRolls.length})
            </summary>
            <div style={{ marginTop: '8px', maxHeight: '200px', overflowY: 'auto' }}>
              {completedRolls.map((roll, idx) => (
                <div key={idx} style={{ 
                  padding: '6px 4px', 
                  borderBottom: '1px solid #e2e8f0',
                  fontSize: '11px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '600', color: '#1a237e' }}>Roll {roll.rollNumber}:</span>
                    <span style={{ 
                      fontFamily: 'monospace', 
                      fontWeight: 'bold', 
                      fontSize: '13px',
                      color: '#10b981',
                      letterSpacing: '1px'
                    }}>
                      {roll.barcodeId}
                    </span>
                  </div>
                  <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>
                    ⏰ {roll.timestamp} | ⚖️ {roll.weight} KG | {roll.fabricName} - {roll.shade}
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}
        
        {batchActive && (
          <div style={{ fontSize: '11px', color: '#1a237e', marginTop: '8px', padding: '4px', background: '#e8eaf6', borderRadius: '4px' }}>
            ✨ Sequential barcode IDs (6-digit format: 000001, 000002, ...)
          </div>
        )}
      </div>
    );
  };

  const PrintServiceIndicator = () => (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      left: '20px',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      background: 'white',
      padding: '6px 12px',
      borderRadius: '20px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      fontSize: '11px',
      fontWeight: '500'
    }}>
      <div style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: printServiceStatus === 'ready' ? '#10b981' : 
                   printServiceStatus === 'connected' ? '#f59e0b' : 
                   printServiceStatus === 'error' ? '#ef4444' : '#6b7280',
        animation: printServiceStatus === 'connected' ? 'pulse 1s infinite' : 'none'
      }} />
      <span>
        {printServiceStatus === 'ready' ? '✓ Print Service Ready' :
         printServiceStatus === 'connected' ? 'Connecting...' :
         printServiceStatus === 'error' ? '✗ Print Service Error' : '○ Print Service Offline'}
      </span>
      {printQueueLength > 0 && (
        <span style={{
          background: '#1a237e',
          color: 'white',
          padding: '2px 6px',
          borderRadius: '10px',
          fontSize: '10px'
        }}>
          {printQueueLength}
        </span>
      )}
    </div>
  );

  // Get display name for logged in user
  const displayName = loggedInUser?.name || loggedInUser?.id || 'User';
  const avatarInitial = (loggedInUser?.name?.charAt(0) || loggedInUser?.id?.charAt(0) || 'U').toUpperCase();

  // MAIN RENDER
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #004b96 0%, #004b7a 100%)',
      fontFamily: "'Inter', 'Segoe UI', system-ui"
    }}>
      {/* Navbar */}
      <nav style={{
        background: 'rgba(0, 0, 0, 0.95)',
        backdropFilter: 'blur(10px)',
        padding: '12px 24px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          maxWidth: '2400px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '28px' }}>🏭</span>
            <span style={{ fontSize: '20px', fontWeight: '700', color: 'white' }}>FabricFlow</span>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/dashboard')} style={{ background: 'rgba(25, 0, 165, 0.1)', border: 'none', padding: '8px 16px', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>
              📊 Dashboard
            </button>
            <button onClick={() => navigate('/create-sticker')} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', padding: '8px 16px', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>
              🏷️ Stock Entry
            </button>
            <button onClick={() => navigate('/fabric-issue')} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', padding: '8px 16px', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>
              🚚 Fabric Issue
            </button>
            <button onClick={() => navigate('/stock-reports')} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', padding: '8px 16px', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>
              📈 Reports
            </button>
          </div>

          <div style={{ position: 'relative' }}>
            <button onClick={() => setUserMenuOpen(!userMenuOpen)} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', padding: '8px 16px', borderRadius: '12px', cursor: 'pointer' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #1a237e 0%, #283593 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px', color: 'white' }}>
                {avatarInitial}
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'white' }}>{displayName}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{loggedInUser?.role || 'User'}</div>
              </div>
              <span style={{ color: '#94a3b8', fontSize: '12px' }}>▼</span>
            </button>

            {userMenuOpen && (
              <>
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }} onClick={() => setUserMenuOpen(false)} />
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', background: 'white', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', minWidth: '220px', zIndex: 100, overflow: 'hidden' }}>
                  <div style={{ padding: '16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: '600', color: '#1a237e' }}>{displayName}</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>{loggedInUser?.role}</div>
                  </div>
                  <button onClick={() => { setUserMenuOpen(false); navigate('/dashboard'); }} style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '12px 16px', border: 'none', background: 'white', cursor: 'pointer' }}>
                    <span>📊</span> <span>Dashboard</span>
                  </button>
                  <button onClick={() => { setUserMenuOpen(false); handleLogout(); }} style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '12px 16px', border: 'none', background: 'white', cursor: 'pointer', color: '#ef4444', borderTop: '1px solid #e2e8f0' }}>
                    <span>🚪</span> <span>Logout</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </nav>

      <PrintServiceIndicator />
      <BatchProgress />
      <StickerPreview data={submittedData} />
      
      <iframe ref={iframeRef} style={{ position: 'absolute', width: '0', height: '0', border: '0', visibility: 'hidden' }} title="thermal-print-frame" />

      <div style={{ maxWidth: '2400px', margin: '0 auto', background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ background: 'linear-gradient(135deg, #0062c4 0%, #0d2b3e 100%)', padding: '9px 20px', color: 'white' }}>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <button onClick={handleGoBack} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.3)', padding: '8px 20px', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
              ← Back
            </button>
            <button onClick={handleGoHome} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.2)', padding: '8px 20px', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
              🏠 Home
            </button>
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '8px', textAlign: 'center' }}>🧵 Fabric Roll Management System</h1>
          {isProcessing && <div style={{ marginTop: '8px', fontSize: '12px', color: '#f59e0b' }}>⏳ Processing...</div>}
          {batchActive && !waitingForRollRemoval && currentRollNumber < totalRollsInBatch && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#10b981' }}>🎯 Batch Active - Place roll {currentRollNumber + 1} of {totalRollsInBatch} on scale</div>
          )}
          {waitingForRollRemoval && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#f59e0b', animation: 'pulse 1s ease-in-out' }}>⚠️ Processing - Please wait...</div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0', minHeight: '650px' }}>
          
          {/* LEFT COLUMN - WEIGHING SCALE DISPLAY */}
          <div style={{ background: 'linear-gradient(135deg, #ffffff 0%, #ffffff 100%)', padding: '32px', borderRight: '2px solid #e2e8f0' }}>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.8rem', fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px', color: '#1a237e' }}>
                <span>⚖️</span> Fabric Roll Scale
              </h2>
              <p style={{ color: '#475569' }}>Place fabric roll on scale. Press ENTER to print sticker</p>
            </div>

            {/* UI Instruction Banner */}
            {uiInstruction && (
              <div style={{
                marginBottom: '20px',
                padding: '16px',
                background: `${getInstructionColor()}10`,
                borderLeft: `4px solid ${getInstructionColor()}`,
                borderRadius: '8px',
                animation: 'slideIn 0.3s ease-out'
              }}>
                <div style={{ 
                  fontSize: '14px', 
                  fontWeight: '600', 
                  color: getInstructionColor(),
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span>{instructionType === 'success' ? '✓' : instructionType === 'error' ? '⚠️' : instructionType === 'warning' ? '📢' : 'ℹ️'}</span>
                  <span>{uiInstruction}</span>
                </div>
              </div>
            )}

            {/* ENTER Key Hint */}
            {batchActive && parseFloat(currentWeight) >= 1.0 && !waitingForRollRemoval && !isProcessing && currentRollNumber < totalRollsInBatch && (
              <div style={{
                marginBottom: '20px',
                padding: '16px',
                background: '#d1fae5',
                borderRadius: '12px',
                textAlign: 'center',
                border: '2px solid #10b981',
                animation: 'pulse 1s ease-in-out'
              }}>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#065f46' }}>
                  ⌨️ Press <kbd style={{ background: '#065f46', color: 'white', padding: '8px 16px', borderRadius: '8px', margin: '0 8px', fontSize: '18px' }}>ENTER</kbd> to Print Sticker
                </div>
                <div style={{ fontSize: '14px', color: '#065f46', marginTop: '8px' }}>
                  Current Weight: <strong>{currentWeight} KG</strong>
                </div>
              </div>
            )}

            {/* Place Roll Banner */}
            {batchActive && !waitingForRollRemoval && currentRollNumber < totalRollsInBatch && parseFloat(currentWeight) < 0.5 && !isProcessing && (
              <div style={{
                marginBottom: '20px',
                padding: '16px',
                background: '#d1fae5',
                borderLeft: '4px solid #10b981',
                borderRadius: '8px'
              }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#065f46', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>💡</span>
                  <span>Place roll {currentRollNumber + 1} of {totalRollsInBatch} on the scale</span>
                </div>
              </div>
            )}

            {/* Processing Banner */}
            {(isProcessing || waitingForRollRemoval) && (
              <div style={{
                marginBottom: '20px',
                padding: '16px',
                background: '#fef3c7',
                borderLeft: '4px solid #f59e0b',
                borderRadius: '8px'
              }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>⏳</span>
                  <span>Processing your request. Please wait...</span>
                </div>
              </div>
            )}

            <div style={{
              background: '#1e293b',
              borderRadius: '32px',
              padding: '48px 32px',
              marginBottom: '24px',
              textAlign: 'center',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              border: (batchActive && parseFloat(currentWeight) >= 1.0 && !waitingForRollRemoval && !isProcessing) ? '4px solid #10b981' : '3px solid #6b7280'
            }}>
              <div style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '16px', letterSpacing: '2px' }}>FABRIC ROLL WEIGHT</div>
              
              <div className="weight-value" style={{
                fontSize: '96px',
                fontWeight: 'bold',
                color: (parseFloat(currentWeight) >= 1.0 && !waitingForRollRemoval) ? '#10b981' : '#f59e0b',
                fontFamily: "'Courier New', monospace",
                letterSpacing: '4px',
                transition: 'all 0.3s ease',
                lineHeight: '1'
              }}>
                {currentWeight}
              </div>
              
              <div style={{ fontSize: '20px', color: '#94a3b8', marginTop: '16px' }}>Kilograms (KG)</div>

              <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: (parseFloat(currentWeight) >= 1.0 && !waitingForRollRemoval) ? '#10b981' : '#6b7280', animation: isReading ? 'pulse 0.5s ease-in-out' : 'none' }}></div>
                <span style={{ fontSize: '14px', color: '#cbd5e1' }}>
                  {batchActive && parseFloat(currentWeight) >= 1.0 && !waitingForRollRemoval && !isProcessing ? '✅ Press ENTER to print' : 
                   batchActive && (isProcessing || waitingForRollRemoval) ? '⏳ Processing...' :
                   batchActive && parseFloat(currentWeight) > 0 ? `⚡ Reading weight...` :
                   batchActive && currentRollNumber < totalRollsInBatch ? `⏳ Place roll ${currentRollNumber + 1} of ${totalRollsInBatch}` :
                   batchActive && currentRollNumber >= totalRollsInBatch ? '🎉 Batch complete!' :
                   !batchActive ? '⚡ Start a batch to begin' : 'Waiting for scale'}
                </span>
              </div>
            </div>

            <div style={{ background: 'white', borderRadius: '20px', padding: '24px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <span style={{ fontWeight: '600', color: '#1a237e' }}>Scale Status</span>
                <span style={{ padding: '4px 12px', borderRadius: '20px', background: connectionStatus === 'connected' ? '#d1fae5' : connectionStatus === 'demo' ? '#fef3c7' : '#fee2e2', color: connectionStatus === 'connected' ? '#065f46' : connectionStatus === 'demo' ? '#92400e' : '#991b1b', fontSize: '12px', fontWeight: '600' }}>
                  {connectionStatus === 'connected' ? '● Connected' : connectionStatus === 'demo' ? '● Demo Mode' : connectionStatus === 'connecting' ? '● Connecting...' : '○ Disconnected'}
                </span>
              </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
  {!isConnected || connectionStatus === 'demo' ? (
    <>
    // Add this button in the scale status section (around line where other buttons are)
<button
  onClick={() => {
    console.log('Testing print service connection...');
    if (wsRef.current) {
      console.log('WebSocket state:', wsRef.current.readyState);
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'status',
          token: 'fabric-print-secret-key-2024'
        }));
        showNotification('Test message sent to print service', 'info');
      } else {
        showNotification('WebSocket not open. Current state: ' + wsRef.current.readyState, 'warning');
      }
    } else {
      showNotification('WebSocket not initialized. Reconnecting...', 'warning');
      connectToPrintService();
    }
  }}
  style={{
    width: '100%',
    background: '#6b7280',
    color: 'white',
    border: 'none',
    padding: '10px',
    borderRadius: '8px',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '13px',
    marginTop: '10px'
  }}
>
  🔧 Test Print Service
</button>
      <button 
        onClick={connectToScale} 
        style={{ flex: 1, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '12px', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
      >
        🔌 Connect USB Scale
      </button>
      {connectionStatus !== 'demo' ? (
        <button 
          onClick={startDemoMode} 
          style={{ flex: 1, background: 'linear-gradient(135deg, #1a237e 0%, #283593 100%)', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '12px', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          🎮 Demo Mode
        </button>
      ) : (
        <button 
          onClick={stopDemoMode} 
          style={{ flex: 1, background: '#ef4444', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '12px', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          ⏹️ Stop Demo
        </button>
      )}
    </>
  ) : (
    <>
      <button 
        onClick={disconnectScale} 
        style={{ flex: 1, background: '#ef4444', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '12px', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
      >
        🔌 Disconnect
      </button>
      <button 
        onClick={resetSerialConnection} 
        style={{ flex: 1, background: '#f59e0b', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '12px', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        title="Reset serial connection (or press Ctrl+Shift+R)"
      >
        🔄 Reset Connection
      </button>
    </>
  )}
</div>

              <button
                onClick={checkBatchStatus}
                style={{
                  width: '100%',
                  background: '#1a237e',
                  color: 'white',
                  border: 'none',
                  padding: '10px',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '13px',
                  marginTop: '10px'
                }}
              >
                🔍 Check Batch Status
              </button>

              {errorMessage && <div style={{ marginTop: '16px', padding: '12px', background: '#fee2e2', borderRadius: '8px', color: '#dc2626', fontSize: '13px' }}>⚠️ {errorMessage}</div>}
              
              {batchActive && (
                <div style={{ marginTop: '16px', padding: '12px', background: '#e0e7ff', borderRadius: '8px', borderLeft: '3px solid #1a237e' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#1a237e', marginBottom: '4px' }}>📊 Batch Progress</div>
                  <div style={{ fontSize: '13px', color: '#4338ca' }}>Roll {currentRollNumber} of {totalRollsInBatch} completed</div>
                  <div style={{ marginTop: '8px', background: '#c7d2fe', height: '4px', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ background: '#1a237e', height: '100%', width: `${(currentRollNumber / totalRollsInBatch) * 100}%`, transition: 'width 0.3s ease' }} />
                  </div>
                </div>
              )}
            </div>

        <div style={{ 
  marginTop: '16px', 
  padding: '20px', 
  background: '#f8fafc', 
  borderRadius: '12px', 
  border: '1px solid #e2e8f0',
  transition: 'all 0.2s ease'
}}
onMouseEnter={(e) => { 
  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
}}
onMouseLeave={(e) => { 
  e.currentTarget.style.boxShadow = 'none';
}}>
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
    <span style={{ fontSize: '18px' }}>📋</span>
    <strong style={{ color: '#0f172a', fontSize: '14px' }}>Quick Tips</strong>
  </div>
  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#475569', padding: '6px 0' }}>
      <span style={{ color: '#10b981', fontWeight: '600' }}>✓</span> Weight displays in real-time from the connected scale
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#475569', padding: '6px 0' }}>
      <span style={{ color: '#10b981', fontWeight: '600' }}>✓</span> Press ENTER as soon as weight is stable
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#475569', padding: '6px 0' }}>
      <span style={{ color: '#10b981', fontWeight: '600' }}>✓</span> System automatically resets to 0 after each print
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#475569', padding: '6px 0' }}>
      <span style={{ color: '#10b981', fontWeight: '600' }}>✓</span> Ready for next roll - no manual reset needed
    </div>
  </div>
</div>

            <div style={{ marginTop: '16px', padding: '16px', background: '#fff', borderRadius: '8px', borderLeft: '4px solid #f59e0b', transition: 'all 0.3s ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateX(5px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateX(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span style={{ fontSize: '20px', animation: 'wiggle 3s ease-in-out infinite', display: 'inline-block' }}>📢</span>
                <strong style={{ color: '#92400e' }}>Pro Tips:</strong>
              </div>
              <div style={{ fontSize: '12px', color: '#78350f' }}>
                <div style={{ marginBottom: '8px', transition: 'all 0.3s ease', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#fef3c7'; e.currentTarget.style.paddingLeft = '12px'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.paddingLeft = '4px'; }}>
                  <span style={{ display: 'inline-block', marginRight: '8px' }}>✓</span> Weight shows in real-time from the scale
                </div>
                <div style={{ marginBottom: '8px', transition: 'all 0.3s ease', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#fef3c7'; e.currentTarget.style.paddingLeft = '12px'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.paddingLeft = '4px'; }}>
                  <span style={{ display: 'inline-block', marginRight: '8px' }}>✓</span> Press ENTER as soon as weight is displayed
                </div>
                <div style={{ marginBottom: '8px', transition: 'all 0.3s ease', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#fef3c7'; e.currentTarget.style.paddingLeft = '12px'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.paddingLeft = '4px'; }}>
                  <span style={{ display: 'inline-block', marginRight: '8px' }}>✓</span> System automatically resets to 0 after each print
                </div>
                <div style={{ transition: 'all 0.3s ease', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#fef3c7'; e.currentTarget.style.paddingLeft = '12px'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.paddingLeft = '4px'; }}>
                  <span style={{ display: 'inline-block', marginRight: '8px' }}>✓</span> Ready for next roll immediately - no manual reset needed!
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN - FORM SECTION */}
        <div style={{ background: 'white', padding: '32px', overflowY: 'auto', maxHeight: 'calc(100vh - 120px)' }}>
  <form onSubmit={handleSubmit}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', marginBottom: '28px' }}>
      <div>
        <label style={{ fontWeight: '600', display: 'block', marginBottom: '8px', color: '#1a237e' }}>CMP Name <span style={{ color: '#ef4444' }}>*</span></label>
        <input 
          type="text" 
          name="cmfName" 
          value={formData.cmfName} 
          onChange={handleChange} 
          placeholder="e.g., COTTON MODAL FUSION" 
          required 
          disabled={batchActive} 
          style={{ 
            width: '90%', 
            padding: '10px 14px', 
            borderRadius: '10px', 
            border: '2px solid #e2e8f0', 
            fontSize: '14px', 
            opacity: batchActive ? 0.6 : 1,
            textTransform: 'uppercase'
          }} 
        />
      </div>
      
      <div>
        <label style={{ fontWeight: '600', display: 'block', marginBottom: '8px', color: '#1a237e' }}>Fabric Name <span style={{ color: '#ef4444' }}>*</span></label>
        <input 
          type="text" 
          name="fabricName" 
          value={formData.fabricName} 
          onChange={handleChange} 
          placeholder="e.g., SATIN WEAVE" 
          required 
          disabled={batchActive} 
          style={{ 
            width: '90%', 
            padding: '10px 14px', 
            borderRadius: '10px', 
            border: '2px solid #e2e8f0', 
            fontSize: '14px', 
            opacity: batchActive ? 0.6 : 1,
            textTransform: 'uppercase'
          }} 
        />
      </div>
      
      <div>
        <label style={{ fontWeight: '600', display: 'block', marginBottom: '8px', color: '#1a237e' }}>Group</label>
        <input 
          type="text" 
          name="group" 
          value={formData.group} 
          onChange={handleChange} 
          placeholder="e.g., SUMMER COLLECTION" 
          disabled={batchActive} 
          style={{ 
            width: '90%', 
            padding: '10px 14px', 
            borderRadius: '10px', 
            border: '2px solid #e2e8f0', 
            fontSize: '14px', 
            opacity: batchActive ? 0.6 : 1,
            textTransform: 'uppercase'
          }} 
        />
      </div>
      
      <div>
        <label style={{ fontWeight: '600', display: 'block', marginBottom: '8px', color: '#1a237e' }}>Shade <span style={{ color: '#ef4444' }}>*</span></label>
        <input 
          type="text" 
          name="shade" 
          value={formData.shade} 
          onChange={handleChange} 
          placeholder="e.g., NAVY BLUE" 
          required 
          disabled={batchActive} 
          style={{ 
            width: '90%', 
            padding: '10px 14px', 
            borderRadius: '10px', 
            border: '2px solid #e2e8f0', 
            fontSize: '14px', 
            opacity: batchActive ? 0.6 : 1,
            textTransform: 'uppercase'
          }} 
        />
      </div>
      
      <div>
        <label style={{ fontWeight: '600', display: 'block', marginBottom: '8px', color: '#1a237e' }}>Roll Weight (KG) <span style={{ color: '#10b981' }}>⚡ Auto from scale</span></label>
        <input 
          type="text" 
          name="weight" 
          value={formData.weight} 
          onChange={handleChange} 
          placeholder="Auto-fills from scale" 
          style={{ 
            width: '90%', 
            padding: '10px 14px', 
            borderRadius: '10px', 
            border: '2px solid #10b981', 
            fontSize: '14px', 
            background: '#f0fdf4', 
            fontWeight: 'bold', 
            color: '#065f46' 
          }} 
          readOnly 
        />
        {batchActive && currentRollNumber > 0 && <div style={{ fontSize: '11px', color: '#059669', marginTop: '4px' }}>✓ Next roll: {currentRollNumber + 1} of {totalRollsInBatch}</div>}
      </div>
      
      <div>
        <label style={{ fontWeight: '600', display: 'block', marginBottom: '8px', color: '#1a237e' }}>Lot Number <span style={{ color: '#ef4444' }}>*</span></label>
        <input 
          type="text" 
          name="lotNumber" 
          value={formData.lotNumber} 
          onChange={handleChange} 
          placeholder="e.g., LOT-2410-01" 
          required 
          disabled={batchActive} 
          style={{ 
            width: '90%', 
            padding: '10px 14px', 
            borderRadius: '10px', 
            border: '2px solid #e2e8f0', 
            fontSize: '14px', 
            opacity: batchActive ? 0.6 : 1,
            textTransform: 'uppercase'
          }} 
        />
      </div>
      
      <div>
        <label style={{ fontWeight: '600', display: 'block', marginBottom: '8px', color: '#1a237e' }}>Bill Number</label>
        <input 
          type="text" 
          name="billNumber" 
          value={formData.billNumber} 
          onChange={handleChange} 
          placeholder="e.g., INV-98765" 
          disabled={batchActive} 
          style={{ 
            width: '90%', 
            padding: '10px 14px', 
            borderRadius: '10px', 
            border: '2px solid #e2e8f0', 
            fontSize: '14px', 
            opacity: batchActive ? 0.6 : 1,
            textTransform: 'uppercase'
          }} 
        />
      </div>
      
      <div>
        <label style={{ fontWeight: '600', display: 'block', marginBottom: '8px', color: '#1a237e' }}>Location <span style={{ color: '#f59e0b' }}>(Recommended)</span></label>
        <input 
          type="text" 
          name="location" 
          value={formData.location} 
          onChange={handleChange} 
          placeholder="e.g., WAREHOUSE A, SECTION 5" 
          disabled={batchActive} 
          style={{ 
            width: '90%', 
            padding: '10px 14px', 
            borderRadius: '10px', 
            border: '2px solid #e2e8f0', 
            fontSize: '14px', 
            opacity: batchActive ? 0.6 : 1,
            textTransform: 'uppercase'
          }} 
        />
      </div>
      
      <div>
        <label style={{ fontWeight: '600', display: 'block', marginBottom: '8px', color: '#1a237e' }}>Received By</label>
        <input 
          type="text" 
          name="receivedPerson" 
          value={formData.receivedPerson} 
          onChange={handleChange} 
          placeholder="e.g., JOHN SMITH" 
          disabled={batchActive} 
          style={{ 
            width: '90%', 
            padding: '10px 14px', 
            borderRadius: '10px', 
            border: '2px solid #e2e8f0', 
            fontSize: '14px', 
            opacity: batchActive ? 0.6 : 1,
            textTransform: 'uppercase'
          }} 
        />
      </div>
      
      <div>
        <label style={{ fontWeight: '600', display: 'block', marginBottom: '8px', color: '#1a237e' }}>Authorized By</label>
        <input 
          type="text" 
          name="authorizedPerson" 
          value={formData.authorizedPerson} 
          onChange={handleChange} 
          placeholder="e.g., SARAH JOHNSON" 
          disabled={batchActive} 
          style={{ 
            width: '90%', 
            padding: '10px 14px', 
            borderRadius: '10px', 
            border: '2px solid #e2e8f0', 
            fontSize: '14px', 
            opacity: batchActive ? 0.6 : 1,
            textTransform: 'uppercase'
          }} 
        />
      </div>
      
      <div>
        <label style={{ fontWeight: '600', display: 'block', marginBottom: '8px', color: '#1a237e' }}>Date</label>
        <input 
          type="date" 
          name="date" 
          value={formData.date} 
          onChange={handleChange} 
          disabled={batchActive} 
          style={{ 
            width: '90%', 
            padding: '10px 14px', 
            borderRadius: '10px', 
            border: '2px solid #e2e8f0', 
            fontSize: '14px', 
            opacity: batchActive ? 0.6 : 1 
          }} 
        />
      </div>
    </div>

    <div style={{ marginBottom: '24px', padding: '16px', background: '#e8eaf6', borderRadius: '12px', border: '2px solid #1a237e' }}>
      <label style={{ fontWeight: '600', display: 'block', marginBottom: '8px', color: '#1a237e' }}>📦 Total Number of Rolls in Batch <span style={{ color: '#ef4444' }}>*</span></label>
      <input 
        type="number" 
        name="totalRollsInBatch" 
        value={totalRollsInBatch} 
        onChange={(e) => setTotalRollsInBatch(parseInt(e.target.value) || 1)} 
        placeholder="Enter total number of rolls" 
        disabled={batchActive} 
        min="1" 
        max="100" 
        style={{ 
          width: '100%', 
          padding: '12px 16px', 
          borderRadius: '10px', 
          border: '2px solid #1a237e', 
          fontSize: '16px', 
          fontWeight: 'bold', 
          background: batchActive ? '#f1f5f9' : 'white' 
        }} 
      />
      <p style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
        Each roll will receive a unique sequential 6-digit barcode ID (auto-incremented from last used)
      </p>
      {nextBarcodeId && (
        <p style={{ fontSize: '12px', color: '#059669', marginTop: '4px' }}>
          Next barcode ID: <strong>{nextBarcodeId}</strong> (Sequence #{barcodeSequence.next})
        </p>
      )}
    </div>

    <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
      <button 
        type="submit" 
        disabled={batchActive || isLoadingSequence} 
        style={{ 
          flex: 1, 
          background: batchActive || isLoadingSequence ? '#94a3b8' : 'linear-gradient(135deg, #1a237e 0%, #283593 100%)', 
          color: 'white', 
          border: 'none', 
          padding: '14px 28px', 
          borderRadius: '12px', 
          fontWeight: '600', 
          cursor: batchActive || isLoadingSequence ? 'not-allowed' : 'pointer', 
          fontSize: '16px' 
        }}
      >
        {isLoadingSequence ? 'Loading Sequence...' : (batchActive ? 'Batch Active...' : '🎯 Start Batch')}
      </button>
      <button 
        type="button" 
        onClick={handleReset} 
        disabled={batchActive} 
        style={{ 
          flex: 1, 
          background: '#f1f5f9', 
          border: '2px solid #e2e8f0', 
          padding: '14px 28px', 
          borderRadius: '12px', 
          fontWeight: '600', 
          cursor: batchActive ? 'not-allowed' : 'pointer', 
          color: '#475569', 
          opacity: batchActive ? 0.5 : 1 
        }}
      >
        ⟳ New Batch
      </button>
    </div>
    
    {batchActive && (
      <div style={{ marginTop: '16px', padding: '12px', background: '#e8eaf6', borderRadius: '8px', textAlign: 'center', fontSize: '13px', color: '#1a237e' }}>
        ⚡ Press <kbd style={{background: '#1a237e', color: 'white', padding: '2px 8px', borderRadius: '4px', margin: '0 4px'}}>ENTER</kbd> to print sticker - System auto-resets to 0 after each print!
      </div>
    )}
  </form>
</div>
        </div>

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.8; transform: scale(1.02); }
          }
          @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
          @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
          }
          @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-5px); }
          }
          @keyframes slideInRight {
            from { opacity: 0; transform: translateX(-30px); }
            to { opacity: 1; transform: translateX(0); }
          }
          @keyframes shake {
            0%, 100% { transform: rotate(0deg); }
            25% { transform: rotate(5deg); }
            75% { transform: rotate(-5deg); }
          }
          @keyframes wiggle {
            0%, 100% { transform: rotate(0deg); }
            25% { transform: rotate(10deg); }
            75% { transform: rotate(-10deg); }
          }
          @keyframes loading {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
          kbd {
            font-family: monospace;
            font-weight: bold;
          }
        `}</style>
      </div>
    </div>
  );
};

export default FabricStickerForm;