import React, { useState } from 'react';
import { Share2, Facebook, Twitter, MessageCircle, Link2, Check } from 'lucide-react';

interface SocialShareButtonsProps {
  tripId: string;
  tripTitle: string;
  tripDescription?: string;
  className?: string;
  variant?: 'icon-only' | 'full' | 'dropdown';
}

const SocialShareButtons: React.FC<SocialShareButtonsProps> = ({
  tripId,
  tripTitle,
  tripDescription = '',
  className = '',
  variant = 'full'
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const shareUrl = `${window.location.origin}/trip/${tripId}`;
  const shareText = `Check out this amazing trip: ${tripTitle}`;

  const shareToFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank', 'width=600,height=400');
    setShowDropdown(false);
  };

  const shareToTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank', 'width=600,height=400');
    setShowDropdown(false);
  };

  const shareToWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`;
    window.open(url, '_blank');
    setShowDropdown(false);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      setShowDropdown(false);
    } catch (err) {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      setShowDropdown(false);
    }
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: tripTitle,
          text: tripDescription || shareText,
          url: shareUrl
        });
        setShowDropdown(false);
      } catch (err) {
        // User cancelled or error
      }
    } else {
      copyLink();
    }
  };

  if (variant === 'icon-only') {
    return (
      <div className={`relative ${className}`}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          title="Share trip"
        >
          <Share2 className="w-5 h-5 text-forest-700" />
        </button>
        
        {showDropdown && (
          <div className="absolute right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 p-2 z-50 min-w-[180px]">
            <button
              onClick={shareToFacebook}
              className="w-full flex items-center gap-3 px-4 py-2 hover:bg-blue-50 rounded-lg transition-colors text-left"
            >
              <Facebook className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium">Facebook</span>
            </button>
            <button
              onClick={shareToTwitter}
              className="w-full flex items-center gap-3 px-4 py-2 hover:bg-blue-50 rounded-lg transition-colors text-left"
            >
              <Twitter className="w-5 h-5 text-blue-400" />
              <span className="text-sm font-medium">Twitter</span>
            </button>
            <button
              onClick={shareToWhatsApp}
              className="w-full flex items-center gap-3 px-4 py-2 hover:bg-green-50 rounded-lg transition-colors text-left"
            >
              <MessageCircle className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium">WhatsApp</span>
            </button>
            <div className="border-t border-gray-200 my-1"></div>
            <button
              onClick={copyLink}
              className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 rounded-lg transition-colors text-left"
            >
              {copied ? (
                <>
                  <Check className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-green-600">Copied!</span>
                </>
              ) : (
                <>
                  <Link2 className="w-5 h-5 text-gray-600" />
                  <span className="text-sm font-medium">Copy Link</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    );
  }

  if (variant === 'dropdown') {
    return (
      <div className={`relative ${className}`}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-forest-600 to-nature-600 text-white rounded-lg hover:from-forest-700 hover:to-nature-700 transition-all font-medium"
        >
          <Share2 className="w-5 h-5" />
          <span>Share</span>
        </button>
        
        {showDropdown && (
          <div className="absolute right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 p-2 z-50 min-w-[200px]">
            <button
              onClick={shareToFacebook}
              className="w-full flex items-center gap-3 px-4 py-2 hover:bg-blue-50 rounded-lg transition-colors text-left"
            >
              <Facebook className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium">Share on Facebook</span>
            </button>
            <button
              onClick={shareToTwitter}
              className="w-full flex items-center gap-3 px-4 py-2 hover:bg-blue-50 rounded-lg transition-colors text-left"
            >
              <Twitter className="w-5 h-5 text-blue-400" />
              <span className="text-sm font-medium">Share on Twitter</span>
            </button>
            <button
              onClick={shareToWhatsApp}
              className="w-full flex items-center gap-3 px-4 py-2 hover:bg-green-50 rounded-lg transition-colors text-left"
            >
              <MessageCircle className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium">Share on WhatsApp</span>
            </button>
            <div className="border-t border-gray-200 my-1"></div>
            <button
              onClick={navigator.share ? shareNative : copyLink}
              className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 rounded-lg transition-colors text-left"
            >
              {copied ? (
                <>
                  <Check className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-green-600">Link Copied!</span>
                </>
              ) : (
                <>
                  <Link2 className="w-5 h-5 text-gray-600" />
                  <span className="text-sm font-medium">{navigator.share ? 'Share...' : 'Copy Link'}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    );
  }

  // Full variant
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      <button
        onClick={shareToFacebook}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        title="Share on Facebook"
      >
        <Facebook className="w-4 h-4" />
        <span className="text-sm font-medium">Facebook</span>
      </button>
      <button
        onClick={shareToTwitter}
        className="flex items-center gap-2 px-4 py-2 bg-blue-400 text-white rounded-lg hover:bg-blue-500 transition-colors"
        title="Share on Twitter"
      >
        <Twitter className="w-4 h-4" />
        <span className="text-sm font-medium">Twitter</span>
      </button>
      <button
        onClick={shareToWhatsApp}
        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        title="Share on WhatsApp"
      >
        <MessageCircle className="w-4 h-4" />
        <span className="text-sm font-medium">WhatsApp</span>
      </button>
      <button
        onClick={copyLink}
        className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        title="Copy link"
      >
        {copied ? (
          <>
            <Check className="w-4 h-4" />
            <span className="text-sm font-medium">Copied!</span>
          </>
        ) : (
          <>
            <Link2 className="w-4 h-4" />
            <span className="text-sm font-medium">Copy Link</span>
          </>
        )}
      </button>
    </div>
  );
};

export default SocialShareButtons;

