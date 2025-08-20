import React from 'react';
import PropTypes from 'prop-types';

function Button({ 
  children, 
  onClick, 
  type = 'button', 
  className = '', 
  disabled = false, 
  icon 
}) {
  return (
    <button
      type={type}
      className={`px-4 py-2 rounded-md font-medium transition-colors duration-200 ${
        disabled 
          ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
          : 'bg-blue-500 text-white hover:bg-blue-600'
      } flex items-center justify-center gap-2 ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <span className="flex items-center">{icon}</span>}
      {children}
    </button>
  );
}

Button.propTypes = {
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func,
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
  className: PropTypes.string,
  disabled: PropTypes.bool,
  icon: PropTypes.element
};

export default Button;