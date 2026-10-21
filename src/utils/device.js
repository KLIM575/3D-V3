export const qualityPresets = {
  low: {
    enableMagnetic: false,
    enableTilt: false,
    enableCursorTrail: false,
    particleCount: 400,
  },
  medium: {
    enableMagnetic: true,
    enableTilt: true,
    enableCursorTrail: true,
    particleCount: 1200,
  },
  high: {
    enableMagnetic: true,
    enableTilt: true,
    enableCursorTrail: true,
    particleCount: 2400,
  },
}

export function getQualityPreset() {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  const cores = navigator.hardwareConcurrency || 4
  const memory = navigator.deviceMemory || 4
  
  if (isMobile || cores < 4 || memory < 4) {
    return qualityPresets.low
  }
  
  if (cores >= 8 && memory >= 8) {
    return qualityPresets.high
  }
  
  return qualityPresets.medium
}