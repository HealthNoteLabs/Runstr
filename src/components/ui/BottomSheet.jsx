import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import './BottomSheet.css';
import { vibrate } from '../../utils/platform';

/**
 * A mobile-optimized bottom sheet component
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether the bottom sheet is open
 * @param {Function} props.onClose - Callback when the sheet is closed
 * @param {React.ReactNode} props.children - Content to render in the sheet
 * @param {string} props.height - Height of the bottom sheet ('25%', '50%', '75%', 'auto')
 * @param {boolean} props.closeOnBackdropClick - Whether to close on backdrop click
 * @param {boolean} props.showDragHandle - Whether to show the drag handle
 * @param {string} props.title - Title to display at the top of the sheet
 * @returns {React.ReactPortal|null} The bottom sheet component
 */
const BottomSheet = ({
  isOpen,
  onClose,
  children,
  height = '50%',
  closeOnBackdropClick = true,
  showDragHandle = true,
  title = ''
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const sheetRef = useRef(null);
  
  // Handle escape key
  useEffect(() => {
    const handleEscKey = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);
  
  // Set up animation states when open state changes
  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      // Lock body scroll
      document.body.style.overflow = 'hidden';
      // Reset drag position
      setCurrentY(0);
    } else {
      // Small delay to allow close animation
      const timer = setTimeout(() => {
        setIsAnimating(false);
        // Restore body scroll
        document.body.style.overflow = '';
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen]);
  
  // Don't render if not open and not animating
  if (!isOpen && !isAnimating) {
    return null;
  }
  
  // Handle backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && closeOnBackdropClick) {
      onClose();
    }
  };
  
  // Handle drag start
  const handleTouchStart = (e) => {
    setStartY(e.touches[0].clientY);
    setIsDragging(true);
  };
  
  // Handle drag
  const handleTouchMove = (e) => {
    if (!isDragging) return;
    
    const deltaY = e.touches[0].clientY - startY;
    
    // Only allow dragging down (positive deltaY)
    if (deltaY > 0) {
      setCurrentY(deltaY);
    }
  };
  
  // Handle drag end
  const handleTouchEnd = () => {
    setIsDragging(false);
    
    // If dragged more than 100px or 40% of sheet height, close the sheet
    const sheetHeight = sheetRef.current?.offsetHeight || 0;
    const closeThreshold = Math.min(100, sheetHeight * 0.4);
    
    if (currentY > closeThreshold) {
      vibrate('light');
      onClose();
    } else {
      // Animate back to original position
      setCurrentY(0);
    }
  };
  
  // Calculate transform based on current drag position
  const transform = isDragging ? `translateY(${currentY}px)` : '';
  const transition = isDragging ? 'none' : 'transform 0.3s ease-out';
  
  return createPortal(
    <div 
      className={`bottom-sheet-container ${isOpen ? 'open' : 'closed'}`}
      onClick={handleBackdropClick}
    >
      <div 
        className="bottom-sheet"
        style={{ 
          height, 
          transform, 
          transition 
        }}
        ref={sheetRef}
      >
        {showDragHandle && (
          <div 
            className="bottom-sheet-handle-container"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="bottom-sheet-handle" />
          </div>
        )}
        
        {title && (
          <div className="bottom-sheet-title">
            <h3>{title}</h3>
          </div>
        )}
        
        <div className="bottom-sheet-content">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

BottomSheet.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
  height: PropTypes.string,
  closeOnBackdropClick: PropTypes.bool,
  showDragHandle: PropTypes.bool,
  title: PropTypes.string
};

export default BottomSheet; 