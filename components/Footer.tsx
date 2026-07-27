import React from 'react';
import { Twitter, Send, Github, BookOpen, Mail, TrendingUp, Activity, Shield, Zap } from 'lucide-react';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative mt-20 border-t border-white/10">
      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
          
          {/* Brand Section */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="relative w-10 h-10 flex-shrink-0">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  {/* Red border/frame */}
                  <rect 
                    x="2" 
                    y="2" 
                    width="96" 
                    height="96" 
                    rx="12" 
                    fill="none" 
                    stroke="#ef4444" 
                    strokeWidth="4"
                  />
                  
                  {/* RGB gradient definition */}
                  <defs>
                    <linearGradient id="footerRgbGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" style={{ stopColor: '#3b82f6', stopOpacity: 1 }} />
                      <stop offset="50%" style={{ stopColor: '#a855f7', stopOpacity: 1 }} />
                      <stop offset="100%" style={{ stopColor: '#ec4899', stopOpacity: 1 }} />
                    </linearGradient>
                  </defs>
                  
                  {/* Target circles with RGB gradient */}
                  <circle cx="50" cy="50" r="35" fill="none" stroke="url(#footerRgbGradient)" strokeWidth="3" />
                  <circle cx="50" cy="50" r="25" fill="none" stroke="url(#footerRgbGradient)" strokeWidth="3" />
                  <circle cx="50" cy="50" r="15" fill="none" stroke="url(#footerRgbGradient)" strokeWidth="3" />
                  <circle cx="50" cy="50" r="5" fill="url(#footerRgbGradient)" />
                </svg>
              </div>
              <div>
                <h1 className="text-sm font-black tracking-tight uppercase italic leading-none bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                  OnChain Alpha
                </h1>
                <p className="text-[8px] text-slate-500 uppercase tracking-widest font-bold leading-none mt-1">
                  Tactical Recon Engine
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-400 mb-6 max-w-sm">
              Advanced blockchain analytics platform for tracking whales, scanning tokens, and monitoring on-chain activities across multiple networks.
            </p>
            
            {/* Social Links */}
            <div className="flex items-center gap-3">
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-lg bg-slate-800 border border-white/10 hover:border-primary-500 hover:bg-primary-500/10 flex items-center justify-center transition-all group"
              >
                <Twitter className="w-5 h-5 text-slate-400 group-hover:text-primary-400" />
              </a>
              <a
                href="https://t.me"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-lg bg-slate-800 border border-white/10 hover:border-primary-500 hover:bg-primary-500/10 flex items-center justify-center transition-all group"
              >
                <Send className="w-5 h-5 text-slate-400 group-hover:text-primary-400" />
              </a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-lg bg-slate-800 border border-white/10 hover:border-primary-500 hover:bg-primary-500/10 flex items-center justify-center transition-all group"
              >
                <Github className="w-5 h-5 text-slate-400 group-hover:text-primary-400" />
              </a>
              <a
                href="https://medium.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-lg bg-slate-800 border border-white/10 hover:border-primary-500 hover:bg-primary-500/10 flex items-center justify-center transition-all group"
              >
                <BookOpen className="w-5 h-5 text-slate-400 group-hover:text-primary-400" />
              </a>
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h3 className="text-sm font-black uppercase text-white mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary-500" />
              Product
            </h3>
            <ul className="space-y-3">
              <li>
                <a href="/" className="text-sm text-slate-400 hover:text-primary-400 transition-colors">
                  Token Scanner
                </a>
              </li>
              <li>
                <a href="/whalers" className="text-sm text-slate-400 hover:text-primary-400 transition-colors">
                  Whale Tracker
                </a>
              </li>
              <li>
                <a href="/coins" className="text-sm text-slate-400 hover:text-primary-400 transition-colors">
                  Token Analytics
                </a>
              </li>
              <li>
                <a href="/pricing" className="text-sm text-slate-400 hover:text-primary-400 transition-colors">
                  Pricing
                </a>
              </li>
              <li>
                <a href="/profile" className="text-sm text-slate-400 hover:text-primary-400 transition-colors">
                  Portfolio Monitor
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-slate-400 hover:text-primary-400 transition-colors">
                  API Access
                </a>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-sm font-black uppercase text-white mb-4 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary-500" />
              Resources
            </h3>
            <ul className="space-y-3">
              <li>
                <a href="/documentation" className="text-sm text-slate-400 hover:text-primary-400 transition-colors">
                  Documentation
                </a>
              </li>
              <li>
                <a href="/tutorials" className="text-sm text-slate-400 hover:text-primary-400 transition-colors">
                  Tutorials
                </a>
              </li>
              <li>
                <a href="/blog" className="text-sm text-slate-400 hover:text-primary-400 transition-colors">
                  Blog
                </a>
              </li>
              <li>
                <a href="/faq" className="text-sm text-slate-400 hover:text-primary-400 transition-colors">
                  FAQ
                </a>
              </li>
              <li>
                <a href="/support" className="text-sm text-slate-400 hover:text-primary-400 transition-colors">
                  Support
                </a>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-sm font-black uppercase text-white mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary-500" />
              Company
            </h3>
            <ul className="space-y-3">
              <li>
                <a href="/about" className="text-sm text-slate-400 hover:text-primary-400 transition-colors">
                  About Us
                </a>
              </li>
              <li>
                <a href="/careers" className="text-sm text-slate-400 hover:text-primary-400 transition-colors">
                  Careers
                </a>
              </li>
              <li>
                <a href="/terms" className="text-sm text-slate-400 hover:text-primary-400 transition-colors">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="/privacy" className="text-sm text-slate-400 hover:text-primary-400 transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="/cookie-policy" className="text-sm text-slate-400 hover:text-primary-400 transition-colors">
                  Cookie Policy
                </a>
              </li>
              <li>
                <a href="/disclaimer" className="text-sm text-slate-400 hover:text-primary-400 transition-colors">
                  Disclaimer
                </a>
              </li>
              <li>
                <a href="/contact" className="text-sm text-slate-400 hover:text-primary-400 transition-colors">
                  Contact Us
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-500">
              © {currentYear} OnChain Analytics. All rights reserved.
            </p>
            
            <div className="flex items-center gap-4">
              {/* Status Indicator */}
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-xs font-bold text-slate-400">All Systems Operational</span>
              </div>
              
              {/* Version */}
              <span className="text-xs text-slate-600">v1.0.0</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
