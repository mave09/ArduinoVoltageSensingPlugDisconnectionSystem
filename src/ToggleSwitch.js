import React from 'react';
import './ToggleSwitch.css';

const FlagIcon = ({ color }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={color}>
    <path d="M5 3v18h2v-7h10l-2-4 2-4H7V3H5z" />
  </svg>
);

const BulbIcon = ({ color }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={color}>
    <path d="M9 21h6v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17h8v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm2 11.7V16h-4v-2.3C8.48 12.63 7 10.96 7 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.96-1.48 3.63-3 4.7z" />
  </svg>
);

function ToggleSwitch({ isOn, onToggle, icon, label }) {
  const onColor = '#ffffff';  // white icon when on
  const offColor = '#000000'; // black icon when off
  
  return (
    <button
      className={`toggle-switch ${isOn ? 'on' : 'off'}`}
      onClick={onToggle}
      aria-pressed={isOn}
      aria-label={`${icon === 'flag' ? 'Notifications' : 'Function'} toggle, currently ${label}`}
    >
      <div className={`toggle-circle ${isOn ? 'right' : 'left'}`}>
        {icon === 'flag' ? (
          <FlagIcon color={isOn ? onColor : offColor} />
        ) : (
          <BulbIcon color={isOn ? onColor : offColor} />
        )}
      </div>
      <span className="toggle-label">{label}</span>
    </button>
  );
}

export default ToggleSwitch;
