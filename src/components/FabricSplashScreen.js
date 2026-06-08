import React, { useEffect, useState, useRef } from 'react';
import '../Design/FabricSplashScreen.css';

const FabricSplashScreen = ({
  duration = 2500,
  onFinish,
  minDisplayTime = 800,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const mainTimerRef = useRef();
  const minDisplayTimerRef = useRef();
  const fadeOutTimerRef = useRef();
  const progressIntervalRef = useRef();

  useEffect(() => {
    const startTime = Date.now();
    const totalDuration = Math.max(duration, minDisplayTime);

    // Progress animation
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min(100, (elapsed / totalDuration) * 100);
      setProgress(newProgress);
      
      if (newProgress >= 100) {
        clearInterval(progressIntervalRef.current);
      }
    }, 16);

    // Main timer
    mainTimerRef.current = setTimeout(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, minDisplayTime - elapsed);

      minDisplayTimerRef.current = setTimeout(() => {
        setIsFadingOut(true);
        
        fadeOutTimerRef.current = setTimeout(() => {
          setIsVisible(false);
          if (onFinish) {
            onFinish();
          }
        }, 500);
      }, remaining);
    }, duration);

    return () => {
      if (mainTimerRef.current) clearTimeout(mainTimerRef.current);
      if (minDisplayTimerRef.current) clearTimeout(minDisplayTimerRef.current);
      if (fadeOutTimerRef.current) clearTimeout(fadeOutTimerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [duration, minDisplayTime, onFinish]);

  if (!isVisible) return null;

  return (
    <div className={`fabric-splash ${isFadingOut ? 'fade-out' : ''}`}>
      <div className="splash-container">
        {/* Light gradient background */}
        <div className="gradient-bg">
          <div className="gradient-1"></div>
          <div className="gradient-2"></div>
          <div className="gradient-3"></div>
        </div>

        {/* Subtle grid overlay */}
        <div className="grid-overlay"></div>

        <div className="content-wrapper">
          {/* Animated Fabric Roll Section */}
          <div className="fabric-roll-section">
            <div className="fabric-roll-container">
              {/* Left Roll */}
              <div className="fabric-roll-left">
                <div className="roll-cylinder">
                  <div className="cylinder-core"></div>
                  <div className="cylinder-texture"></div>
                </div>
              </div>

              {/* Unrolling Fabric */}
              <div className="fabric-unrolling">
                <svg 
                  className="fabric-wave" 
                  viewBox="0 0 400 200" 
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="fabricGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="25%" stopColor="#8b5cf6" />
                      <stop offset="50%" stopColor="#06b6d4" />
                      <stop offset="75%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                    
                    <linearGradient id="fabricShine" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="rgba(255,255,255,0.3)" />
                      <stop offset="50%" stopColor="rgba(255,255,255,0)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0.2)" />
                    </linearGradient>

                    <pattern id="fabricPattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 0 10 L 20 10 M 10 0 L 10 20" stroke="rgba(99, 102, 241, 0.15)" strokeWidth="1" />
                      <path d="M 0 0 L 20 20 M 20 0 L 0 20" stroke="rgba(139, 92, 246, 0.1)" strokeWidth="0.5" />
                    </pattern>
                  </defs>

                  {/* Main fabric body */}
                  <path
                    d="M 0,100 Q 50,80 100,100 T 200,100 T 300,100 T 400,100 L 400,160 Q 350,180 300,160 T 200,160 T 100,160 T 0,160 Z"
                    fill="url(#fabricGradient)"
                    opacity="0.9"
                    className="fabric-body"
                  />
                  
                  {/* Fabric pattern overlay */}
                  <path
                    d="M 0,100 Q 50,80 100,100 T 200,100 T 300,100 T 400,100 L 400,160 Q 350,180 300,160 T 200,160 T 100,160 T 0,160 Z"
                    fill="url(#fabricPattern)"
                    className="fabric-pattern"
                  />
                  
                  {/* Fabric shine effect */}
                  <path
                    d="M 0,100 Q 50,80 100,100 T 200,100 T 300,100 T 400,100 L 400,160 Q 350,180 300,160 T 200,160 T 100,160 T 0,160 Z"
                    fill="url(#fabricShine)"
                    className="fabric-shine"
                  />

                  {/* Thread lines */}
                  <g className="threads">
                    {[...Array(12)].map((_, i) => (
                      <path
                        key={i}
                        d={`M 0,${110 + i * 4} Q 50,${90 + i * 4} 100,${110 + i * 4} T 200,${110 + i * 4} T 300,${110 + i * 4} T 400,${110 + i * 4}`}
                        stroke="rgba(255,255,255,0.4)"
                        strokeWidth="0.5"
                        fill="none"
                        className="thread-line"
                      />
                    ))}
                  </g>

                  {/* Weave dots */}
                  <g className="weave-dots">
                    {[...Array(30)].map((_, i) => (
                      <circle
                        key={i}
                        cx={10 + i * 13}
                        cy={130 + Math.sin(i) * 5}
                        r="1.5"
                        fill="rgba(255,255,255,0.6)"
                        className="weave-dot"
                      />
                    ))}
                  </g>
                </svg>

                {/* Rolling animation overlay */}
                <div className="rolling-shine"></div>
              </div>

              {/* Right Roll */}
              <div className="fabric-roll-right">
                <div className="roll-cylinder">
                  <div className="cylinder-core"></div>
                  <div className="cylinder-texture"></div>
                </div>
              </div>
            </div>

            {/* Fabric weave indicator */}
            <div className="weave-indicator">
              <div className="weave-line"></div>
              <div className="weave-line"></div>
              <div className="weave-line"></div>
            </div>
          </div>

          {/* Text Section */}
          <div className="text-section">
            <div className="brand-container">
              <h1 className="brand-name">
                <span className="brand-fabric">FABRIC</span>
                <span className="brand-system">SYSTEM</span>
              </h1>
              <div className="brand-divider"></div>
              <p className="brand-tagline">weaving ideas into code</p>
            </div>

            {/* Loading Section */}
            <div className="loading-section">
              <div className="loading-info">
                <span className="loading-status">Unrolling fabric modules</span>
                <span className="loading-percentage">{Math.floor(progress)}%</span>
              </div>
              <div className="progress-bar-container">
                <div 
                  className="progress-bar-fill"
                  style={{ width: `${progress}%` }}
                >
                  <div className="progress-glow"></div>
                </div>
              </div>
              <div className="loading-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>

            {/* Footer */}
            <div className="splash-footer">
              <span className="version">v2.0.0</span>
              <span className="environment">Premium Fabric</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FabricSplashScreen;