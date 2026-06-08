import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../Design/Dashboard.css';

function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [sheetData, setSheetData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState('');

  // HARDCODED CREDENTIALS
  const API_KEY = 'AIzaSyAomDFBkOySlIxKWSKGHe6ATv9gvaBr7uk';
  const SPREADSHEET_ID = '1AWXnXcJXIiUCwhV2CbucuuKqwQbtEdmrszntAyQr7RQ';
  const SHEET_NAME = 'Fabric Roll Data';

  // Function to get greeting based on time of day
  const getGreeting = () => {
    const currentHour = new Date().getHours();
    
    if (currentHour >= 5 && currentHour < 12) {
      return 'Good Morning';
    } else if (currentHour >= 12 && currentHour < 17) {
      return 'Good Afternoon';
    } else if (currentHour >= 17 && currentHour < 22) {
      return 'Good Evening';
    } else {
      return 'Good Night';
    }
  };

  // Function to fetch data from Google Sheets
  const fetchGoogleSheetsData = async () => {
    try {
      const range = `${SHEET_NAME}!A:Z`;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?key=${API_KEY}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.values && data.values.length > 0) {
        const headers = data.values[0];
        const rows = data.values.slice(1);
        
        const formattedData = rows.map(row => {
          let obj = {};
          headers.forEach((header, index) => {
            obj[header] = row[index] || '';
          });
          return obj;
        });
        
        setSheetData(formattedData);
        console.log('Data fetched successfully:', formattedData.length, 'records');
      }
    } catch (error) {
      console.error('Error fetching Google Sheets data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get logged in user data and set greeting
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    } else {
      setUser({ name: 'Selena', role: 'Inventory Manager' });
    }
    
    // Set initial greeting
    setGreeting(getGreeting());
    
    // Update greeting every minute
    const interval = setInterval(() => {
      setGreeting(getGreeting());
    }, 60000); // Check every minute
    
    // Fetch Google Sheets data
    fetchGoogleSheetsData();
    
    // Cleanup interval on component unmount
    return () => clearInterval(interval);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('isAuthenticated');
    navigate('/login');
  };

  // Calculate statistics from sheet data
  const calculateStats = () => {
    const completedBatches = sheetData.filter(item => item['Batch Status'] === 'completed').length;
    const partiallyIssued = sheetData.filter(item => item['Status'] === 'partially_issued').length;
    const totalMRNWT = sheetData.reduce((sum, item) => sum + (parseFloat(item['MRN WT']) || 0), 0);
    const totalBalWT = sheetData.reduce((sum, item) => sum + (parseFloat(item['Bal WT']) || 0), 0);
    
    return {
      totalBatches: sheetData.length,
      completedBatches,
      partiallyIssued,
      totalMRNWT: totalMRNWT.toFixed(1),
      totalBalWT: totalBalWT.toFixed(1)
    };
  };

  const stats = calculateStats();

  // Top fabrics from sheet data
  const topFabrics = sheetData.slice(0, 2).map(item => ({
    name: item['Item Description'] || 'N/A',
    stock: `${item['MRN WT'] || 0}${item['Unit'] || 'm'}`,
    date: item['Rect Date'] || 'N/A',
    progress: Math.min(100, ((parseFloat(item['Bal WT']) / parseFloat(item['MRN WT'])) * 100) || 0)
  }));

  // Recent transactions from sheet data
  const recentTransactions = sheetData.slice(0, 3).map((item, index) => ({
    id: index + 1,
    type: item['Status'] === 'partially_issued' ? 'Fabric Issue' : 'GRN Entry',
    description: `${item['Item Description']} to ${item['Store']}`,
    quantity: `${item['Issue Pkgs']}pkgs (${item['MRN WT']}${item['Unit']})`,
    dept: item['Store']
  }));

  // Active batches count
  const activeBatchesCount = sheetData.filter(item => item['Batch Status'] === 'active').length;
  const activeBatchesText = `${activeBatchesCount} Active Batches currently running in production. Ensure sticker data match physical lots.`;

  const menuItems = [
    { text: 'Dashboard', path: '/dashboard' },
    { text: 'Stock Entry', path: '/create-sticker' },
    // { text: 'GRN Entry', path: '/grn-entry' },
    { text: 'Fabric Report', path: '/stock-reports' },
    { text: 'Fabric Issue', path: '/fabric-issue' },
    { text: 'Sticker for Copy', path: '/digitalize-gatta' },
    { text: 'Copy Cutting Report', path: '/copy-cutting-report' },
  ];

  return (
    <div className="youcare-dashboard-wrapper">
      <div className="youcare-dashboard-container">
        
        {/* --- Top Navbar --- */}
        <header className="yc-navbar">
          <div className="yc-logo-section">
            <div className="yc-logo-icon">
              <span>★</span>
            </div>
            <span className="yc-logo-text">FabricFlow</span>
          </div>

          <nav className="yc-nav-links">
            {menuItems.map((item, index) => (
              <button 
                key={index} 
                className={`yc-nav-item ${item.text === 'Dashboard' ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
              >
                {item.text}
              </button>
            ))}
          </nav>

          <div className="yc-nav-actions">
            <button className="yc-icon-btn">⚙️</button>
            <button className="yc-icon-btn notification">
              🔔<span className="yc-dot"></span>
            </button>
            <div className="yc-user-profile-wrapper">
              <img 
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80" 
                alt="Profile" 
                className="yc-avatar"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
              />
              {userMenuOpen && (
                <div className="yc-dropdown-menu">
                  <button onClick={handleLogout} className="yc-dropdown-item logout">Logout 🚪</button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* --- Welcome Heading with Dynamic Greeting --- */}
        <div className="yc-welcome-section">
          <h1 className="yc-greeting">{greeting}, {user?.name?.split(' ')[0] || 'User'}!</h1>
          <button className="yc-btn-primary" onClick={() => navigate('/create-sticker')}>+ Check new</button>
        </div>

        {/* --- Sub-Filter Actions Bar --- */}
        <div className="yc-filter-bar">
          <div className="yc-filter-left">
            <button className="yc-btn-secondary">🎛 Filter</button>
            <button className="yc-btn-secondary">📅 Monthly ▾</button>
            <button className="yc-btn-secondary">📥 Download Data</button>
          </div>
          <div className="yc-filter-right">
            <button className="yc-icon-circle-btn">🔍</button>
            <button className="yc-btn-secondary">👤 Support</button>
            <button className="yc-btn-secondary">⚃ Content Layout</button>
          </div>
        </div>

        {/* Loading Indicator */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            Loading data .......
          </div>
        )}

        {/* --- Dashboard Content Grid --- */}
        {!loading && (
          <div className="yc-grid-layout">
            
            {/* Card 1: Pending Fabric Issue */}
            <div className="yc-card yc-card-pending-report">
              <div className="yc-card-header">
                <h3 className="yc-card-title">Pending Fabric Issue</h3>
                <button className="yc-badge-btn">Report</button>
              </div>
              <div className="yc-card-stats-sub">
                <span className="yc-sub-badge blue">{stats.partiallyIssued} Issues</span>
                <span className="yc-sub-badge light">{sheetData.length - stats.completedBatches} Pending GRN</span>
              </div>
              <div className="yc-sparkline-container">
                <svg viewBox="0 0 300 100" className="yc-sparkline">
                  <path d="M 0 60 Q 50 60 75 80 T 150 40 T 225 50 T 300 20" fill="none" stroke="#3b82f6" strokeWidth="2" />
                  <path d="M 0 40 Q 50 30 75 50 T 150 70 T 225 30 T 300 60" fill="none" stroke="#93c5fd" strokeWidth="1.5" strokeDasharray="4" />
                  <line x1="75" y1="0" x2="75" y2="100" stroke="#3b82f6" strokeWidth="1" strokeDasharray="3" />
                </svg>
                <div className="yc-months-axis">
                  <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span>
                </div>
              </div>
            </div>

            {/* Card 2: Active Batch Status */}
            <div className="yc-card yc-card-blue-hero">
              <div className="yc-hero-circle-icon">🎚</div>
              <span className="yc-hero-tag">Today's info</span>
              <h2 className="yc-hero-title">Active Batch Status</h2>
              <p className="yc-hero-desc">{activeBatchesText}</p>
              <div className="yc-hero-stepper">
                <span className="step active"></span>
                <span className="step"></span>
                <span className="step"></span>
                <span className="step"></span>
              </div>
            </div>

            {/* Card 3: Statistics Summary */}
            <div className="yc-card yc-card-trend">
              <h3 className="yc-card-title-secondary">Inventory Summary</h3>
              <div className="yc-trend-value-wrapper">
                <span className="yc-trend-main-val">{stats.totalMRNWT}</span>
                <span className="yc-trend-percentage-green">Total KG</span>
              </div>
              <div className="yc-trend-graph-wrapper">
                <svg viewBox="0 0 200 100" preserveAspectRatio="none" className="yc-trend-svg">
                  <path d="M 0 90 L 40 85 L 80 50 L 120 45 L 160 20 L 200 10" fill="none" stroke="#3b82f6" strokeWidth="3" />
                </svg>
                <div className="yc-days-axis">
                  <span>Total Batches: {stats.totalBatches}</span>
                </div>
              </div>
            </div>

            {/* Card 4: Top Fabric Progress */}
            <div className="yc-card yc-card-progress">
              <div className="yc-card-header">
                <h3 className="yc-card-title">Stock Status Progress</h3>
                <span className="yc-more-options">•••</span>
              </div>
              <div className="yc-progress-list">
                {topFabrics.map((fabric, index) => (
                  <div className="yc-progress-item" key={index}>
                    <div className="yc-progress-icon-box">📅</div>
                    <div className="yc-progress-details">
                      <div className="yc-progress-meta">
                        <h4>{fabric.name}</h4>
                        <span>{fabric.stock}</span>
                      </div>
                      <div className="yc-bar-track">
                        <div className="yc-bar-fill" style={{ width: `${fabric.progress}%` }}></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Card 5: Warehouse Master Info */}
            <div className="yc-card yc-card-info-summary">
              <div className="yc-card-header">
                <h3 className="yc-card-title">Warehouse Master Info</h3>
                <button className="yc-link-btn">See Details</button>
              </div>
              
              <div className="yc-info-profile-row">
                <div className="yc-avatar-placeholder">🏭</div>
                <div className="yc-profile-details">
                  <h4>Main Storage Bay A</h4>
                  <span>Primary Distribution Hub</span>
                </div>
                <div className="yc-qr-code">🔳</div>
              </div>

              <div className="yc-info-grid">
                <div className="yc-info-cell">
                  <span className="yc-label">Total Fabric Stock</span>
                  <span className="yc-value">{stats.totalMRNWT} KG</span>
                </div>
                <div className="yc-info-cell">
                  <span className="yc-label">Low Stock Alerts</span>
                  <span className="yc-value urgent">{stats.partiallyIssued} Critical Items</span>
                </div>
                <div className="yc-info-cell">
                  <span className="yc-label">Completed Batches</span>
                  <span className="yc-value">{stats.completedBatches}</span>
                </div>
                <div className="yc-info-cell">
                  <span className="yc-label">Total Balance WT</span>
                  <span className="yc-value">{stats.totalBalWT} KG</span>
                </div>
              </div>
            </div>

            {/* Card 6: Monthly Production Report */}
            <div className="yc-card yc-card-bar-graph">
              <div className="yc-card-header">
                <h3 className="yc-card-title">Monthly Production Report</h3>
                <button className="yc-link-btn">See Details</button>
              </div>
              
              <div className="yc-graph-legends">
                <span className="legend-item"><span className="circle light"></span> Progress</span>
                <span className="legend-item"><span className="circle blue"></span> Recovery Issues</span>
              </div>

              <div className="yc-bar-chart-container">
                <div className="yc-bar-chart-grid">
                  <div className="yc-chart-bar-group"><div className="yc-bar-column tall visual-fill"></div><span>Jan</span></div>
                  <div className="yc-chart-bar-group"><div className="yc-bar-column active-gradient"></div><span>Feb</span></div>
                  <div className="yc-chart-bar-group"><div className="yc-bar-column short"></div><span>Mar</span></div>
                  <div className="yc-chart-bar-group"><div className="yc-bar-column medium"></div><span>Apr</span></div>
                  <div className="yc-chart-bar-group"><div className="yc-bar-column solid-blue"></div><span>May</span></div>
                  <div className="yc-chart-bar-group"><div className="yc-bar-column tall"></div><span>Jun</span></div>
                </div>
                <div className="yc-grid-line-dashed"></div>
              </div>
            </div>

            {/* Card 7: Recent Transactions Log */}
            <div className="yc-card yc-card-operators">
              <div className="yc-card-header">
                <h3 className="yc-card-title">Recent Transactions Log</h3>
                <button className="yc-link-btn">See Details</button>
              </div>
              <div className="yc-operators-list">
                {recentTransactions.map((tx) => (
                  <div className="yc-operator-item" key={tx.id}>
                    <div className="yc-op-avatar-circle">📦</div>
                    <div className="yc-op-details">
                      <h4>{tx.type}</h4>
                      <span>{tx.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;