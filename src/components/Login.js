import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  InputAdornment,
  IconButton,
  Alert,
  CircularProgress,
  Fade,
  Zoom,
  Divider,
  Chip,
  Stack,
  useMediaQuery,
  useTheme,
  GlobalStyles
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Login as LoginIcon,
  Factory,
  Person,
  Lock,
  AdminPanelSettings,
  Store,
  Security
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

function Login() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [credentials, setCredentials] = useState({
    id: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDemoInfo, setShowDemoInfo] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [validCredentials, setValidCredentials] = useState({});
  const [fetchingCredentials, setFetchingCredentials] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('');

  // Hardcoded Google Sheets credentials
  const GOOGLE_SHEETS_CONFIG = {
    apiKey: 'AIzaSyAomDFBkOySlIxKWSKGHe6ATv9gvaBr7uk',
    sheetId: '1iBDfsxA9XEC9nhQE-ALBYlyGRZWOaCYvWsnGfYYbr1I',
    range: 'Fabric Credentials!A:F'
  };

  // Fetch credentials from Google Sheets
  const fetchCredentialsFromGoogleSheets = useCallback(async () => {
    try {
      setFetchingCredentials(true);
      setConnectionStatus('Connecting to Google Sheets...');
      
      const encodedRange = encodeURIComponent(GOOGLE_SHEETS_CONFIG.range);
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_CONFIG.sheetId}/values/${encodedRange}?key=${GOOGLE_SHEETS_CONFIG.apiKey}`;
      
      console.log('Fetching credentials...');
      setConnectionStatus('Fetching credentials from Fabric Credentials sheet...');
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Google Sheets API Error:', errorData);
        
        if (response.status === 404) {
          throw new Error(`Sheet 'Fabric Credentials' not found. Please make sure you have a sheet with this exact name.`);
        } else if (response.status === 403) {
          throw new Error('Access forbidden. Please enable Google Sheets API in Google Cloud Console.');
        } else {
          throw new Error(`API Error: ${errorData.error?.message || response.statusText}`);
        }
      }
      
      const data = await response.json();
      
      if (!data.values || data.values.length === 0) {
        throw new Error('No data found in the Fabric Credentials sheet.');
      }
      
      console.log('Raw data from sheet:', data.values);
      
      const headers = data.values[0];
      const credentialsMap = {};
      
      // Find column indices
      const idIndex = headers.findIndex(h => h.toLowerCase() === 'id');
      const passwordIndex = headers.findIndex(h => h.toLowerCase() === 'password');
      const roleIndex = headers.findIndex(h => h.toLowerCase() === 'role');
      const nameIndex = headers.findIndex(h => h.toLowerCase() === 'name');
      const departmentIndex = headers.findIndex(h => h.toLowerCase() === 'department');
      const permissionsIndex = headers.findIndex(h => h.toLowerCase() === 'permissions');
      
      if (idIndex === -1 || passwordIndex === -1) {
        throw new Error('Sheet must have "id" and "password" columns');
      }
      
      for (let i = 1; i < data.values.length; i++) {
        const row = data.values[i];
        if (row && row[idIndex] && row[idIndex].trim()) {
          const userData = {
            id: row[idIndex]?.trim() || '',
            password: row[passwordIndex]?.trim() || '',
            role: roleIndex !== -1 ? (row[roleIndex]?.trim() || 'User') : 'User',
            name: nameIndex !== -1 ? (row[nameIndex]?.trim() || '') : '',
            department: departmentIndex !== -1 ? (row[departmentIndex]?.trim() || '') : '',
            permissions: permissionsIndex !== -1 && row[permissionsIndex] ? 
              row[permissionsIndex].split(',').map(p => p.trim()) : []
          };
          
          if (userData.id && userData.password) {
            credentialsMap[userData.id.toLowerCase()] = userData;
          }
        }
      }
      
      if (Object.keys(credentialsMap).length === 0) {
        throw new Error('No valid user data found. Please ensure each row has both ID and password.');
      }
      
      console.log(`Successfully loaded ${Object.keys(credentialsMap).length} user(s):`, Object.keys(credentialsMap));
      setValidCredentials(credentialsMap);
      setConnectionStatus(`Successfully loaded ${Object.keys(credentialsMap).length} user(s)`);
      setError('');
      
      setTimeout(() => setConnectionStatus(''), 3000);
      
    } catch (error) {
      console.error('Error fetching from Google Sheets:', error);
      setError(`Failed to load credentials: ${error.message}`);
      setConnectionStatus('');
      setValidCredentials({});
    } finally {
      setFetchingCredentials(false);
    }
  }, []);

  // Load credentials on component mount
  useEffect(() => {
    fetchCredentialsFromGoogleSheets();
    localStorage.removeItem('user');
    localStorage.removeItem('isAuthenticated');
  }, [fetchCredentialsFromGoogleSheets]);

  const handleChange = useCallback((field) => (event) => {
    setCredentials(prev => ({
      ...prev,
      [field]: event.target.value
    }));
    setError('');
    setSelectedRole(null);
  }, []);

  const handleLogin = useCallback(async (e) => {
    e.preventDefault();
    
    if (!credentials.id || !credentials.password) {
      setError('Please enter both ID and Password');
      return;
    }

    if (fetchingCredentials) {
      setError('Please wait, credentials are still loading...');
      return;
    }

    if (Object.keys(validCredentials).length === 0) {
      setError('No credentials available. Please check your Google Sheets connection.');
      return;
    }

    setLoading(true);
    setError('');

    setTimeout(() => {
      const user = validCredentials[credentials.id.toLowerCase()];
      
      if (user && user.password === credentials.password) {
        const userData = {
          id: user.id,
          name: user.name,
          role: user.role,
          department: user.department,
          permissions: user.permissions,
          loginTime: new Date().toISOString()
        };
        
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('isAuthenticated', 'true');
        
        navigate('/dashboard');
      } else {
        setError('Invalid ID or Password. Please try again.');
        setCredentials({ id: '', password: '' });
      }
      setLoading(false);
    }, 800);
  }, [credentials.id, credentials.password, navigate, validCredentials, fetchingCredentials]);

  const handleDemoLogin = useCallback((userId) => {
    const user = validCredentials[userId];
    if (user) {
      setCredentials({
        id: user.id,
        password: user.password
      });
      setSelectedRole(userId);
      setError('');
    }
  }, [validCredentials]);

  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter') {
      handleLogin(e);
    }
  }, [handleLogin]);

  const demoUsers = useMemo(() => {
    const users = [];
    const demoUserIds = ['admin', 'manager', 'supervisor', 'operator'];
    
    demoUserIds.forEach(id => {
      if (validCredentials[id]) {
        users.push({
          id: id,
          role: validCredentials[id].role,
          icon: id === 'admin' ? <AdminPanelSettings /> : 
                id === 'supervisor' ? <Store /> : <Person />
        });
      }
    });
    
    return users;
  }, [validCredentials]);

  const demoButtons = useMemo(() => (
    <Stack direction={isMobile ? 'column' : 'row'} spacing={2}>
      {demoUsers.map(user => (
        <Button
          key={user.id}
          variant={selectedRole === user.id ? 'contained' : 'outlined'}
          onClick={() => handleDemoLogin(user.id)}
          startIcon={user.icon}
          disabled={fetchingCredentials || Object.keys(validCredentials).length === 0}
          sx={{
            borderRadius: '10px',
            textTransform: 'none',
            fontWeight: 600,
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            flex: 1,
            borderWidth: '2px',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
            },
            '&:active': {
              transform: 'translateY(0)'
            },
            ...(user.id === 'admin' && {
              borderColor: '#0a1928',
              color: '#0a1928',
              ...(selectedRole === user.id && {
                background: 'linear-gradient(135deg, #0a1928, #0d2b3e)',
                color: 'white',
                border: 'none'
              })
            }),
            ...(user.id === 'manager' && {
              borderColor: '#1e3a5f',
              color: '#1e3a5f',
              ...(selectedRole === user.id && {
                background: 'linear-gradient(135deg, #1e3a5f, #2c4a7a)',
                color: 'white',
                border: 'none'
              })
            }),
            ...(user.id === 'supervisor' && {
              borderColor: '#2c4a7a',
              color: '#2c4a7a',
              ...(selectedRole === user.id && {
                background: 'linear-gradient(135deg, #2c4a7a, #1e3a5f)',
                color: 'white',
                border: 'none'
              })
            }),
            ...(user.id === 'operator' && {
              borderColor: '#3b5f8a',
              color: '#3b5f8a',
              ...(selectedRole === user.id && {
                background: 'linear-gradient(135deg, #3b5f8a, #2c4a7a)',
                color: 'white',
                border: 'none'
              })
            })
          }}
        >
          {user.role.split(' ')[0]}
        </Button>
      ))}
    </Stack>
  ), [isMobile, selectedRole, handleDemoLogin, demoUsers, fetchingCredentials, validCredentials]);

  // Loading state
  if (fetchingCredentials) {
    return (
      <Box sx={{ 
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        background: 'linear-gradient(135deg, #0a1928 0%, #0d2b3e 100%)',
        padding: '20px'
      }}>
        <Container maxWidth="sm">
          <Paper elevation={3} sx={{ 
            flex: 1,
            background: '#ffffff',
            padding: { xs: '30px 20px', sm: '50px 40px' },
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '30px'
          }}>
            <Box sx={{ width: '100%', maxWidth: '400px', textAlign: 'center', py: 8 }}>
              <CircularProgress size={60} />
              <Typography variant="h6" sx={{ mt: 3 }}>
                Loading credentials from Fabric Credentials sheet...
              </Typography>
              <Typography variant="body2" sx={{ mt: 1, color: '#64748b' }}>
                {connectionStatus}
              </Typography>
            </Box>
          </Paper>
        </Container>
      </Box>
    );
  }

  return (
    <>
      {/* Global styles for animations */}
      <GlobalStyles
        styles={{
          '@keyframes slowFloat': {
            '0%, 100%': { transform: 'translateY(0)' },
            '50%': { transform: 'translateY(-20px)' }
          },
          '@keyframes shake': {
            '0%, 100%': { transform: 'translateX(0)' },
            '25%': { transform: 'translateX(-8px)' },
            '75%': { transform: 'translateX(8px)' }
          },
          '@keyframes slideIn': {
            from: { opacity: 0, transform: 'translateY(-8px)' },
            to: { opacity: 1, transform: 'translateY(0)' }
          }
        }}
      />
      
      <Box sx={{ 
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        background: 'linear-gradient(135deg, #0a1928 0%, #0d2b3e 100%)',
        padding: '20px',
        overflow: 'hidden'
      }}>
        {/* Animated Background */}
        <Box sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          zIndex: 0,
          pointerEvents: 'none'
        }}>
          <Box sx={{
            position: 'absolute',
            borderRadius: '50%',
            opacity: 0.1,
            background: '#1e3a5f',
            width: '400px',
            height: '400px',
            top: '-150px',
            right: '-100px',
            animation: 'slowFloat 25s ease-in-out infinite'
          }} />
          <Box sx={{
            position: 'absolute',
            borderRadius: '50%',
            opacity: 0.1,
            background: '#2c4a7a',
            width: '500px',
            height: '500px',
            bottom: '-200px',
            left: '-150px',
            animation: 'slowFloat 30s ease-in-out infinite reverse'
          }} />
        </Box>

        {/* Main Container */}
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
          <Fade in timeout={500}>
            <Box sx={{ 
              display: 'flex',
              width: '100%',
              maxWidth: '1200px',
              background: 'transparent',
              borderRadius: '30px',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              flexDirection: { xs: 'column', md: 'row' }
            }}>
              {/* Left Panel - Branding */}
              <Paper elevation={0} sx={{ 
                flex: 1,
                background: 'linear-gradient(135deg, #0a1928 0%, #0d2b3e 100%)',
                padding: { xs: '40px 30px', sm: '60px 40px' },
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(255, 255, 255, 0.02) 20px, rgba(255, 255, 255, 0.02) 40px)',
                  pointerEvents: 'none'
                }
              }}>
                <Box sx={{ position: 'relative', zIndex: 1, width: '100%', textAlign: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', marginBottom: '20px' }}>
                    <Factory sx={{ fontSize: '48px', color: '#ffffff', transition: 'transform 0.3s ease', '&:hover': { transform: 'scale(1.05)' } }} />
                    <Typography variant="h4" sx={{ fontWeight: 800, color: '#ffffff', letterSpacing: '-0.5px' }}>
                      FabricFlow
                    </Typography>
                  </Box>
                  
                  <Typography variant="h5" sx={{ color: '#cbd5e1', marginBottom: '30px', fontWeight: 500 }}>
                    Smart Fabric Management System
                  </Typography>
                  
                  <Divider sx={{ margin: '30px 0', background: 'rgba(255, 255, 255, 0.2)', height: '1px' }} />
                  
                  <Box sx={{ textAlign: 'left', marginBottom: '40px' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px', padding: '10px', transition: 'transform 0.2s ease', '&:hover': { transform: 'translateX(8px)' } }}>
                      <Store sx={{ fontSize: '24px', color: '#ffffff', opacity: 0.9 }} />
                      <span style={{ color: '#e2e8f0', fontWeight: 500 }}>Real-time Inventory Tracking</span>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px', padding: '10px', transition: 'transform 0.2s ease', '&:hover': { transform: 'translateX(8px)' } }}>
                      <Security sx={{ fontSize: '24px', color: '#ffffff', opacity: 0.9 }} />
                      <span style={{ color: '#e2e8f0', fontWeight: 500 }}>Secure & Reliable</span>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: '20px', marginTop: '30px', flexDirection: { xs: 'column', sm: 'row' } }}>
                    <Box sx={{ textAlign: 'center', flex: 1, background: 'rgba(255, 255, 255, 0.05)', padding: '15px 10px', borderRadius: '12px', transition: 'transform 0.2s ease, background 0.2s ease', '&:hover': { transform: 'translateY(-3px)', background: 'rgba(255, 255, 255, 0.1)' } }}>
                      <Typography sx={{ display: 'block', fontSize: '28px', fontWeight: 800, color: '#ffffff', marginBottom: '5px' }}>10K+</Typography>
                      <Typography sx={{ fontSize: '12px', color: '#cbd5e1', fontWeight: 500 }}>Transactions Daily</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center', flex: 1, background: 'rgba(255, 255, 255, 0.05)', padding: '15px 10px', borderRadius: '12px', transition: 'transform 0.2s ease, background 0.2s ease', '&:hover': { transform: 'translateY(-3px)', background: 'rgba(255, 255, 255, 0.1)' } }}>
                      <Typography sx={{ display: 'block', fontSize: '28px', fontWeight: 800, color: '#ffffff', marginBottom: '5px' }}>98%</Typography>
                      <Typography sx={{ fontSize: '12px', color: '#cbd5e1', fontWeight: 500 }}>Accuracy Rate</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center', flex: 1, background: 'rgba(255, 255, 255, 0.05)', padding: '15px 10px', borderRadius: '12px', transition: 'transform 0.2s ease, background 0.2s ease', '&:hover': { transform: 'translateY(-3px)', background: 'rgba(255, 255, 255, 0.1)' } }}>
                      <Typography sx={{ display: 'block', fontSize: '28px', fontWeight: 800, color: '#ffffff', marginBottom: '5px' }}>24/7</Typography>
                      <Typography sx={{ fontSize: '12px', color: '#cbd5e1', fontWeight: 500 }}>Support</Typography>
                    </Box>
                  </Box>
                </Box>
              </Paper>

              {/* Right Panel - Login Form */}
              <Paper elevation={3} sx={{ 
                flex: 1,
                background: '#ffffff',
                padding: { xs: '30px 20px', sm: '50px 40px' },
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Zoom in timeout={400}>
                  <Box sx={{ width: '100%', maxWidth: '400px' }}>
                    <Box sx={{ textAlign: 'center', marginBottom: '35px' }}>
                      <Box sx={{ 
                        width: '70px',
                        height: '70px',
                        background: 'linear-gradient(135deg, #0a1928 0%, #0d2b3e 100%)',
                        borderRadius: '50%',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '20px',
                        transition: 'transform 0.3s ease',
                        '&:hover': { transform: 'scale(1.05)' }
                      }}>
                        <LoginIcon sx={{ fontSize: '35px', color: 'white' }} />
                      </Box>
                      <Typography variant="h4" sx={{ fontWeight: 700, color: '#0a1928', marginBottom: '10px' }}>
                        Welcome Back
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#64748b' }}>
                        Sign in to access your fabric management dashboard
                      </Typography>
                    </Box>

                    {error && (
                      <Alert severity="error" onClose={() => setError('')} sx={{ marginBottom: '25px', borderRadius: '12px', animation: 'shake 0.4s ease' }}>
                        {error}
                      </Alert>
                    )}

                    {connectionStatus && !error && (
                      <Alert severity="info" onClose={() => setConnectionStatus('')} sx={{ marginBottom: '25px', borderRadius: '12px' }}>
                        {connectionStatus}
                      </Alert>
                    )}

                    <form onSubmit={handleLogin} style={{ marginBottom: '25px' }}>
                      <TextField
                        fullWidth
                        label="User ID / Email"
                        variant="outlined"
                        value={credentials.id}
                        onChange={handleChange('id')}
                        onKeyPress={handleKeyPress}
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start">
                                <Person sx={{ color: '#94a3b8', transition: 'color 0.2s ease' }} />
                              </InputAdornment>
                            ),
                          }
                        }}
                        disabled={loading || Object.keys(validCredentials).length === 0}
                        sx={{
                          marginBottom: '20px',
                          '& .MuiOutlinedInput-root': {
                            borderRadius: '12px',
                            transition: 'box-shadow 0.2s ease, transform 0.2s ease',
                            backgroundColor: '#ffffff',
                            '&:hover': {
                              transform: 'translateY(-1px)',
                              boxShadow: '0 4px 12px rgba(10, 25, 40, 0.1)'
                            },
                            '&.Mui-focused': {
                              boxShadow: '0 0 0 3px rgba(10, 25, 40, 0.1)'
                            },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                              borderColor: '#0a1928',
                              borderWidth: '2px'
                            }
                          }
                        }}
                      />

                      <TextField
                        fullWidth
                        label="Password"
                        type={showPassword ? 'text' : 'password'}
                        variant="outlined"
                        value={credentials.password}
                        onChange={handleChange('password')}
                        onKeyPress={handleKeyPress}
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start">
                                <Lock sx={{ color: '#94a3b8', transition: 'color 0.2s ease' }} />
                              </InputAdornment>
                            ),
                            endAdornment: (
                              <InputAdornment position="end">
                                <IconButton
                                  onClick={() => setShowPassword(prev => !prev)}
                                  edge="end"
                                  disabled={loading || Object.keys(validCredentials).length === 0}
                                >
                                  {showPassword ? <VisibilityOff /> : <Visibility />}
                                </IconButton>
                              </InputAdornment>
                            ),
                          }
                        }}
                        disabled={loading || Object.keys(validCredentials).length === 0}
                        sx={{
                          marginBottom: '20px',
                          '& .MuiOutlinedInput-root': {
                            borderRadius: '12px',
                            transition: 'box-shadow 0.2s ease, transform 0.2s ease',
                            backgroundColor: '#ffffff',
                            '&:hover': {
                              transform: 'translateY(-1px)',
                              boxShadow: '0 4px 12px rgba(10, 25, 40, 0.1)'
                            },
                            '&.Mui-focused': {
                              boxShadow: '0 0 0 3px rgba(10, 25, 40, 0.1)'
                            },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                              borderColor: '#0a1928',
                              borderWidth: '2px'
                            }
                          }
                        }}
                      />

                      <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        size="large"
                        disabled={loading || fetchingCredentials || Object.keys(validCredentials).length === 0}
                        startIcon={!loading && <LoginIcon />}
                        sx={{
                          marginTop: '15px',
                          padding: '12px',
                          borderRadius: '12px',
                          background: 'linear-gradient(135deg, #0a1928 0%, #0d2b3e 100%)',
                          textTransform: 'none',
                          fontSize: '16px',
                          fontWeight: 600,
                          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                          color: 'white',
                          position: 'relative',
                          overflow: 'hidden',
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: '0 8px 20px -5px rgba(10, 25, 40, 0.3)'
                          },
                          '&:active': {
                            transform: 'translateY(0)'
                          },
                          '&::after': {
                            content: '""',
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            width: 0,
                            height: 0,
                            borderRadius: '50%',
                            background: 'rgba(255, 255, 255, 0.3)',
                            transform: 'translate(-50%, -50%)',
                            transition: 'width 0.4s, height 0.4s'
                          },
                          '&:active::after': {
                            width: '200px',
                            height: '200px'
                          }
                        }}
                      >
                        {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
                      </Button>
                    </form>

                    {Object.keys(validCredentials).length > 0 && (
                      <>
                        <Divider sx={{ margin: '30px 0', color: '#94a3b8', fontSize: '14px', '&::before, &::after': { borderColor: '#e2e8f0' } }}>
                          Demo Credentials
                        </Divider>
                        <Box sx={{ marginTop: '20px' }}>
                          {demoButtons}

                          {selectedRole && validCredentials[selectedRole] && (
                            <Zoom in>
                              <Chip
                                icon={<Security />}
                                label={`Demo: ${validCredentials[selectedRole]?.role}`}
                                onClick={() => setShowDemoInfo(prev => !prev)}
                                sx={{
                                  marginTop: '20px',
                                  width: '100%',
                                  justifyContent: 'center',
                                  padding: '8px',
                                  background: '#f8fafc',
                                  borderRadius: '12px',
                                  cursor: 'pointer',
                                  transition: 'transform 0.2s ease, background 0.2s ease',
                                  border: '1px solid #e2e8f0',
                                  '&:hover': {
                                    transform: 'translateY(-2px)',
                                    background: '#f1f5f9'
                                  }
                                }}
                              />
                            </Zoom>
                          )}

                          {showDemoInfo && selectedRole && validCredentials[selectedRole] && (
                            <Fade in>
                              <Paper elevation={0} sx={{
                                marginTop: '15px',
                                padding: '15px',
                                background: '#f8fafc',
                                borderRadius: '12px',
                                borderLeft: '4px solid #0a1928',
                                animation: 'slideIn 0.2s ease',
                                '& .MuiTypography-root': {
                                  marginBottom: '5px',
                                  color: '#1e293b'
                                }
                              }}>
                                <Typography variant="caption" display="block">
                                  <strong>User ID:</strong> {validCredentials[selectedRole]?.id}
                                </Typography>
                                <Typography variant="caption" display="block">
                                  <strong>Password:</strong> {validCredentials[selectedRole]?.password}
                                </Typography>
                                <Typography variant="caption" display="block">
                                  <strong>Role:</strong> {validCredentials[selectedRole]?.role}
                                </Typography>
                                <Typography variant="caption" display="block">
                                  <strong>Department:</strong> {validCredentials[selectedRole]?.department}
                                </Typography>
                              </Paper>
                            </Fade>
                          )}
                        </Box>
                      </>
                    )}

                    <Box sx={{ marginTop: '30px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#64748b' }}>
                      <Security sx={{ fontSize: '14px', color: '#0a1928' }} />
                      <Typography variant="caption" color="textSecondary">
                        Secure Login | Encrypted Connection
                      </Typography>
                    </Box>
                  </Box>
                </Zoom>
              </Paper>
            </Box>
          </Fade>
        </Container>
      </Box>
    </>
  );
}

export default Login;