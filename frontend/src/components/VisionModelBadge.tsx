import React from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface VisionModelBadgeProps {
  modelName: string;
}

export function isVisionModel(modelName: string): boolean {
  if (!modelName) return false;
  const name = modelName.toLowerCase();
  return (
    name.includes('claude-3') ||
    name.includes('claude') ||
    name.includes('gpt-4o') ||
    name.includes('gpt-4.5') ||
    name.includes('gpt-4-vision') ||
    name.includes('o1') ||
    name.includes('o3') ||
    name.includes('gemini') ||
    name.includes('gemma-3') ||
    name.includes('vision') ||
    name.includes('-vl') ||
    name.includes('vl-') ||
    name.includes('qwen') ||
    name.includes('pixtral') ||
    name.includes('llava')
  );
}

export const VisionModelBadge: React.FC<VisionModelBadgeProps> = ({ modelName }) => {
  const supportsVision = isVisionModel(modelName);

  return (
    <div
      title={supportsVision ? 'Active model supports vision/image inputs' : 'Active model does not support image inputs'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '11px',
        fontWeight: 500,
        backgroundColor: supportsVision ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
        color: supportsVision ? '#10b981' : '#ef4444',
        border: `1px solid ${supportsVision ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
      }}
    >
      {supportsVision ? <Eye size={12} /> : <EyeOff size={12} />}
      <span>{supportsVision ? 'Vision Ready' : 'Text Only'}</span>
    </div>
  );
};
