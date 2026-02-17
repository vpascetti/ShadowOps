import React from 'react'

function BrandLogo({ size = 28 }) {
  return (
    <img
      src="/Logo.png"
      alt="ShadowOps"
      width={size}
      height={size}
      onError={(e) => {
        // Fallback to placeholder if logo not found
        e.currentTarget.src = '/vite.svg'
      }}
      style={{ display: 'inline-block' }}
    />
  )
}

export default BrandLogo
