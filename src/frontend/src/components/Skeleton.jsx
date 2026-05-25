import React from 'react';
import './Skeleton.css';

function Skeleton({ height = 16, width = '100%', radius = 8 }) {
  return (
    <div className="skeleton" style={{ height, width, borderRadius: radius }} />
  );
}

export default Skeleton;
